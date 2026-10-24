from flask import Blueprint, request, jsonify
from auth_helper import require_auth
from services.ai_service import answer_user_query
import database

assistant_bp = Blueprint('assistant', __name__, url_prefix='/api/assistant')

@assistant_bp.route('/ask', methods=['POST'])
@require_auth
def ask_assistant(user_id: str):
    data = request.get_json() or {}
    query = data.get("query", "").strip()
    if not query:
        return jsonify({"error": "Query cannot be empty"}), 400

    # Save user message to conversation history
    database.save_conversation_message(user_id, "user", query)

    # Answer query using user records
    result = answer_user_query(user_id, query)

    # Save assistant response to conversation history
    database.save_conversation_message(
        user_id,
        "assistant",
        result["answer"],
        source_references=result.get("source_references")
    )

    return jsonify({
        "answer": result["answer"],
        "source_references": result.get("source_references", [])
    })

@assistant_bp.route('/history', methods=['GET'])
@require_auth
def get_history(user_id: str):
    limit = int(request.args.get("limit", 40))
    messages = database.get_conversation_history(user_id, limit=limit)
    return jsonify(messages)
