import os
import sys
import unittest
from pathlib import Path

# Set up paths
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(PROJECT_ROOT))

# Ensure utf-8 output in Windows
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import pymupdf as fitz
from services.pdf_service import (
    extract_pdf_data,
    is_ocr_engine_available,
    detect_document_layer,
    classify_category
)

class TestDocumentIntelligence(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.test_dir = BASE_DIR / "test_scratch"
        cls.test_dir.mkdir(exist_ok=True)

        # 1. Path to real rnn.pdf
        cls.rnn_pdf_path = BASE_DIR / "uploads" / "5c663499-9deb-46c9-902a-e4818ffe6550_rnn.pdf"

        # 2. Path to electricity bill
        cls.bill_pdf_path = PROJECT_ROOT / "sample_electricity_bill_inr.pdf"

        # 3. Path to visa application notice
        cls.visa_pdf_path = PROJECT_ROOT / "sample_visa_application_notice.pdf"

        # 4. Create a pure scanned (image-only, zero text) PDF
        cls.scanned_pdf_path = cls.test_dir / "test_scanned_image_only.pdf"
        cls._create_scanned_pdf(cls.scanned_pdf_path)

        # 5. Create an empty (0 byte) PDF
        cls.empty_pdf_path = cls.test_dir / "test_empty_zero_bytes.pdf"
        with open(cls.empty_pdf_path, "wb") as f:
            pass

        # 6. Create a corrupted PDF
        cls.corrupt_pdf_path = cls.test_dir / "test_corrupted_format.pdf"
        with open(cls.corrupt_pdf_path, "wb") as f:
            f.write(b"%PDF-1.4\nTHIS_IS_CORRUPT_GARBAGE_PAYLOAD_NOT_A_VALID_OBJECT_STREAM\n%%EOF\n")

    @classmethod
    def _create_scanned_pdf(cls, file_path: Path):
        doc = fitz.open()
        page = doc.new_page(width=400, height=300)
        # Create a small pixmap and insert as image without any text layer
        pix = fitz.Pixmap(fitz.csRGB, fitz.IRect(0, 0, 200, 150), False)
        pix.clear_with(0x80)  # gray fill
        img_bytes = pix.tobytes("png")
        page.insert_image(fitz.Rect(50, 50, 250, 200), stream=img_bytes)
        doc.save(str(file_path))
        doc.close()

    def test_01_text_and_diagram_pdf_rnn(self):
        """Test real 21-page RNN & Transformer paper: check char count, layer detection, facts, and no glitch."""
        self.assertTrue(self.rnn_pdf_path.exists(), f"rnn.pdf not found at {self.rnn_pdf_path}")
        result = extract_pdf_data(str(self.rnn_pdf_path))

        self.assertTrue(result["success"])
        self.assertEqual(result["page_count"], 21)
        self.assertEqual(result["layer_type"], "mixed")
        self.assertEqual(result["category"], "education")
        
        # Verify character count extracted by PyMuPDF
        char_count = result["total_chars"]
        print(f"\n[Test 1] rnn.pdf extracted character count: {char_count:,} chars across 21 pages.")
        self.assertGreater(char_count, 15000, "Should extract ~15,700 characters")

        # Verify facts extracted
        facts = result["facts"]
        print(f"[Test 1] Facts extracted count: {len(facts)}")
        self.assertGreater(len(facts), 3, "Should extract multiple verified structural facts")

        # Verify fact types
        fact_types = [f["fact_type"] for f in facts]
        self.assertIn("title", fact_types)
        self.assertIn("structure", fact_types)
        self.assertIn("topic", fact_types)
        self.assertIn("status", fact_types)

        # Verify NO comma glitch
        summary = result["summary"]
        self.assertNotIn("Recorded amount: ,.", summary)
        self.assertNotIn(",.", summary)
        for f in facts:
            self.assertNotEqual(f["value"], ",")
            self.assertFalse(f["value"].startswith(",."))
            self.assertGreater(f.get("page_number", 0), 0)

        # Print extracted facts for inspection
        for f in facts:
            print(f"  • [{f['fact_type'].upper()}] {f['label']}: {f['value']} (Page {f['page_number']})")

    def test_02_text_based_bill_pdf(self):
        """Test standard text-based INR electricity bill: check amount, due date, organization."""
        self.assertTrue(self.bill_pdf_path.exists(), "Sample electricity bill not found")
        result = extract_pdf_data(str(self.bill_pdf_path))

        self.assertTrue(result["success"])
        self.assertEqual(result["category"], "bill")
        self.assertEqual(result["layer_type"], "text_based")
        self.assertGreater(result["total_chars"], 500)

        facts = result["facts"]
        self.assertGreater(len(facts), 2)
        fact_values = " ".join([str(f["value"]) for f in facts])
        
        # Check amount extracted
        self.assertTrue(any("2,450" in str(f["value"]) or "2450" in str(f["value"]) for f in facts))
        # Check due date
        self.assertTrue(any("15 November 2026" in str(f["value"]) for f in facts))
        # Check institution
        self.assertTrue(any("Tata Power" in str(f["value"]) or "DDL" in str(f["value"]) for f in facts))

        print(f"\n[Test 2] Bill PDF: Extracted {len(facts)} facts, {result['total_chars']} chars.")
        for f in facts:
            print(f"  • [{f['fact_type'].upper()}] {f['label']}: {f['value']} (Page {f['page_number']})")

    def test_03_application_notice_pdf(self):
        """Test visa application notice: check category, requirements, deadline."""
        self.assertTrue(self.visa_pdf_path.exists(), "Sample visa notice not found")
        result = extract_pdf_data(str(self.visa_pdf_path))

        self.assertTrue(result["success"])
        self.assertEqual(result["category"], "application")
        self.assertEqual(result["layer_type"], "text_based")

        facts = result["facts"]
        req_facts = [f for f in facts if f["fact_type"] == "requirement"]
        self.assertGreater(len(req_facts), 0, "Should extract checklist requirements")
        print(f"\n[Test 3] Application Notice: Extracted {len(facts)} facts ({len(req_facts)} requirements).")
        for f in facts:
            print(f"  • [{f['fact_type'].upper()}] {f['label']}: {f['value']} (Page {f['page_number']})")

    def test_04_scanned_image_only_pdf(self):
        """Test pure scanned/image PDF with 0 text characters: check OCR limitation reporting."""
        result = extract_pdf_data(str(self.scanned_pdf_path))

        self.assertTrue(result["success"])
        self.assertTrue(result["is_scanned"])
        self.assertEqual(result["layer_type"], "scanned")
        self.assertEqual(result["total_chars"], 0)
        self.assertIn("scanned", result["category"])
        self.assertIsNotNone(result.get("warning"))
        
        facts = result["facts"]
        self.assertGreater(len(facts), 0)
        # Should contain diagnostic facts explaining OCR state, not hallucinated text
        self.assertTrue(any("Scanned" in f["value"] for f in facts))
        self.assertTrue(any("OCR" in f["label"] or "OCR" in f["value"] for f in facts))

        print(f"\n[Test 4] Scanned PDF: Correctly identified {result['layer_type']}, chars={result['total_chars']}.")
        print(f"  Warning: {result['warning']}")
        for f in facts:
            print(f"  • [{f['fact_type'].upper()}] {f['label']}: {f['value']}")

    def test_05_empty_zero_byte_pdf(self):
        """Test empty 0-byte file: ensure clean error handling without crash."""
        result = extract_pdf_data(str(self.empty_pdf_path))
        self.assertFalse(result["success"])
        self.assertEqual(result["page_count"], 0)
        self.assertEqual(len(result["facts"]), 0)
        print(f"\n[Test 5] Empty PDF handled safely: {result.get('error')}")

    def test_06_corrupt_pdf_file(self):
        """Test malformed/corrupted PDF: ensure graceful catch and error response."""
        result = extract_pdf_data(str(self.corrupt_pdf_path))
        self.assertFalse(result["success"])
        self.assertEqual(result["page_count"], 0)
        self.assertIn("Failed to open", result.get("error", ""))
        print(f"\n[Test 6] Corrupt PDF handled safely: {result.get('error')}")

if __name__ == "__main__":
    unittest.main()
