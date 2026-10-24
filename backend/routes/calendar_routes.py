from flask import Blueprint, request, jsonify
from datetime import datetime, timedelta
from auth_helper import require_auth
import database

calendar_bp = Blueprint('calendar', __name__, url_prefix='/api/calendar')

@calendar_bp.route('/events', methods=['GET'])
@require_auth
def get_events(user_id: str):
    events = database.get_events(user_id)
    
    # Also fetch family birthdays and anniversaries as synthetic calendar events
    family = database.get_family_members(user_id)
    profile = database.get_profile(user_id) or {}

    current_year = datetime.utcnow().year

    # Add wedding anniversary if present
    if profile.get('wedding_anniversary'):
        ann_date = profile['wedding_anniversary']
        # Project into current year
        try:
            parts = ann_date.split('-')
            if len(parts) == 3:
                proj_date = f"{current_year}-{parts[1]}-{parts[2]}"
                events.append({
                    "id": "profile-anniversary",
                    "title": f"Wedding Anniversary 🎉",
                    "event_type": "anniversary",
                    "start_time": f"{proj_date}T00:00:00",
                    "notes": "User wedding anniversary",
                    "is_synthetic": True
                })
        except Exception:
            pass

    # Add family birthdays & anniversaries
    for m in family:
        if m.get('birthday'):
            try:
                bparts = m['birthday'].split('-')
                if len(bparts) == 3:
                    proj_bday = f"{current_year}-{bparts[1]}-{bparts[2]}"
                    events.append({
                        "id": f"family-bday-{m['id']}",
                        "title": f"{m['name']}'s Birthday 🎂",
                        "event_type": "birthday",
                        "start_time": f"{proj_bday}T00:00:00",
                        "notes": f"Relationship: {m['relationship']}",
                        "is_synthetic": True
                    })
            except Exception:
                pass

        if m.get('anniversary'):
            try:
                aparts = m['anniversary'].split('-')
                if len(aparts) == 3:
                    proj_ann = f"{current_year}-{aparts[1]}-{aparts[2]}"
                    events.append({
                        "id": f"family-ann-{m['id']}",
                        "title": f"{m['name']}'s Anniversary 💍",
                        "event_type": "anniversary",
                        "start_time": f"{proj_ann}T00:00:00",
                        "notes": f"Relationship: {m['relationship']}",
                        "is_synthetic": True
                    })
            except Exception:
                pass

    return jsonify(events)

@calendar_bp.route('/events', methods=['POST'])
@require_auth
def create_event_route(user_id: str):
    data = request.get_json() or {}
    if not data.get('title') or not data.get('start_time'):
        return jsonify({"error": "Title and start time are required"}), 400

    event = database.create_event(user_id, data)

    # Schedule reminder if requested
    if data.get('create_reminder'):
        adv_mins = int(data.get('advance_minutes', 60))
        st = data['start_time'].replace('Z', '')
        if 'T' not in st:
            st += "T09:00:00"
        event_dt = datetime.fromisoformat(st)
        remind_dt = event_dt - timedelta(minutes=adv_mins)
        database.create_reminder(user_id, {
            "title": f"Upcoming: {event['title']}",
            "due_time": remind_dt.isoformat(),
            "reminder_type": "one_time",
            "status": "scheduled",
            "advance_minutes": adv_mins,
            "target_id": event['id'],
            "target_type": "event"
        })

    return jsonify(event), 201

@calendar_bp.route('/events/<event_id>', methods=['DELETE'])
@require_auth
def delete_event_route(user_id: str, event_id: str):
    deleted = database.delete_event(event_id, user_id)
    return jsonify({"success": deleted})

@calendar_bp.route('/reminders', methods=['GET'])
@require_auth
def get_reminders_route(user_id: str):
    status = request.args.get('status')
    reminders = database.get_reminders(user_id, status=status)
    return jsonify(reminders)

@calendar_bp.route('/reminders', methods=['POST'])
@require_auth
def create_reminder_route(user_id: str):
    data = request.get_json() or {}
    if not data.get('title') or not data.get('due_time'):
        return jsonify({"error": "Title and due time are required"}), 400

    reminder = database.create_reminder(user_id, data)
    return jsonify(reminder), 201

@calendar_bp.route('/reminders/<reminder_id>', methods=['PATCH'])
@require_auth
def update_reminder_route(user_id: str, reminder_id: str):
    data = request.get_json() or {}
    status = data.get('status')
    action = data.get('action') # snooze, dismiss, complete

    if action == 'snooze':
        # Snooze by 15 minutes by default or requested minutes
        mins = int(data.get('minutes', 15))
        new_due = (datetime.utcnow() + timedelta(minutes=mins)).isoformat()
        updated = database.update_reminder_status(reminder_id, user_id, 'snoozed', new_due_time=new_due)
        return jsonify({"success": True, "reminder": updated, "message": f"Snoozed for {mins} minutes"})
    elif action == 'dismiss':
        updated = database.update_reminder_status(reminder_id, user_id, 'dismissed')
        return jsonify({"success": True, "reminder": updated})
    elif status:
        updated = database.update_reminder_status(reminder_id, user_id, status)
        return jsonify({"success": True, "reminder": updated})

    return jsonify({"error": "No valid action or status provided"}), 400
