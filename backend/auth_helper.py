from functools import wraps
from flask import request, jsonify
import database

DEFAULT_DEMO_USER_ID = "demo-user-00000000-0000-0000-0000-000000000001"

def get_current_user_id() -> str:
    """
    Extracts user_id from Authorization Bearer token or X-User-Id header.
    In local development / demo mode, falls back to a persistent demo user.
    """
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1].strip()
        if token and token != "undefined" and token != "null":
            # If token is a raw UUID or userId, return it directly
            return token

    custom_user_id = request.headers.get("X-User-Id", "")
    if custom_user_id:
        return custom_user_id

    return DEFAULT_DEMO_USER_ID

def require_auth(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = get_current_user_id()
        if not user_id:
            return jsonify({"error": "Unauthorized access. Please log in."}), 401
        database.ensure_user_profile(user_id)
        return f(user_id, *args, **kwargs)
    return decorated_function
