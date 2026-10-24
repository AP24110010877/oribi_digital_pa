from flask import Blueprint, request, jsonify
from auth_helper import require_auth
from datetime import datetime, timezone
import database

bill_bp = Blueprint('bills', __name__, url_prefix='/api/bills')

@bill_bp.route('', methods=['GET'])
@require_auth
def list_bills(user_id: str):
    status = request.args.get('status')
    bills = database.get_bills(user_id, status=status)
    
    # Calculate overdue status dynamically
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for b in bills:
        if b['status'] == 'upcoming' and b['due_date'] < today_str:
            b['status'] = 'overdue'

    return jsonify(bills)

@bill_bp.route('', methods=['POST'])
@require_auth
def create_bill_route(user_id: str):
    data = request.get_json() or {}
    if not data.get('title') or not data.get('amount') or not data.get('due_date'):
        return jsonify({"error": "Title, amount, and due date are required"}), 400

    bill = database.create_bill(user_id, data)
    
    # Auto-schedule advance reminder if requested
    adv_days = int(data.get('advance_reminder_days', 3))
    database.create_reminder(user_id, {
        "title": f"Upcoming Bill Due: {bill['title']} ({bill['currency']} {bill['amount']})",
        "due_time": f"{bill['due_date']}T09:00:00",
        "reminder_type": "one_time",
        "status": "scheduled",
        "advance_minutes": adv_days * 1440,
        "target_id": bill['id'],
        "target_type": "bill"
    })

    return jsonify(bill), 201

@bill_bp.route('/<bill_id>', methods=['PUT'])
@require_auth
def update_bill_route(user_id: str, bill_id: str):
    data = request.get_json() or {}
    updated = database.update_bill(bill_id, user_id, data)
    if not updated:
        return jsonify({"error": "Bill not found"}), 404
    return jsonify(updated)

@bill_bp.route('/<bill_id>/status', methods=['PATCH'])
@require_auth
def update_bill_status_route(user_id: str, bill_id: str):
    data = request.get_json() or {}
    new_status = data.get('status')
    if not new_status or new_status not in ['upcoming', 'paid', 'overdue', 'cancelled']:
        return jsonify({"error": "Invalid bill status"}), 400

    updated = database.update_bill(bill_id, user_id, {"status": new_status})
    if not updated:
        return jsonify({"error": "Bill not found"}), 404

    return jsonify({
        "success": True,
        "message": f"Bill status manually marked as {new_status}. Note: No external banking transaction took place.",
        "bill": updated
    })

@bill_bp.route('/<bill_id>', methods=['DELETE'])
@require_auth
def delete_bill_route(user_id: str, bill_id: str):
    deleted = database.delete_bill(bill_id, user_id)
    return jsonify({"success": deleted})
