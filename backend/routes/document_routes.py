import os
import uuid
import re
from datetime import datetime, timezone, timedelta
from werkzeug.utils import secure_filename
from flask import Blueprint, request, jsonify, send_file
from config import Config
from auth_helper import require_auth
from services.pdf_service import extract_pdf_data
import database

document_bp = Blueprint('documents', __name__, url_prefix='/api/documents')

@document_bp.route('', methods=['GET'])
@require_auth
def list_documents(user_id: str):
    search = request.args.get('search')
    category = request.args.get('category')
    docs = database.get_documents(user_id, search=search, category=category)
    return jsonify(docs)

@document_bp.route('', methods=['POST'])
@require_auth
def upload_document(user_id: str):
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No file selected"}), 400

    if not file.filename.lower().endswith('.pdf'):
        return jsonify({"error": "Only PDF files are supported for secure extraction"}), 400

    filename = secure_filename(file.filename)
    unique_name = f"{uuid.uuid4()}_{filename}"
    save_path = os.path.join(Config.UPLOAD_FOLDER, unique_name)
    file.save(save_path)

    file_size = os.path.getsize(save_path)

    # Extract data with PyMuPDF
    extraction = extract_pdf_data(save_path)

    doc_category = extraction.get("category", "general")
    doc_summary = extraction.get("summary", "")
    raw_text = extraction.get("raw_text", "")
    facts = extraction.get("facts", [])
    extracted_entities = extraction.get("extracted_entities", {})

    # Save document record
    doc = database.create_document(user_id, {
        "filename": unique_name,
        "original_name": filename,
        "file_size": file_size,
        "mime_type": "application/pdf",
        "storage_path": save_path,
        "category": doc_category,
        "status": "processed" if extraction.get("success") else "error",
        "summary": doc_summary,
        "raw_text": raw_text,
        "extracted_data": extraction
    })

    # Save extracted facts
    saved_facts = []
    for f in facts:
        saved_fact = database.create_extracted_fact(user_id, doc["id"], f)
        saved_facts.append(saved_fact)

    # If it's a bill, automatically add to bills list with extracted details
    if doc_category == "bill" and extracted_entities.get("amounts"):
        raw_amt = extracted_entities["amounts"][0]
        # Clean currency symbol
        cleaned_num = re.sub(r'[^\d.]', '', raw_amt)
        try:
            amt_val = float(cleaned_num)
        except ValueError:
            amt_val = 0.0

        due_date = extracted_entities.get("dates", [None])[0] if extracted_entities.get("dates") else None
        if not due_date:
            # Fallback: 30 days from today
            due_date = (datetime.now(timezone.utc) + timedelta(days=30)).strftime("%Y-%m-%d")
        biller_name = extracted_entities.get("institutions", ["Utility / Service Provider"])[0] if extracted_entities.get("institutions") else "Utility Provider"

        detected_curr = "INR"
        raw_amt_lower = raw_amt.lower()
        if "$" in raw_amt:
            detected_curr = "USD"
        elif "€" in raw_amt:
            detected_curr = "EUR"
        elif "£" in raw_amt:
            detected_curr = "GBP"
        elif any(sym in raw_amt_lower for sym in ["₹", "rs", "inr"]):
            detected_curr = "INR"

        database.create_bill(user_id, {
            "document_id": doc["id"],
            "title": f"Bill from {biller_name}",
            "biller": biller_name,
            "amount": amt_val,
            "currency": detected_curr,
            "due_date": due_date,
            "status": "upcoming",
            "advance_reminder_days": 3,
            "notes": f"Auto-extracted from {filename}"
        })

    return jsonify({
        "success": True,
        "document": doc,
        "facts": saved_facts,
        "extraction_warning": extraction.get("warning")
    }), 201

@document_bp.route('/<doc_id>', methods=['GET'])
@require_auth
def get_document_details(user_id: str, doc_id: str):
    doc = database.get_document(doc_id, user_id)
    if not doc:
        return jsonify({"error": "Document not found"}), 404
    facts = database.get_extracted_facts(user_id, doc_id)
    return jsonify({
        "document": doc,
        "facts": facts
    })

@document_bp.route('/<doc_id>', methods=['DELETE'])
@require_auth
def delete_document_route(user_id: str, doc_id: str):
    doc = database.get_document(doc_id, user_id)
    if not doc:
        return jsonify({"error": "Document not found"}), 404

    # Remove file from disk
    if os.path.exists(doc['storage_path']):
        try:
            os.remove(doc['storage_path'])
        except Exception:
            pass

    deleted = database.delete_document(doc_id, user_id)
    return jsonify({"success": deleted})

@document_bp.route('/<doc_id>/download', methods=['GET'])
@require_auth
def download_document(user_id: str, doc_id: str):
    doc = database.get_document(doc_id, user_id)
    if not doc or not os.path.exists(doc['storage_path']):
        return jsonify({"error": "File not found"}), 404
    return send_file(doc['storage_path'], as_attachment=True, download_name=doc['original_name'])

@document_bp.route('/facts/<fact_id>', methods=['PUT'])
@require_auth
def update_fact_route(user_id: str, fact_id: str):
    data = request.get_json() or {}
    updated = database.update_extracted_fact(fact_id, user_id, data)
    if not updated:
        return jsonify({"error": "Fact not found"}), 404
    return jsonify(updated)

@document_bp.route('/<doc_id>/reprocess', methods=['POST'])
@require_auth
def reprocess_document(user_id: str, doc_id: str):
    doc = database.get_document(doc_id, user_id)
    if not doc or not os.path.exists(doc['storage_path']):
        return jsonify({"error": "Document not found"}), 404

    extraction = extract_pdf_data(doc['storage_path'])
    if not extraction.get("success"):
        return jsonify({"error": extraction.get("error", "Extraction failed")}), 400

    doc_category = extraction.get("category", "general")
    doc_summary = extraction.get("summary", "")
    raw_text = extraction.get("raw_text", "")
    facts = extraction.get("facts", [])

    database.update_document(doc_id, user_id, {
        "category": doc_category,
        "summary": doc_summary,
        "raw_text": raw_text,
        "extracted_data": extraction
    })

    # Clear and re-populate facts
    conn = database.get_db_connection()
    conn.execute("DELETE FROM extracted_facts WHERE user_id = ? AND document_id = ?", (user_id, doc_id))
    conn.commit()
    conn.close()

    saved_facts = []
    for f in facts:
        saved_fact = database.create_extracted_fact(user_id, doc_id, f)
        saved_facts.append(saved_fact)

    updated_doc = database.get_document(doc_id, user_id)
    return jsonify({
        "success": True,
        "document": updated_doc,
        "facts": saved_facts,
        "extraction_warning": extraction.get("warning")
    })

