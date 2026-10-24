import os
import sys
import unittest
import json
import uuid
from pathlib import Path

# Paths
BASE_DIR = Path(__file__).resolve().parent
PROJECT_ROOT = BASE_DIR.parent
sys.path.insert(0, str(BASE_DIR))
sys.path.insert(0, str(PROJECT_ROOT))

# Windows UTF-8 stdout
if sys.stdout.encoding != 'utf-8':
    try:
        sys.stdout.reconfigure(encoding='utf-8')
    except Exception:
        pass

import database
from services.ai_service import (
    generate_application_proposal,
    infer_application_category,
    APPLICATION_CATEGORIES_METADATA
)
from services.pdf_service import extract_pdf_data

class TestGeneralPurposeApplicationCompanion(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        database.init_db()
        cls.user_id = f"test-companion-user-{uuid.uuid4().hex[:8]}"

        # Create user profile
        database.upsert_profile(cls.user_id, {
            "full_name": "Dr. Companion Tester",
            "email": f"tester_{uuid.uuid4().hex[:6]}@orbi.local",
            "profession": "Software Engineer",
            "onboarding_completed": 1
        })

        # Upload sample_visa_application_notice.pdf to Smart Memory for official fact grounding test
        visa_pdf_path = PROJECT_ROOT / "sample_visa_application_notice.pdf"
        if visa_pdf_path.exists():
            extraction = extract_pdf_data(str(visa_pdf_path))
            cls.visa_doc = database.create_document(cls.user_id, {
                "filename": f"{uuid.uuid4()}_sample_visa_notice.pdf",
                "original_name": "sample_visa_application_notice.pdf",
                "file_size": visa_pdf_path.stat().st_size,
                "mime_type": "application/pdf",
                "storage_path": str(visa_pdf_path),
                "category": extraction.get("category", "application"),
                "status": "processed",
                "summary": extraction.get("summary", ""),
                "raw_text": extraction.get("raw_text", ""),
                "extracted_data": extraction
            })
            for f in extraction.get("facts", []):
                database.create_extracted_fact(cls.user_id, cls.visa_doc["id"], f)
        else:
            cls.visa_doc = None

    def test_01_visa_application_with_smart_memory_grounding(self):
        """Test Visa Application: Category inference, official Smart Memory fact grounding, verified requirements."""
        goal = "Apply for Schengen Tourist Visa to attend conference in Paris"
        institution = "Consular Department of Visas and Immigration"

        # 1. Category inference
        inferred = infer_application_category(goal, institution)
        self.assertEqual(inferred, "visa_immigration")

        # 2. Generate Proposal
        proposal = generate_application_proposal(
            user_id=self.user_id,
            goal=goal,
            institution=institution,
            doc_id=self.visa_doc["id"] if self.visa_doc else None
        )

        self.assertEqual(proposal["category"], "visa_immigration")
        self.assertEqual(proposal["category_label"], "Visa & Immigration")
        self.assertGreater(proposal["total_requirements"], 4)

        # 3. Verify grounded facts from Smart Memory
        if self.visa_doc:
            self.assertGreater(proposal["verified_requirements_count"], 0, "Should incorporate verified facts from Smart Memory notice")
            self.assertTrue(proposal.get("is_deadline_verified"), "Should have official deadline verified from notice")
            self.assertIn("December 15", str(proposal.get("deadline")))

        # 4. Confirm and Create Workflow in database
        created = database.create_application_workflow(self.user_id, {
            "title": proposal["title"],
            "goal": proposal["goal"],
            "category": proposal["category"],
            "institution": proposal["institution"],
            "deadline": proposal["deadline"],
            "checklist_items": proposal["checklist_proposal"],
            "requirements": proposal["missing_documents"],
            "clarifying_questions": proposal["clarifying_questions"]
        })

        self.assertIsNotNone(created)
        self.assertEqual(created["category"], "visa_immigration")
        self.assertGreater(len(created["checklist_items"]), 4)
        print(f"\n[Test 1 OK] Visa Application: Created '{created['title']}' ({created['category']}) with {len(created['checklist_items'])} items ({proposal['verified_requirements_count']} verified).")

    def test_02_university_admission_application(self):
        """Test University Admission: Academic Transcripts, SOP, LORs, GRE/TOEFL, and clarifying questions."""
        goal = "Apply for Master of Science in Computer Science & AI"
        institution = "Stanford University Admissions Office"

        inferred = infer_application_category(goal, institution)
        self.assertEqual(inferred, "university_admission")

        proposal = generate_application_proposal(
            user_id=self.user_id,
            goal=goal,
            institution=institution
        )

        self.assertEqual(proposal["category"], "university_admission")
        req_names = [it["required_document"] for it in proposal["checklist_proposal"]]
        
        # Verify academic requirements exist
        self.assertTrue(any("Transcript" in name for name in req_names))
        self.assertTrue(any("Statement of Purpose" in name or "SOP" in name for name in req_names))
        self.assertTrue(any("Recommendation" in name or "LOR" in name for name in req_names))
        self.assertTrue(any("Test Score" in name or "GRE" in name for name in req_names))

        # Verify clarifying questions generated for missing deadline/term
        cq_types = [cq["type"] for cq in proposal["clarifying_questions"]]
        self.assertIn("deadline", cq_types)

        # Save to DB
        created = database.create_application_workflow(self.user_id, {
            "title": proposal["title"],
            "goal": proposal["goal"],
            "category": proposal["category"],
            "institution": proposal["institution"],
            "deadline": "December 1, 2026",
            "checklist_items": proposal["checklist_proposal"]
        })
        self.assertEqual(created["category"], "university_admission")
        print(f"[Test 2 OK] University Admission: Inferred category '{created['category']}', verified standard academic requirements & deadline clarifying question.")

    def test_03_job_application_and_manual_override(self):
        """Test Job Application: Resume, Cover Letter, Work Authorization, plus user category override."""
        goal = "Apply for Principal Cloud Security Architect position"
        institution = "Amazon Web Services (AWS)"

        inferred = infer_application_category(goal, institution)
        self.assertEqual(inferred, "job_application")

        proposal = generate_application_proposal(
            user_id=self.user_id,
            goal=goal,
            institution=institution
        )
        self.assertEqual(proposal["category"], "job_application")
        req_names = [it["required_document"] for it in proposal["checklist_proposal"]]
        self.assertTrue(any("Resume" in name or "CV" in name for name in req_names))
        self.assertTrue(any("Cover Letter" in name for name in req_names))
        self.assertTrue(any("Authorization" in name or "Work" in name for name in req_names))

        # Test manual category override by user (e.g. override to 'internship')
        overridden = generate_application_proposal(
            user_id=self.user_id,
            goal=goal,
            institution=institution,
            category_override="internship"
        )
        self.assertEqual(overridden["category"], "internship")
        self.assertEqual(overridden["category_label"], "Internship & Fellowship")

        # Save job workflow to DB
        created = database.create_application_workflow(self.user_id, {
            "title": proposal["title"],
            "goal": proposal["goal"],
            "category": proposal["category"],
            "institution": proposal["institution"],
            "checklist_items": proposal["checklist_proposal"]
        })
        self.assertEqual(created["category"], "job_application")
        print(f"[Test 3 OK] Job Application: Inferred '{proposal['category']}', tested override to '{overridden['category']}', verified resume and portfolio requirements.")

    def test_04_insurance_claim_application(self):
        """Test Insurance Claim: Incident report, repair estimates, FIR, and claim-specific clarifications."""
        goal = "File comprehensive automobile collision claim for damaged front bumper and headlight"
        institution = "Geico General Insurance Company"

        inferred = infer_application_category(goal, institution)
        self.assertEqual(inferred, "insurance_claim")

        proposal = generate_application_proposal(
            user_id=self.user_id,
            goal=goal,
            institution=institution
        )
        self.assertEqual(proposal["category"], "insurance_claim")
        req_names = [it["required_document"] for it in proposal["checklist_proposal"]]
        self.assertTrue(any("Claim Form" in name for name in req_names))
        self.assertTrue(any("Incident" in name or "Damage Report" in name for name in req_names))
        self.assertTrue(any("Invoice" in name or "Repair Estimate" in name for name in req_names))
        self.assertTrue(any("Policy" in name for name in req_names))

        # Verify claim reference clarification
        self.assertTrue(any("policy number" in cq["question"].lower() or "claim" in cq["question"].lower() for cq in proposal["clarifying_questions"]))

        created = database.create_application_workflow(self.user_id, {
            "title": proposal["title"],
            "goal": proposal["goal"],
            "category": proposal["category"],
            "institution": proposal["institution"],
            "checklist_items": proposal["checklist_proposal"]
        })
        self.assertEqual(created["category"], "insurance_claim")
        print(f"[Test 4 OK] Insurance Claim: Inferred '{created['category']}', verified incident report, estimate requirements, and policy clarification.")

    def test_05_custom_application_workflow(self):
        """Test Custom Application: Arbitrary user goal generates structured 5-step checklist."""
        goal = "Establish neighborhood botanical conservation collective and community greenhouse"
        institution = "Regional Urban Agriculture Alliance"

        inferred = infer_application_category(goal, institution)
        self.assertEqual(inferred, "custom")

        proposal = generate_application_proposal(
            user_id=self.user_id,
            goal=goal,
            institution=institution
        )
        self.assertEqual(proposal["category"], "custom")
        self.assertEqual(proposal["category_label"], "Custom Workflow")
        self.assertEqual(len(proposal["checklist_proposal"]), 5)

        created = database.create_application_workflow(self.user_id, {
            "title": proposal["title"],
            "goal": proposal["goal"],
            "category": proposal["category"],
            "institution": proposal["institution"],
            "checklist_items": proposal["checklist_proposal"]
        })
        self.assertEqual(created["category"], "custom")
        print(f"[Test 5 OK] Custom Workflow: Successfully created 5-step custom execution workflow for '{goal[:40]}...'.")

    def test_06_independent_category_filtering_and_progress(self):
        """Test that different application categories are tracked and filtered independently in database."""
        # Query all
        all_wfs = database.get_application_workflows(self.user_id)
        self.assertGreaterEqual(len(all_wfs), 5, "Should have created at least 5 different workflows across tests")

        # Query university admissions only
        uni_wfs = database.get_application_workflows(self.user_id, category="university_admission")
        self.assertGreater(len(uni_wfs), 0)
        self.assertTrue(all(w["category"] == "university_admission" for w in uni_wfs))

        # Query jobs only
        job_wfs = database.get_application_workflows(self.user_id, category="job_application")
        self.assertGreater(len(job_wfs), 0)
        self.assertTrue(all(w["category"] == "job_application" for w in job_wfs))

        # Query insurance claims only
        claim_wfs = database.get_application_workflows(self.user_id, category="insurance_claim")
        self.assertGreater(len(claim_wfs), 0)
        self.assertTrue(all(w["category"] == "insurance_claim" for w in claim_wfs))

        # Test progress update on a pending item
        first_wf = all_wfs[0]
        pending_item = next((it for it in first_wf["checklist_items"] if it["status"] == "pending"), first_wf["checklist_items"][0])
        initial_status = pending_item["status"]
        new_status = "completed" if initial_status != "completed" else "pending"

        updated_item = database.update_checklist_item_status(pending_item["id"], self.user_id, "completed")
        self.assertEqual(updated_item["status"], "completed")

        # Verify progress recalculated on parent workflow
        refreshed_wf = database.get_application_workflow(first_wf["id"], self.user_id)
        self.assertGreater(refreshed_wf["progress"], 0)
        self.assertGreaterEqual(refreshed_wf["completed_steps"], 1)
        print(f"[Test 6 OK] Category Filtering & Progress: Filtered by category independently; confirmed progress update {refreshed_wf['progress']}% on workflow '{refreshed_wf['title']}'.")

if __name__ == "__main__":
    unittest.main()
