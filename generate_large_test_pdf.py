import fitz  # PyMuPDF
import os

def create_large_pdf(filename="large_test_document.pdf", target_mb=20):
    doc = fitz.open()
    page = doc.new_page()
    page.insert_textbox(fitz.Rect(50, 50, 550, 200), "Orbi Smart Memory 20MB Large Document Test - Research Whitepaper on Recurrent Neural Networks (RNN)")
    doc.save(filename)
    doc.close()
    
    # Pad PDF with valid PDF comment trailer up to target size (19.8 MB)
    target_bytes = int(target_mb * 1024 * 1024)
    current_size = os.path.getsize(filename)
    if current_size < target_bytes:
        with open(filename, "ab") as f:
            f.write(b"\n% " + os.urandom(target_bytes - current_size - 10) + b"\n%%EOF\n")
            
    size_mb = os.path.getsize(filename) / (1024 * 1024)
    print(f"Generated {filename} ({size_mb:.2f} MB)")

if __name__ == '__main__':
    create_large_pdf()
