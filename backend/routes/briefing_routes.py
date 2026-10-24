from flask import Blueprint, request, jsonify
from auth_helper import require_auth
from services.ai_service import generate_daily_briefing
import database

briefing_bp = Blueprint('briefing', __name__, url_prefix='/api/briefing')

@briefing_bp.route('/today', methods=['GET'])
@require_auth
def get_today_briefing(user_id: str):
    briefing = generate_daily_briefing(user_id)
    return jsonify(briefing)

@briefing_bp.route('/notifications', methods=['GET'])
@require_auth
def get_user_notifications(user_id: str):
    notifs = database.get_notifications(user_id)
    return jsonify(notifs)

@briefing_bp.route('/notifications/<notif_id>/read', methods=['POST'])
@require_auth
def mark_read(user_id: str, notif_id: str):
    success = database.mark_notification_read(notif_id, user_id)
    return jsonify({"success": success})
