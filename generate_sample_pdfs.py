import fitz  # PyMuPDF

def create_sample_bill_pdf(filename="sample_electric_bill.pdf"):
    doc = fitz.open()
    page = doc.new_page()
    
    # Title & Header
    rect_header = fitz.Rect(50, 40, 550, 80)
    page.insert_textbox(rect_header, "METRO EDISON ENERGY CORP\nMonthly Utility Billing Statement", fontsize=16, fontname="helv", color=(0.1, 0.2, 0.4))
    
    body_text = """
Statement Date: October 24, 2026
Account Number: 9482-1029-4410
Service Address: 742 Evergreen Terrace, Suite 3B

SUMMARY OF CHARGES:
Previous Balance: $0.00
Current Electric Consumption: $142.50
Taxes & Regulatory Surcharges: $12.30
--------------------------------------------------
Total Amount Due: $154.80
Payment Due Date: November 18, 2026

IMPORTANT PAYMENT NOTICE:
Payment must be received by November 18, 2026 to avoid a 5% late penalty.
You can settle your bill online at https://metroedison.internal or via auto-pay.

Customer Care: (800) 555-0199 | support@metroedison.internal
    """
    rect_body = fitz.Rect(50, 100, 550, 600)
    page.insert_textbox(rect_body, body_text.strip(), fontsize=11, fontname="helv", color=(0.15, 0.15, 0.15))
    
    doc.save(filename)
    doc.close()
    print(f"Generated {filename}")

def create_sample_application_pdf(filename="sample_visa_application_notice.pdf"):
    doc = fitz.open()
    page = doc.new_page()
    
    rect_header = fitz.Rect(50, 40, 550, 80)
    page.insert_textbox(rect_header, "CONSULATE GENERAL OF THE REPUBLIC\nOfficial Visa Application Guidelines & Document Checklist", fontsize=15, fontname="helv", color=(0.1, 0.2, 0.4))
    
    body_text = """
Notice Reference: VISA-APP-2026-881
Category: Short-Stay Schengen Visitor Visa
Deadline for Submission: December 15, 2026

MANDATORY REQUIRED DOCUMENTS:
1. Valid Passport Copy (with at least 6 months remaining validity).
2. Proof of Financial Means (Bank Statement from past 3 months showing stable funds).
3. Completed Application Form signed by applicant.
4. Biometrics & Photographs meeting ICAO specifications.
5. Travel Health Insurance Certificate covering minimum €30,000.
6. Visa Fee Receipt of $85.00 USD.

SUBMISSION PROCEDURE:
All applicants must compile their document dossier in the exact order listed above.
Biometric appointment must be scheduled online before the deadline: December 15, 2026.

Consular Department of Visas and Immigration
Contact: visa-office@consulate.gov.internal
    """
    rect_body = fitz.Rect(50, 100, 550, 600)
    page.insert_textbox(rect_body, body_text.strip(), fontsize=11, fontname="helv", color=(0.15, 0.15, 0.15))
    
    doc.save(filename)
    doc.close()
    print(f"Generated {filename}")

def create_sample_inr_bill_pdf(filename="sample_electricity_bill_inr.pdf"):
    doc = fitz.open()
    page = doc.new_page()
    
    rect_header = fitz.Rect(50, 40, 550, 80)
    page.insert_textbox(rect_header, "TATA POWER DELHI DISTRIBUTION LIMITED\nElectricity Supply Billing Statement", fontsize=16, fontname="helv", color=(0.1, 0.2, 0.4))
    
    body_text = """
Statement Date: 24 October 2026
CA Number: 6001-9284-1102
Consumer Name: Eleanor Vance
Service Address: Flat 402, Green Glen Layout, Outer Ring Road, Bangalore - 560103

SUMMARY OF ELECTRICITY CHARGES:
Energy Consumption Charges: Rs. 2,120.00
Fixed Demand Charges: Rs. 210.00
Electricity Duty & State Cess: Rs. 120.00
--------------------------------------------------
Total Amount Due: Rs. 2,450.00 (INR 2,450.00)
Payment Due Date: 15 November 2026

IMPORTANT PAYMENT INSTRUCTIONS:
Please pay before 15 November 2026 to avoid disconnection and delayed payment surcharge of Rs. 125.00.
Payments can be made via UPI, NetBanking, or at authorized collection centres.

Customer Helpline: 19124 | care@tatapower-ddl.com
    """
    rect_body = fitz.Rect(50, 100, 550, 600)
    page.insert_textbox(rect_body, body_text.strip(), fontsize=11, fontname="helv", color=(0.15, 0.15, 0.15))
    
    doc.save(filename)
    doc.close()
    print(f"Generated {filename}")

if __name__ == '__main__':
    create_sample_bill_pdf()
    create_sample_inr_bill_pdf()
    create_sample_application_pdf()
