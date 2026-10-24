import uuid
from flask import Blueprint, request, jsonify
from auth_helper import get_current_user_id, DEFAULT_DEMO_USER_ID
import database

auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')

@auth_bp.route('/session', methods=['GET'])
def get_session():
    user_id = get_current_user_id()
    profile = database.get_profile(user_id)
    if not profile:
        # Create initial profile for the user
        profile = database.upsert_profile(user_id, {
            "full_name": "Alex Mercer",
            "email": "alex.mercer@example.com",
            "profession": "Working Professional",
            "timezone": "America/New_York",
            "preferred_language": "en",
            "onboarding_completed": 0
        })
    prefs = database.get_preferences(user_id)
    return jsonify({
        "authenticated": True,
        "user_id": user_id,
        "profile": profile,
        "preferences": prefs
    })

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get("email", "").strip()
    password = data.get("password", "")

    if not email:
        return jsonify({"error": "Email is required"}), 400

    # Find profile by email or create session user ID based on email
    conn = database.get_db_connection()
    row = conn.execute("SELECT id FROM profiles WHERE email = ?", (email,)).fetchone()
    conn.close()

    if row:
        user_id = row['id']
    else:
        # Simple deterministic ID for demo login or generate new
        user_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, email))
        database.upsert_profile(user_id, {
            "email": email,
            "full_name": email.split('@')[0].capitalize(),
            "onboarding_completed": 0
        })

    profile = database.get_profile(user_id)
    prefs = database.get_preferences(user_id)

    return jsonify({
        "success": True,
        "token": user_id,
        "user": profile,
        "preferences": prefs
    })

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    email = data.get("email", "").strip()
    full_name = data.get("full_name", "").strip()

    if not email or not full_name:
        return jsonify({"error": "Full name and email are required"}), 400

    user_id = str(uuid.uuid4())
    profile = database.upsert_profile(user_id, {
        "email": email,
        "full_name": full_name,
        "onboarding_completed": 0
    })

    return jsonify({
        "success": True,
        "token": user_id,
        "user": profile
    })

@auth_bp.route('/logout', methods=['POST'])
def logout():
    return jsonify({"success": True, "message": "Logged out successfully"})
