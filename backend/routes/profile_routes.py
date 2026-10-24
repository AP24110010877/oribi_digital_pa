from flask import Blueprint, request, jsonify
from auth_helper import require_auth
import database

profile_bp = Blueprint('profile', __name__, url_prefix='/api/profile')

@profile_bp.route('', methods=['GET'])
@require_auth
def get_profile_route(user_id: str):
    profile = database.get_profile(user_id)
    prefs = database.get_preferences(user_id)
    family = database.get_family_members(user_id)
    return jsonify({
        "profile": profile,
        "preferences": prefs,
        "family": family
    })

@profile_bp.route('', methods=['PUT'])
@require_auth
def update_profile_route(user_id: str):
    data = request.get_json() or {}
    updated = database.upsert_profile(user_id, data)
    return jsonify({"success": True, "profile": updated})

@profile_bp.route('/preferences', methods=['GET'])
@require_auth
def get_preferences_route(user_id: str):
    prefs = database.get_preferences(user_id)
    return jsonify(prefs)

@profile_bp.route('/preferences', methods=['PUT'])
@require_auth
def update_preferences_route(user_id: str):
    data = request.get_json() or {}
    prefs = database.update_preferences(user_id, data)
    return jsonify({"success": True, "preferences": prefs})

@profile_bp.route('/family', methods=['GET'])
@require_auth
def get_family_route(user_id: str):
    members = database.get_family_members(user_id)
    return jsonify(members)

@profile_bp.route('/family', methods=['POST'])
@require_auth
def create_family_route(user_id: str):
    data = request.get_json() or {}
    if not data.get("name") or not data.get("relationship"):
        return jsonify({"error": "Name and relationship are required"}), 400
    member = database.create_family_member(user_id, data)
    return jsonify(member), 201

@profile_bp.route('/family/<member_id>', methods=['PUT'])
@require_auth
def update_family_member_route(user_id: str, member_id: str):
    data = request.get_json() or {}
    updated = database.update_family_member(member_id, user_id, data)
    if not updated:
        return jsonify({"error": "Member not found"}), 404
    return jsonify(updated)

@profile_bp.route('/family/<member_id>', methods=['DELETE'])
@require_auth
def delete_family_member_route(user_id: str, member_id: str):
    deleted = database.delete_family_member(member_id, user_id)
    return jsonify({"success": deleted})

@profile_bp.route('/onboarding', methods=['POST'])
@require_auth
def complete_onboarding_route(user_id: str):
    """
    Saves complete 4-step onboarding state in one transaction:
    - Step 1: Personal info
    - Step 2: Family members & wedding anniversary
    - Step 3: Preferences
    - Step 4: Marks onboarding_completed = 1
    """
    data = request.get_json() or {}
    personal = data.get("personal", {})
    family_list = data.get("family", [])
    preferences = data.get("preferences", {})

    # Save profile
    profile_data = {
        "full_name": personal.get("full_name"),
        "email": personal.get("email"),
        "dob": personal.get("dob"),
        "profession": personal.get("profession", "Other"),
        "timezone": personal.get("timezone", "UTC"),
        "preferred_language": personal.get("preferred_language", "en"),
        "wedding_anniversary": personal.get("wedding_anniversary"),
        "onboarding_completed": 1
    }
    updated_profile = database.upsert_profile(user_id, profile_data)

    # Save preferences
    if preferences:
        database.update_preferences(user_id, preferences)

    # Save family members
    for member in family_list:
        if member.get("name") and member.get("relationship"):
            database.create_family_member(user_id, member)

    # Create an initial welcome notification
    database.create_notification(
        user_id=user_id,
        title="Welcome to Orbi!",
        message="Your digital PA is initialized and ready to assist you. Upload your first document to start organizing.",
        alert_type="info"
    )

    return jsonify({
        "success": True,
        "message": "Onboarding completed successfully",
        "profile": updated_profile
    })
