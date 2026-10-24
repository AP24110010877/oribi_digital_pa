from flask import Blueprint, request, jsonify
from auth_helper import require_auth
from services.ai_service import generate_application_proposal
import database

app_bp = Blueprint('applications', __name__, url_prefix='/api/applications')

@app_bp.route('', methods=['GET'])
@require_auth
def list_applications(user_id: str):
    category = request.args.get('category')
    workflows = database.get_application_workflows(user_id, category=category)
    return jsonify(workflows)

@app_bp.route('/<wf_id>', methods=['GET'])
@require_auth
def get_application(user_id: str, wf_id: str):
    workflow = database.get_application_workflow(wf_id, user_id)
    if not workflow:
        return jsonify({"error": "Application workflow not found"}), 404
    return jsonify(workflow)

@app_bp.route('/propose', methods=['POST'])
@require_auth
def propose_application(user_id: str):
    """
    Step 1-6: Analyzes the goal, infers category (or respects override), scans Smart Memory documents,
    matches requirements, and returns a structured proposal with clarifying questions for user confirmation.
    """
    data = request.get_json() or {}
    goal = data.get('goal', '').strip()
    institution = data.get('institution', '').strip()
    doc_id = data.get('doc_id')
    category_override = data.get('category')

    if not goal:
        return jsonify({"error": "Goal description is required"}), 400

    proposal = generate_application_proposal(
        user_id=user_id,
        goal=goal,
        institution=institution,
        doc_id=doc_id,
        category_override=category_override
    )
    return jsonify(proposal)

@app_bp.route('/confirm', methods=['POST'])
@require_auth
def confirm_workflow(user_id: str):
    """
    Step 7-8: Saves the confirmed workflow, checklist items, and auto-generates tracking tasks.
    """
    data = request.get_json() or {}
    title = data.get('title')
    goal = data.get('goal')
    checklist_items = data.get('checklist_items', [])

    if not title or not goal:
        return jsonify({"error": "Title and goal are required to confirm workflow"}), 400

    workflow = database.create_application_workflow(user_id, data)
    
    # Notify user
    database.create_notification(
        user_id=user_id,
        title=f"Application Workflow Started: {title}",
        message=f"Created {len(checklist_items)} checklist items. Follow your recommended next action to complete.",
        alert_type="info",
        action_url=f"/applications"
    )

    return jsonify({
        "success": True,
        "message": "Workflow successfully confirmed and created.",
        "workflow": workflow
    }), 201

@app_bp.route('/items/<item_id>', methods=['PATCH'])
@require_auth
def update_item_status(user_id: str, item_id: str):
    """
    Step 10: Updates checklist item progress upon user confirmation.
    """
    data = request.get_json() or {}
    status = data.get('status')
    if not status or status not in ['pending', 'completed', 'in_progress', 'skipped']:
        return jsonify({"error": "Invalid status"}), 400

    updated_item = database.update_checklist_item_status(item_id, user_id, status)
    if not updated_item:
        return jsonify({"error": "Checklist item not found"}), 404

    return jsonify({
        "success": True,
        "item": updated_item
    })

@app_bp.route('/<wf_id>', methods=['DELETE'])
@require_auth
def delete_application(user_id: str, wf_id: str):
    deleted = database.delete_application_workflow(wf_id, user_id)
    return jsonify({"success": deleted})
