import re
import json
import requests
from datetime import datetime, date
from zoneinfo import ZoneInfo
from typing import Dict, Any, List, Optional
from config import Config
import database

def format_date_dmy(val: Optional[str]) -> str:
    """Format date string into DD/MM/YYYY."""
    if not val:
        return ""
    val_str = str(val).strip()
    match = re.match(r'^(\d{4})-(\d{1,2})-(\d{1,2})', val_str)
    if match:
        year, month, day = match.groups()
        return f"{int(day):02d}/{int(month):02d}/{year}"
    match_dmy = re.match(r'^(\d{1,2})/(\d{1,2})/(\d{4})', val_str)
    if match_dmy:
        day, month, year = match_dmy.groups()
        return f"{int(day):02d}/{int(month):02d}/{year}"
    for fmt in ('%B %d, %Y', '%b %d, %Y', '%d %B %Y', '%d %b %Y', '%Y/%m/%d'):
        try:
            dt = datetime.strptime(val_str, fmt)
            return dt.strftime('%d/%m/%Y')
        except ValueError:
            continue
    return val_str

def get_user_context_summary(user_id: str) -> Dict[str, Any]:
    """
    Gathers all personal records for the authenticated user to provide grounded context.
    """
    profile = database.get_profile(user_id) or {}
    family = database.get_family_members(user_id)
    documents = database.get_documents(user_id)
    facts = database.get_extracted_facts(user_id)
    bills = database.get_bills(user_id)
    events = database.get_events(user_id)
    reminders = database.get_reminders(user_id)
    workflows = database.get_application_workflows(user_id)

    return {
        "profile": profile,
        "family": family,
        "documents": [{"id": d["id"], "name": d["original_name"], "category": d["category"], "summary": d["summary"]} for d in documents],
        "facts": [{"label": f["label"], "value": f["value"], "doc_id": f.get("document_id")} for f in facts],
        "bills": [{"id": b["id"], "title": b["title"], "biller": b["biller"], "amount": b["amount"], "currency": b["currency"], "due_date": b["due_date"], "status": b["status"]} for b in bills],
        "events": [{"id": e["id"], "title": e["title"], "type": e["event_type"], "start_time": e["start_time"]} for e in events],
        "reminders": [{"id": r["id"], "title": r["title"], "due_time": r["due_time"], "status": r["status"]} for r in reminders],
        "workflows": [{"id": w["id"], "title": w["title"], "progress": w["progress"], "status": w["status"], "steps": len(w.get("checklist_items", []))} for w in workflows]
    }

def call_gemini_api(prompt: str, system_instruction: str) -> Optional[str]:
    """Calls Gemini REST API if key is provided."""
    if not Config.GEMINI_API_KEY:
        return None

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={Config.GEMINI_API_KEY}"
    payload = {
        "contents": [
            {
                "parts": [
                    {"text": f"{system_instruction}\n\nUser Query: {prompt}"}
                ]
            }
        ],
        "generationConfig": {
            "temperature": 0.2,
            "maxOutputTokens": 1000
        }
    }

    try:
        response = requests.post(url, json=payload, timeout=15)
        if response.status_code == 200:
            data = response.json()
            return data["candidates"][0]["content"]["parts"][0]["text"]
    except Exception as e:
        print(f"Gemini API error: {e}")
    return None

def format_curr_val(amount: float, currency: str = "INR") -> str:
    sym = "₹" if currency == "INR" else "$" if currency == "USD" else "€" if currency == "EUR" else "£" if currency == "GBP" else f"{currency} "
    return f"{sym}{amount:.2f}"

def answer_user_query(user_id: str, query: str) -> Dict[str, Any]:
    """
    Answers user questions strictly using authenticated personal records.
    Returns answer text and source references.
    """
    ctx = get_user_context_summary(user_id)
    profile = ctx["profile"]
    user_name = profile.get("full_name", "there")
    q_lower = query.lower()

    source_references: List[Dict[str, Any]] = []
    response_text = ""

    # Check for bills query
    if any(k in q_lower for k in ["bill", "payment", "due soon", "owe", "utility"]):
        bills = ctx["bills"]
        upcoming_bills = [b for b in bills if b["status"] != "paid"]
        if upcoming_bills:
            response_text = f"Here are your pending bills, {user_name}:\n"
            for b in upcoming_bills:
                amt_str = format_curr_val(b['amount'], b.get('currency', 'INR'))
                response_text += f"• **{b['title']}** ({b['biller']}): {amt_str} due on {format_date_dmy(b.get('due_date'))} (Status: {b['status']})\n"
                source_references.append({
                    "type": "bill",
                    "id": b["id"],
                    "title": b["title"],
                    "snippet": f"{amt_str} due {b['due_date']}"
                })
        else:
            response_text = f"You currently have no pending bills on record, {user_name}. All tracked bills are up to date."

    # Check for birthday / family query
    elif any(k in q_lower for k in ["birthday", "anniversary", "family", "whose birthday"]):
        family = ctx["family"]
        if family:
            response_text = f"Here are the tracked family events for you, {user_name}:\n"
            for m in family:
                details = []
                if m.get("birthday"):
                    details.append(f"Birthday: {m['birthday']}")
                if m.get("anniversary"):
                    details.append(f"Anniversary: {m['anniversary']}")
                detail_str = f" ({', '.join(details)})" if details else ""
                response_text += f"• **{m['name']}** ({m['relationship']}){detail_str}\n"
                source_references.append({
                    "type": "family",
                    "id": m["id"],
                    "title": m["name"],
                    "snippet": f"Relationship: {m['relationship']}"
                })
        else:
            response_text = "No family members or dates have been recorded yet. You can add them under Family settings or during onboarding."

    # Check for appointments / schedule / week handle
    elif any(k in q_lower for k in ["handle this week", "schedule", "appointment", "calendar", "what's up", "agenda", "today"]):
        events = ctx["events"]
        reminders = ctx["reminders"]
        bills = [b for b in ctx["bills"] if b["status"] != "paid"]
        
        response_text = f"Here is what is on your radar, {user_name}:\n\n"
        has_items = False
        
        if events:
            has_items = True
            response_text += "**Upcoming Appointments & Events:**\n"
            for e in events[:4]:
                response_text += f"• {e['title']} ({e['type']}) at {e['start_time']}\n"
                source_references.append({"type": "event", "id": e["id"], "title": e["title"], "snippet": e["start_time"]})
            response_text += "\n"

        if bills:
            has_items = True
            response_text += "**Upcoming Bills:**\n"
            for b in bills[:3]:
                amt_str = format_curr_val(b['amount'], b.get('currency', 'INR'))
                response_text += f"• {b['title']}: {amt_str} due {b['due_date']}\n"
                source_references.append({"type": "bill", "id": b["id"], "title": b["title"], "snippet": f"Due {b['due_date']}"})
            response_text += "\n"

        if reminders:
            has_items = True
            response_text += "**Active Reminders:**\n"
            for r in reminders[:3]:
                response_text += f"• {r['title']} scheduled for {r['due_time']}\n"
                source_references.append({"type": "reminder", "id": r["id"], "title": r["title"], "snippet": r["due_time"]})

        if not has_items:
            response_text = f"You are all caught up for this week, {user_name}! There are no upcoming events, pending bills, or overdue reminders in your records."

    # Check for application missing documents query
    elif any(k in q_lower for k in ["application", "missing document", "checklist", "prepare application", "visa", "admission"]):
        workflows = database.get_application_workflows(user_id)
        if workflows:
            response_text = f"Here is the status of your application workflows, {user_name}:\n\n"
            for wf in workflows:
                response_text += f"**{wf['title']}** (Progress: {wf['progress']}%):\n"
                pending_items = [it for it in wf.get("checklist_items", []) if it["status"] != "completed"]
                for it in pending_items:
                    req_doc = f" [Needs: {it['required_document']}]" if it.get("required_document") else ""
                    response_text += f"• [ ] {it['title']}{req_doc}\n"
                    source_references.append({"type": "workflow", "id": wf["id"], "title": wf["title"], "snippet": it["title"]})
        else:
            response_text = "You do not have any active application workflows right now. You can start one by uploading an application guideline PDF or clicking 'New Application' in the Companion."

    # Check documents query
    elif any(k in q_lower for k in ["document", "file", "pdf", "paperwork"]):
        docs = ctx["documents"]
        if docs:
            response_text = f"You have {len(docs)} documents stored in Smart Memory, {user_name}:\n"
            for d in docs[:5]:
                response_text += f"• **{d['name']}** ({d['category']}): {d['summary']}\n"
                source_references.append({"type": "document", "id": d["id"], "title": d["name"], "snippet": d["summary"]})
        else:
            response_text = "You haven't uploaded any documents yet. Upload a PDF bill, tax document, or application notice in Smart Memory to get started."

    # Fallback to AI model with user context or grounded summary
    else:
        system_instruction = (
            "You are Orbi, an AI-powered personal digital PA. "
            "Always be concise, professional, warm, and highly structured. "
            "Only answer based on the user's authentic saved records below. If information is not in the records, politely declare it is not found."
            f"\n\nUSER CONTEXT:\n{json.dumps(ctx)}"
        )
        ai_reply = call_gemini_api(query, system_instruction)
        if ai_reply:
            response_text = ai_reply
        else:
            response_text = (
                f"I checked your personal memory records, {user_name}. "
                f"You currently have {len(ctx['documents'])} documents, {len(ctx['bills'])} bills, and {len(ctx['events'])} events saved. "
                "Could you specify if you are looking for bills, application checklists, calendar appointments, or document facts?"
            )

    return {
        "answer": response_text,
        "source_references": source_references
    }

# -------------------------------------------------------------
# GENERAL-PURPOSE APPLICATION COMPANION INTELLIGENCE
# -------------------------------------------------------------

APPLICATION_CATEGORIES_METADATA = {
    'university_admission': {
        'label': 'University Admission',
        'keywords': ['university', 'college', 'admission', 'master', 'bachelor', 'phd', 'graduate school', 'undergraduate', 'degree program', 'tuition'],
        'default_institution': 'University Admissions Office',
        'standard_requirements': [
            {'name': 'Official Academic Transcripts', 'desc': 'Official degree certificates and mark sheets.', 'keywords': ['transcript', 'degree', 'diploma', 'grade', 'marksheet']},
            {'name': 'Statement of Purpose (SOP)', 'desc': 'Personal statement outlining goals, background, and academic fit.', 'keywords': ['sop', 'statement of purpose', 'essay', 'motivation']},
            {'name': 'Letters of Recommendation (LORs)', 'desc': 'Academic or professional letters from professors/supervisors.', 'keywords': ['recommendation', 'reference', 'lor', 'referee']},
            {'name': 'Standardized Test Scores', 'desc': 'Official scores (GRE, GMAT, TOEFL, IELTS, SAT).', 'keywords': ['gre', 'gmat', 'toefl', 'ielts', 'sat', 'test score']},
            {'name': 'Proof of Identity (Passport Copy)', 'desc': 'Government-issued passport bio page.', 'keywords': ['passport', 'id', 'identification', 'national id']},
            {'name': 'Financial Guarantee / Proof of Funds', 'desc': 'Bank statement or sponsorship affidavit proving financial coverage.', 'keywords': ['bank', 'statement', 'financial', 'funds', 'sponsor']},
            {'name': 'Application Fee Payment Receipt', 'desc': 'Official confirmation of submission fee payment.', 'keywords': ['fee', 'receipt', 'payment', 'invoice']}
        ],
        'clarifications': [
            {'question': 'What is your target submission deadline or intake term (e.g., Fall 2027)?', 'type': 'deadline', 'urgency': 'high'},
            {'question': 'Which specific university or academic department are you applying to?', 'type': 'institution', 'urgency': 'medium'}
        ]
    },
    'scholarship': {
        'label': 'Scholarship & Grant',
        'keywords': ['scholarship', 'grant', 'fellowship funding', 'financial aid', 'bursary', 'stipend', 'tuition assistance', 'endowment'],
        'default_institution': 'Scholarship Committee / Trust',
        'standard_requirements': [
            {'name': 'Scholarship Application Form', 'desc': 'Official completed scholarship/grant form.', 'keywords': ['scholarship', 'application', 'form']},
            {'name': 'Academic Merit & GPA Verification', 'desc': 'Official transcripts proving academic excellence or GPA standing.', 'keywords': ['transcript', 'gpa', 'merit', 'grade', 'academic']},
            {'name': 'Scholarship Motivation Essay', 'desc': 'Essay demonstrating eligibility, community impact, and vision.', 'keywords': ['essay', 'motivation', 'personal statement', 'sop']},
            {'name': 'Financial Need Evidence', 'desc': 'Tax returns, parent W-2s, or household income certificate.', 'keywords': ['tax', 'income', 'w2', '1040', 'paystub', 'salary']},
            {'name': 'Comprehensive Academic CV / Resume', 'desc': 'Detailed resume highlighting awards, extracurriculars, and publications.', 'keywords': ['resume', 'cv', 'curriculum vitae']},
            {'name': 'Academic Recommendation Letters', 'desc': 'Confidential reference letters from department faculty or mentors.', 'keywords': ['recommendation', 'reference', 'lor']}
        ],
        'clarifications': [
            {'question': 'When is the scholarship application cutoff date?', 'type': 'deadline', 'urgency': 'high'},
            {'question': 'Which foundation, university trust, or organization sponsors this award?', 'type': 'institution', 'urgency': 'medium'}
        ]
    },
    'job_application': {
        'label': 'Job Application & Employment',
        'keywords': ['job', 'employment', 'position', 'role', 'engineer', 'developer', 'manager', 'designer', 'analyst', 'associate', 'hiring', 'interview', 'work application', 'resume submission', 'career'],
        'default_institution': 'Hiring Organization / Employer',
        'standard_requirements': [
            {'name': 'Tailored Professional Resume / CV', 'desc': 'Updated resume customized for the target job specifications.', 'keywords': ['resume', 'cv', 'curriculum vitae']},
            {'name': 'Targeted Cover Letter', 'desc': 'Professional letter detailing relevant achievements and interest in the company.', 'keywords': ['cover letter', 'letter of interest', 'motivation']},
            {'name': 'Professional Portfolio / Work Samples', 'desc': 'Work samples, design portfolio, publications, or GitHub repositories.', 'keywords': ['portfolio', 'sample', 'project', 'github', 'work']},
            {'name': 'Professional References Sheet', 'desc': 'Contact details of 2–3 former managers or professional colleagues.', 'keywords': ['reference', 'contact', 'referee']},
            {'name': 'Work Authorization & Identity Proof', 'desc': 'Passport, work visa, EAD, or citizenship verification.', 'keywords': ['passport', 'id', 'visa', 'work permit', 'authorization', 'license']},
            {'name': 'Past Experience Letters / Certificates', 'desc': 'Experience letters, relieving orders, or university degree diplomas.', 'keywords': ['certificate', 'experience', 'relieving', 'degree', 'diploma']}
        ],
        'clarifications': [
            {'question': 'Which company, organization, or department is offering this role?', 'type': 'institution', 'urgency': 'medium'},
            {'question': 'Is there an application deadline or scheduled interview date?', 'type': 'deadline', 'urgency': 'low'}
        ]
    },
    'internship': {
        'label': 'Internship & Fellowship',
        'keywords': ['internship', 'intern', 'co-op', 'apprentice', 'fellowship', 'trainee', 'summer placement'],
        'default_institution': 'Internship Host Organization',
        'standard_requirements': [
            {'name': 'Academic Student Resume / CV', 'desc': 'Focused student resume detailing coursework and projects.', 'keywords': ['resume', 'cv', 'student']},
            {'name': 'Current University Enrollment Proof', 'desc': 'Enrollment letter or current semester transcript.', 'keywords': ['transcript', 'enrollment', 'student id', 'grade']},
            {'name': 'Statement of Internship Interest', 'desc': 'Statement articulating learning objectives and technical capabilities.', 'keywords': ['statement', 'cover letter', 'objective', 'essay']},
            {'name': 'Faculty Advisor Recommendation', 'desc': 'Academic recommendation from an instructor or research advisor.', 'keywords': ['recommendation', 'reference', 'faculty']},
            {'name': 'Government Photo Identification', 'desc': 'Passport or state ID verifying student identity.', 'keywords': ['id', 'passport', 'license']}
        ],
        'clarifications': [
            {'question': 'What is the internship application deadline or start term?', 'type': 'deadline', 'urgency': 'high'},
            {'question': 'Which company or lab is hosting the internship program?', 'type': 'institution', 'urgency': 'medium'}
        ]
    },
    'government_service': {
        'label': 'Government Service & Citizenship',
        'keywords': ['government', 'passport', 'citizenship', 'tax registration', 'social security', 'voter id', 'national id', 'civil registry', 'consular service'],
        'default_institution': 'Government Department / Agency',
        'standard_requirements': [
            {'name': 'Official Government Application Form', 'desc': 'Completed and signed statutory service application form.', 'keywords': ['application', 'form', 'government']},
            {'name': 'Primary Identity Proof', 'desc': 'Official birth certificate, national ID, or existing passport.', 'keywords': ['birth certificate', 'national id', 'passport', 'id']},
            {'name': 'Proof of Residential Address', 'desc': 'Recent utility bill, lease agreement, or property tax receipt.', 'keywords': ['bill', 'utility', 'lease', 'electric', 'statement']},
            {'name': 'Certified Passport Photographs', 'desc': 'Recent passport-sized photographs conforming to government specifications.', 'keywords': ['photo', 'photograph', 'biometric']},
            {'name': 'Statutory Government Fee Receipt', 'desc': 'Official receipt for application processing fee.', 'keywords': ['fee', 'receipt', 'payment', 'challan']}
        ],
        'clarifications': [
            {'question': 'Which government department, ministry, or consulate issues this service?', 'type': 'institution', 'urgency': 'medium'},
            {'question': 'Is there a processing cutoff or document renewal deadline?', 'type': 'deadline', 'urgency': 'low'}
        ]
    },
    'permit_license': {
        'label': 'Permits & Licenses',
        'keywords': ['permit', 'license', 'building permit', 'driving license', 'driver license', 'trade license', 'business permit', 'zoning', 'occupancy permit'],
        'default_institution': 'Municipal Licensing Authority',
        'standard_requirements': [
            {'name': 'Official Permit / License Application Form', 'desc': 'Completed application detailing activity and location.', 'keywords': ['permit', 'license', 'application', 'form']},
            {'name': 'Proof of Business Registration / Identity', 'desc': 'Incorporation documents, business registration, or driver identity.', 'keywords': ['incorporation', 'registration', 'license', 'id', 'llc']},
            {'name': 'Site Plan / Property Documentation', 'desc': 'Floor plan, site layout, architectural blueprints, or lease deed.', 'keywords': ['plan', 'blueprint', 'property', 'lease', 'deed']},
            {'name': 'Safety & Compliance Inspection Approval', 'desc': 'Fire safety, environmental, or zoning compliance verification.', 'keywords': ['safety', 'inspection', 'compliance', 'approval']},
            {'name': 'Municipal Fee Payment Receipt', 'desc': 'Statutory municipal permit fee payment proof.', 'keywords': ['fee', 'receipt', 'payment']}
        ],
        'clarifications': [
            {'question': 'Which municipal council or licensing board oversees this permit?', 'type': 'institution', 'urgency': 'medium'},
            {'question': 'When must this permit or license be approved to start operations?', 'type': 'deadline', 'urgency': 'medium'}
        ]
    },
    'loan_mortgage': {
        'label': 'Loans, Mortgages & Financing',
        'keywords': ['loan', 'mortgage', 'home loan', 'auto loan', 'credit line', 'financing', 'bank loan', 'borrowing', 'lending'],
        'default_institution': 'Lending Bank / Financial Institution',
        'standard_requirements': [
            {'name': 'Recent 3 Months Paystubs / Income Slips', 'desc': 'Latest verified salary slips or proof of steady income.', 'keywords': ['paystub', 'payslip', 'salary', 'income']},
            {'name': 'Last 2 Years Tax Returns (W-2 / Form 1040 / Form 16)', 'desc': 'Complete federal/state tax returns filed with revenue authorities.', 'keywords': ['tax', '1040', 'w2', 'form 16', 'irs']},
            {'name': 'Last 6 Months Bank & Asset Statements', 'desc': 'Full transaction statements for all checking, savings, and investment accounts.', 'keywords': ['bank', 'statement', 'asset', 'savings']},
            {'name': 'Government-Issued Photo ID', 'desc': 'Valid state driver license, national ID, or passport.', 'keywords': ['license', 'passport', 'id']},
            {'name': 'Credit Check Authorization & Debt Schedule', 'desc': 'Consent to pull credit report and itemized list of existing liabilities.', 'keywords': ['credit', 'consent', 'authorization', 'debt']},
            {'name': 'Property Purchase Contract or Collateral Documents', 'desc': 'Executed purchase agreement, title deed, or collateral appraisal.', 'keywords': ['property', 'contract', 'collateral', 'valuation', 'deed']}
        ],
        'clarifications': [
            {'question': 'Which bank, mortgage lender, or financial institution are you applying with?', 'type': 'institution', 'urgency': 'medium'},
            {'question': 'What is your requested loan amount, down payment, or closing deadline?', 'type': 'financing', 'urgency': 'medium'}
        ]
    },
    'insurance_claim': {
        'label': 'Insurance Claim & Reimbursement',
        'keywords': ['insurance', 'claim', 'reimbursement', 'health claim', 'vehicle claim', 'accident claim', 'loss claim', 'policy claim', 'casualty'],
        'default_institution': 'Insurance Underwriter / Claims Department',
        'standard_requirements': [
            {'name': 'Completed & Signed Insurance Claim Form', 'desc': 'Official claim declaration form detailing policy information.', 'keywords': ['claim form', 'claim', 'form']},
            {'name': 'Detailed Incident & Damage Report', 'desc': 'Chronological narrative of the loss event, damages, or medical diagnosis.', 'keywords': ['incident', 'loss', 'damage', 'report']},
            {'name': 'Itemized Invoices / Repair Estimates / Hospital Bills', 'desc': 'Itemized contractor estimates, mechanic invoices, or hospital billing summaries.', 'keywords': ['bill', 'invoice', 'estimate', 'medical', 'repair', 'receipt']},
            {'name': 'Police FIR or Incident Report (if applicable)', 'desc': 'Official law enforcement or security report for theft, vandalism, or traffic collision.', 'keywords': ['police', 'fir', 'report', 'incident']},
            {'name': 'Proof of Out-of-Pocket Payment', 'desc': 'Bank receipts, credit card slips, or payment confirmations for expenses incurred.', 'keywords': ['receipt', 'payment', 'proof of payment']},
            {'name': 'Insurance Policy Document & Policyholder ID', 'desc': 'Policy schedule copy showing coverage limits and insured party identity.', 'keywords': ['policy', 'insurance', 'id', 'passport']}
        ],
        'clarifications': [
            {'question': 'What is your insurance policy number, claim reference, or date of loss?', 'type': 'claim_ref', 'urgency': 'high'},
            {'question': 'What is the insurer or underwriter name handling this claim?', 'type': 'institution', 'urgency': 'medium'}
        ]
    },
    'rental_application': {
        'label': 'Rental & Housing Application',
        'keywords': ['rental', 'apartment', 'lease', 'tenancy', 'tenant', 'landlord', 'housing application', 'renting', 'flat lease'],
        'default_institution': 'Property Management / Landlord',
        'standard_requirements': [
            {'name': 'Completed Residential Tenancy / Lease Application', 'desc': 'Personal information, household occupants, and tenancy history.', 'keywords': ['tenancy', 'lease', 'rental', 'application']},
            {'name': 'Proof of Verifiable Monthly Income', 'desc': 'Recent 3 paystubs or 3 months bank statements showing regular deposits.', 'keywords': ['paystub', 'salary', 'bank', 'statement', 'income']},
            {'name': 'Government-Issued Photo ID', 'desc': 'Valid driver license, state identity card, or passport.', 'keywords': ['license', 'id', 'passport']},
            {'name': 'Prior Landlord Reference Contact Information', 'desc': 'Letters of recommendation or contact records from previous tenancy.', 'keywords': ['landlord', 'reference', 'rental history']},
            {'name': 'Credit & Background Check Authorization', 'desc': 'Signed consent allowing landlord to conduct background and credit check.', 'keywords': ['credit', 'background', 'consent', 'authorization']},
            {'name': 'Holding Deposit / Security Deposit Receipt', 'desc': 'Payment receipt for initial deposit or screening fees.', 'keywords': ['deposit', 'receipt', 'fee', 'payment']}
        ],
        'clarifications': [
            {'question': 'What is the rental property address or property management agency name?', 'type': 'institution', 'urgency': 'medium'},
            {'question': 'What is your anticipated lease start date or move-in deadline?', 'type': 'deadline', 'urgency': 'high'}
        ]
    },
    'visa_immigration': {
        'label': 'Visa & Immigration',
        'keywords': ['visa', 'immigration', 'schengen', 'consulate', 'embassy', 'permanent residency', 'green card', 'entry permit', 'work permit'],
        'default_institution': 'Consulate / Immigration Department',
        'standard_requirements': [
            {'name': 'Valid Passport Copy', 'desc': 'Passport with at least 6 months validity remaining.', 'keywords': ['passport', 'id']},
            {'name': 'Proof of Financial Means (Bank Statement)', 'desc': 'Bank statements from past 3–6 months demonstrating sufficient funds.', 'keywords': ['bank', 'statement', 'financial', 'funds']},
            {'name': 'Completed Official Visa Application Form', 'desc': 'Fully signed national or Schengen visa application form.', 'keywords': ['visa', 'application', 'form']},
            {'name': 'Biometrics & Photographs', 'desc': 'ICAO-compliant photographs and biometric appointment notice.', 'keywords': ['photo', 'photograph', 'biometric']},
            {'name': 'Travel Health Insurance Certificate', 'desc': 'Comprehensive international medical insurance covering the minimum required threshold.', 'keywords': ['insurance', 'health', 'travel']},
            {'name': 'Proof of Accommodation & Travel Itinerary', 'desc': 'Hotel bookings, host invitation letter, or round-trip flight reservations.', 'keywords': ['hotel', 'itinerary', 'flight', 'accommodation']},
            {'name': 'Visa Processing Fee Payment Receipt', 'desc': 'Official consular fee payment voucher.', 'keywords': ['receipt', 'fee', 'payment']}
        ],
        'clarifications': [
            {'question': 'Which country or consulate are you applying to for this visa?', 'type': 'institution', 'urgency': 'high'},
            {'question': 'What is your appointment date or planned travel deadline?', 'type': 'deadline', 'urgency': 'high'}
        ]
    },
    'custom': {
        'label': 'Custom Workflow',
        'keywords': [],
        'default_institution': 'Target Authority / Recipient',
        'standard_requirements': [
            {'name': 'Preliminary Research & Documentation Gathering', 'desc': 'Assemble essential preliminary records and background info.', 'keywords': ['document', 'record', 'information']},
            {'name': 'Preparation & Review of Primary Application Form', 'desc': 'Complete all sections of the application dossier with verification.', 'keywords': ['form', 'application', 'submission']},
            {'name': 'Primary Identification & Verification Records', 'desc': 'Certified government ID, address proof, or registration records.', 'keywords': ['id', 'passport', 'license', 'bill']},
            {'name': 'Formal Submission to Target Authority', 'desc': 'Submit dossier through official portal or physical submission desk.', 'keywords': ['submission', 'filing', 'delivery']},
            {'name': 'Post-Submission Confirmation & Reference Tracking', 'desc': 'Retain acknowledgment receipt, reference tracking number, and timestamps.', 'keywords': ['receipt', 'confirmation', 'tracking']}
        ],
        'clarifications': [
            {'question': 'What is your target submission cutoff date or preferred timeline?', 'type': 'deadline', 'urgency': 'medium'},
            {'question': 'Which specific authority, organization, or recipient will receive this application?', 'type': 'institution', 'urgency': 'medium'},
            {'question': 'Do you have an official guideline PDF or checklist to upload to Smart Memory for 100% verified requirements?', 'type': 'guideline_upload', 'urgency': 'low'}
        ]
    }
}

def infer_application_category(goal: str, institution: Optional[str] = None) -> str:
    """Infers the application category using domain keywords and regex matching."""
    combined = (goal + ' ' + (institution or '')).lower()
    for cat, meta in APPLICATION_CATEGORIES_METADATA.items():
        if cat == 'custom':
            continue
        for kw in meta['keywords']:
            if re.search(r'\b' + re.escape(kw) + r'\b', combined):
                return cat
    return 'custom'

def generate_application_proposal(
    user_id: str,
    goal: str,
    institution: Optional[str] = None,
    doc_id: Optional[str] = None,
    category_override: Optional[str] = None
) -> Dict[str, Any]:
    """
    Signature Application Companion engine supporting general-purpose applications:
    - University admissions, scholarships, jobs, internships, government services,
      permits, loans, insurance claims, rental applications, and custom workflows.
    - Grounded in Smart Memory documents and extracted facts.
    - Distinguishes verified official requirements from standard suggestions.
    - Formulates clarifying questions when key information is absent.
    - Requires user confirmation before creating any tasks.
    """
    user_docs = database.get_documents(user_id)
    user_facts = database.get_extracted_facts(user_id)

    # 1. Infer or validate category
    if category_override and category_override in APPLICATION_CATEGORIES_METADATA:
        category = category_override
    else:
        category = infer_application_category(goal, institution)

    category_info = APPLICATION_CATEGORIES_METADATA.get(category, APPLICATION_CATEGORIES_METADATA['custom'])
    category_label = category_info['label']

    resolved_institution = institution.strip() if institution and institution.strip() else ""
    resolved_deadline: Optional[str] = None
    is_deadline_verified = False
    deadline_source: Optional[str] = None

    # 2. Check Smart Memory for official guideline / application documents
    target_doc = None
    if doc_id:
        target_doc = next((d for d in user_docs if d["id"] == doc_id), None)
    if not target_doc:
        # Only match if document name/summary has substantive overlap with goal or category keywords
        stop_words = {'apply', 'application', 'file', 'submit', 'please', 'with', 'from', 'this', 'that', 'your', 'need'}
        goal_words = {w for w in re.findall(r'\w+', goal.lower()) if len(w) > 3 and w not in stop_words}
        cat_keywords = set(category_info.get('keywords', []))
        for d in user_docs:
            d_corpus = (d["original_name"] + " " + (d.get("summary") or "")).lower()
            if any(re.search(r'\b' + re.escape(w) + r'\b', d_corpus) for w in goal_words):
                target_doc = d
                break
            if cat_keywords and any(re.search(r'\b' + re.escape(kw) + r'\b', d_corpus) for kw in cat_keywords):
                target_doc = d
                break

    verified_requirements: List[Dict[str, Any]] = []
    if target_doc:
        doc_facts = [f for f in user_facts if f.get("document_id") == target_doc["id"]]
        # Check for extracted requirement facts
        for f in doc_facts:
            if f.get("fact_type") == "requirement":
                verified_requirements.append({
                    "name": f["value"],
                    "desc": f"Verified official requirement from {target_doc['original_name']}.",
                    "keywords": re.findall(r'\w+', f["value"].lower()),
                    "is_verified": True,
                    "source_type": "verified",
                    "source_reference": f"Official Document: {target_doc['original_name']} (Page {f.get('page_number', 1)})"
                })
            elif f.get("fact_type") == "deadline" and not resolved_deadline:
                resolved_deadline = f["value"]
                is_deadline_verified = True
                deadline_source = f"Extracted from {target_doc['original_name']} (Page {f.get('page_number', 1)})"
            elif f.get("fact_type") == "institution" and not resolved_institution:
                resolved_institution = f["value"]

    # 3. Assemble complete requirements list (verified official first, then standard suggestions)
    combined_reqs: List[Dict[str, Any]] = list(verified_requirements)
    verified_names_lower = [r["name"].lower() for r in verified_requirements]

    # Append standard template requirements not already represented in verified facts
    for std_req in category_info['standard_requirements']:
        if not any(std_req['name'].lower() in v or v in std_req['name'].lower() for v in verified_names_lower):
            combined_reqs.append({
                "name": std_req["name"],
                "desc": std_req["desc"],
                "keywords": std_req["keywords"],
                "is_verified": False,
                "source_type": "suggestion",
                "source_reference": "Standard Category Practice"
            })

    if not resolved_institution:
        resolved_institution = category_info['default_institution']

    # 4. Formulate Application Title
    if resolved_institution and resolved_institution not in category_info['default_institution']:
        title = f"{resolved_institution} — {category_label}"
    else:
        title = f"{goal.strip().capitalize()}"

    # 5. Match available user documents from Smart Memory
    checklist_items = []
    for idx, req in enumerate(combined_reqs):
        matched_doc = None
        for doc in user_docs:
            doc_text_corpus = (doc["original_name"] + " " + (doc.get("summary") or "")).lower()
            if any(re.search(r'\b' + re.escape(k) + r'\b', doc_text_corpus) for k in req["keywords"]):
                matched_doc = doc
                break

        checklist_items.append({
            "order_index": idx,
            "title": f"Provide {req['name']}",
            "description": req["desc"],
            "required_document": req["name"],
            "matched_document_id": matched_doc["id"] if matched_doc else None,
            "matched_document_name": matched_doc["original_name"] if matched_doc else None,
            "is_verified": req["is_verified"],
            "source_type": req["source_type"],
            "source_reference": req["source_reference"],
            "deadline": resolved_deadline,
            "status": "completed" if matched_doc else "pending"
        })

    missing_docs = [it["required_document"] for it in checklist_items if not it["matched_document_id"]]
    matched_count = len(checklist_items) - len(missing_docs)
    verified_count = sum(1 for it in checklist_items if it.get("is_verified"))
    suggested_count = len(checklist_items) - verified_count

    # 6. Generate Clarifying Questions when important information is missing
    clarifying_questions = []
    if not resolved_deadline:
        clarifying_questions.append({
            "type": "deadline",
            "question": "What is your target submission deadline or intake cutoff date?",
            "urgency": "high"
        })
    if not institution or not institution.strip():
        clarifying_questions.append({
            "type": "institution",
            "question": f"Which specific authority, organization, or recipient will receive this application?",
            "urgency": "medium"
        })
    if not target_doc:
        clarifying_questions.append({
            "type": "guideline_upload",
            "question": "Do you have an official guideline PDF or application checklist to upload to Smart Memory? Doing so unlocks 100% verified requirements.",
            "urgency": "low"
        })

    # Add category-specific clarifications
    for cq in category_info.get('clarifications', []):
        if not any(existing['type'] == cq['type'] for existing in clarifying_questions):
            clarifying_questions.append(cq)

    # 7. Formulate actionable recommendation
    if verified_count > 0:
        ver_text = f"Includes {verified_count} verified official requirement(s) from your vault."
    else:
        ver_text = "Checklist is based on standard best-practice requirements for this category."

    if missing_docs:
        rec_text = (
            f"You have {matched_count} of {len(checklist_items)} required items ready in Smart Memory. {ver_text} "
            f"Next recommended action: Upload or prepare your {missing_docs[0]}."
        )
    else:
        rec_text = f"All {len(checklist_items)} required documents are ready in your vault! {ver_text} Ready to confirm and begin tracking."

    return {
        "title": title,
        "goal": goal,
        "category": category,
        "category_label": category_label,
        "institution": resolved_institution,
        "deadline": resolved_deadline,
        "is_deadline_verified": is_deadline_verified,
        "deadline_source": deadline_source,
        "total_requirements": len(checklist_items),
        "matched_count": matched_count,
        "verified_requirements_count": verified_count,
        "suggested_requirements_count": suggested_count,
        "missing_documents": missing_docs,
        "checklist_proposal": checklist_items,
        "clarifying_questions": clarifying_questions[:3],
        "recommendation": rec_text,
        "supported_categories": [
            {"key": k, "label": v["label"]}
            for k, v in APPLICATION_CATEGORIES_METADATA.items()
        ]
    }

def generate_daily_briefing(user_id: str) -> Dict[str, Any]:
    """
    Generates a personalized daily briefing for the dashboard.
    """
    profile = database.get_profile(user_id) or {}
    user_name = profile.get("full_name", "User")
    user_tz_str = profile.get("timezone") or "UTC"
    try:
        user_tz = ZoneInfo(user_tz_str)
        now_user = datetime.now(user_tz)
        today_date = now_user.date()
    except Exception:
        today_date = date.today()
    today_display = today_date.strftime("%d/%m/%Y")
    today_iso = today_date.isoformat()

    bills = database.get_bills(user_id)
    events = database.get_events(user_id)
    reminders = database.get_reminders(user_id)
    workflows = database.get_application_workflows(user_id)
    family = database.get_family_members(user_id)

    pending_bills = [b for b in bills if b["status"] != "paid"]
    active_reminders = [r for r in reminders if r["status"] == "scheduled"]
    in_progress_apps = [w for w in workflows if w["status"] != "completed"]

    greeting = f"Welcome, {user_name}."
    agenda_highlights = []

    if events:
        agenda_highlights.append(f"{len(events)} upcoming appointment(s)")
    if pending_bills:
        agenda_highlights.append(f"{len(pending_bills)} pending bill(s)")
    if in_progress_apps:
        agenda_highlights.append(f"{len(in_progress_apps)} active application(s)")

    summary_text = (
        f"You have {', '.join(agenda_highlights)}." if agenda_highlights 
        else "Your schedule is clear today with no urgent tasks or pending deadlines."
    )

    # Generate Smart Alerts
    alerts = []
    # 1. Approaching Bills
    for b in pending_bills:
        amt_str = format_curr_val(b['amount'], b.get('currency', 'INR'))
        due_date_formatted = format_date_dmy(b.get('due_date'))
        alerts.append({
            "type": "bill_due",
            "severity": "high",
            "title": f"Bill Due Soon: {b['title']}",
            "description": f"{amt_str} due on {due_date_formatted} ({b['biller']}).",
            "action_text": "Mark as Paid",
            "action_url": "/bills"
        })

    # 2. Incomplete Application Steps
    for wf in in_progress_apps:
        pending_items = [it for it in wf.get("checklist_items", []) if it["status"] != "completed"]
        if pending_items:
            first_pending = pending_items[0]
            alerts.append({
                "type": "missing_doc",
                "severity": "medium",
                "title": f"Action Required for {wf['title']}",
                "description": f"Next step: {first_pending['title']}. Missing {first_pending.get('required_document') or 'document'}.",
                "action_text": "View Checklist",
                "action_url": "/applications"
            })

    # 3. Family Birthdays
    for m in family:
        if m.get("birthday"):
            alerts.append({
                "type": "family_birthday",
                "severity": "info",
                "title": f"Family Birthday: {m['name']}",
                "description": f"{m['relationship'].capitalize()} birthday noted on {format_date_dmy(m.get('birthday'))}.",
                "action_text": "View Calendar",
                "action_url": "/calendar"
            })

    return {
        "greeting": greeting,
        "date": today_display,
        "date_iso": today_iso,
        "summary": summary_text,
        "stats": {
            "pending_bills": len(pending_bills),
            "upcoming_events": len(events),
            "active_reminders": len(active_reminders),
            "active_workflows": len(in_progress_apps)
        },
        "alerts": alerts
    }

def extract_facts_with_ai(full_text: str, metadata: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """
    Uses Gemini LLM to extract verified structured facts conforming strictly to schema.
    Returns None if LLM is unavailable or fails schema validation.
    """
    if not Config.GEMINI_API_KEY:
        return None

    system_instruction = (
        "You are Orbi's Document Intelligence Extraction Engine. "
        "Analyze the provided document text and extract structured, verified facts. "
        "Strict Guidelines:\n"
        "1. NEVER fabricate, extrapolate, or invent details not explicitly present in the text.\n"
        "2. If this is an educational or research paper (e.g. machine learning, science, textbook), "
        "classify category as 'education', identify Document Title, Subject/Topic, Core Concepts/Headings, "
        "and set an Action Status fact stating no payment or filing is required.\n"
        "3. If this is a bill or invoice, extract Total Amount Due (with currency), Due Date, and Biller Name.\n"
        "4. If this is an application notice, extract Institution, Deadlines, and Required Checklist Documents.\n"
        "5. Output ONLY valid, raw JSON conforming to this schema without any markdown backticks or commentary:\n"
        "{\n"
        '  "category": "education | bill | application | medical | legal | government | financial | general",\n'
        '  "title": "Document Title",\n'
        '  "summary": "Executive summary (2-3 sentences)",\n'
        '  "facts": [\n'
        "    {\n"
        '      "fact_type": "title | structure | topic | amount | deadline | date | institution | requirement | status",\n'
        '      "label": "Fact Label",\n'
        '      "value": "Fact Value",\n'
        '      "confidence": 0.95,\n'
        '      "page_number": 1,\n'
        '      "source_snippet": "Exact text snippet from document"\n'
        "    }\n"
        "  ]\n"
        "}"
    )

    sample_text = full_text[:6000]
    prompt = f"Metadata: {json.dumps(metadata or {})}\n\nDocument Text:\n{sample_text}"
    raw_response = call_gemini_api(prompt, system_instruction)

    if not raw_response:
        return None

    try:
        # Clean response if markdown code block is wrapped
        cleaned = raw_response.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        elif cleaned.startswith("```"):
            cleaned = cleaned[3:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()

        data = json.loads(cleaned)

        # Schema Validation
        valid_categories = {"education", "bill", "application", "medical", "legal", "government", "financial", "general"}
        category = data.get("category", "").lower()
        if category not in valid_categories:
            category = "general"

        facts = data.get("facts")
        if not isinstance(facts, list) or len(facts) == 0:
            return None

        sanitized_facts = []
        for f in facts:
            if not isinstance(f, dict):
                continue
            label = str(f.get("label", "")).strip()
            value = str(f.get("value", "")).strip()
            if not label or not value:
                continue

            sanitized_facts.append({
                "fact_type": str(f.get("fact_type", "general")),
                "label": label,
                "value": value,
                "confidence": min(1.0, max(0.1, float(f.get("confidence", 0.9)))),
                "page_number": max(1, int(f.get("page_number", 1))),
                "source_snippet": str(f.get("source_snippet", value))[:200]
            })

        if not sanitized_facts:
            return None

        return {
            "category": category,
            "title": str(data.get("title", "")).strip(),
            "summary": str(data.get("summary", "")).strip(),
            "facts": sanitized_facts
        }
    except Exception as e:
        print(f"Error parsing AI document extraction response: {e}")
        return None

