import sqlite3
import json
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from config import Config

def utc_now_iso():
    return datetime.now(timezone.utc).isoformat()

def get_db_connection():
    conn = sqlite3.connect(Config.DATABASE_PATH, timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA synchronous = NORMAL")
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA busy_timeout = 30000")
    return conn

def ensure_user_profile(user_id: str):
    """Ensures a profile row exists for foreign key constraints."""
    conn = get_db_connection()
    try:
        row = conn.execute("SELECT id FROM profiles WHERE id = ?", (user_id,)).fetchone()
        if not row:
            now = utc_now_iso()
            conn.execute("""
                INSERT OR IGNORE INTO profiles (id, full_name, email, profession, timezone, preferred_language, onboarding_completed, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """, (user_id, "User", f"{user_id}@orbi.internal", "Working Professional", "UTC", "en", 0, now, now))
            conn.commit()
    finally:
        conn.close()

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    # 1. Profiles
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL,
        dob TEXT,
        profession TEXT DEFAULT 'Other',
        timezone TEXT DEFAULT 'UTC',
        preferred_language TEXT DEFAULT 'en',
        wedding_anniversary TEXT,
        onboarding_completed INTEGER DEFAULT 0,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
    """)

    # 2. Preferences
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS user_preferences (
        user_id TEXT PRIMARY KEY,
        doc_organization INTEGER DEFAULT 1,
        bill_tracking INTEGER DEFAULT 1,
        deadline_mgmt INTEGER DEFAULT 1,
        app_checklists INTEGER DEFAULT 1,
        calendar_appts INTEGER DEFAULT 1,
        family_reminders INTEGER DEFAULT 1,
        daily_briefing INTEGER DEFAULT 1,
        voice_assistant INTEGER DEFAULT 1,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
    """)

    # 3. Family Members
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS family_members (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        relationship TEXT NOT NULL,
        birthday TEXT,
        anniversary TEXT,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
    """)

    # 4. Documents
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS documents (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        filename TEXT NOT NULL,
        original_name TEXT NOT NULL,
        file_size INTEGER DEFAULT 0,
        mime_type TEXT DEFAULT 'application/pdf',
        storage_path TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        status TEXT DEFAULT 'pending',
        summary TEXT,
        raw_text TEXT,
        extracted_data TEXT DEFAULT '{}',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
    """)

    # 5. Extracted Facts
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS extracted_facts (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        document_id TEXT,
        fact_type TEXT NOT NULL,
        label TEXT NOT NULL,
        value TEXT NOT NULL,
        confidence REAL DEFAULT 1.0,
        page_number INTEGER DEFAULT 1,
        verified INTEGER DEFAULT 0,
        source_snippet TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    )
    """)

    # 6. Bills
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS bills (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        document_id TEXT,
        title TEXT NOT NULL,
        biller TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT DEFAULT 'INR',
        due_date TEXT NOT NULL,
        status TEXT DEFAULT 'upcoming',
        advance_reminder_days INTEGER DEFAULT 3,
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
        FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE SET NULL
    )
    """)

    # 7. Events
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        event_type TEXT DEFAULT 'appointment',
        start_time TEXT NOT NULL,
        end_time TEXT,
        location TEXT,
        recurrence TEXT DEFAULT 'none',
        notes TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
    """)

    # 8. Reminders
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS reminders (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        due_time TEXT NOT NULL,
        reminder_type TEXT DEFAULT 'one_time',
        status TEXT DEFAULT 'scheduled',
        advance_minutes INTEGER DEFAULT 60,
        target_id TEXT,
        target_type TEXT,
        sent_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
    """)

    # 9. Application Workflows
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS application_workflows (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        goal TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        institution TEXT,
        deadline TEXT,
        status TEXT DEFAULT 'in_progress',
        progress INTEGER DEFAULT 0,
        total_steps INTEGER DEFAULT 0,
        completed_steps INTEGER DEFAULT 0,
        requirements_json TEXT DEFAULT '[]',
        clarifications_json TEXT DEFAULT '[]',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
    """)

    # 10. Checklist Items
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS checklist_items (
        id TEXT PRIMARY KEY,
        workflow_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        order_index INTEGER DEFAULT 0,
        status TEXT DEFAULT 'pending',
        required_document TEXT,
        matched_document_id TEXT,
        deadline TEXT,
        is_verified INTEGER DEFAULT 0,
        source_type TEXT DEFAULT 'suggestion',
        source_reference TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (workflow_id) REFERENCES application_workflows(id) ON DELETE CASCADE,
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE,
        FOREIGN KEY (matched_document_id) REFERENCES documents(id) ON DELETE SET NULL
    )
    """)

    # 11. Conversation Messages
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS conversation_messages (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        source_references TEXT DEFAULT '[]',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
    """)

    # 12. Smart Alerts / Notifications
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        alert_type TEXT DEFAULT 'info',
        is_read INTEGER DEFAULT 0,
        action_url TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE
    )
    """)

    # Indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_docs_user ON documents(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_facts_doc ON extracted_facts(document_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_bills_user ON bills(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_events_user ON events(user_id)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(status, due_time)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_checklists_wf ON checklist_items(workflow_id)")

    # Migrations for existing databases
    migration_cols = [
        ("application_workflows", "category", "TEXT DEFAULT 'general'"),
        ("application_workflows", "clarifications_json", "TEXT DEFAULT '[]'"),
        ("checklist_items", "is_verified", "INTEGER DEFAULT 0"),
        ("checklist_items", "source_type", "TEXT DEFAULT 'suggestion'"),
        ("checklist_items", "source_reference", "TEXT")
    ]
    for tbl, col, col_def in migration_cols:
        try:
            cursor.execute(f"ALTER TABLE {tbl} ADD COLUMN {col} {col_def}")
        except sqlite3.OperationalError:
            pass

    conn.commit()
    conn.close()

# Helper dict conversion
def dict_from_row(row: Optional[sqlite3.Row]) -> Optional[Dict[str, Any]]:
    if row is None:
        return None
    d = dict(row)
    # Parse JSON fields if any
    for k in ['extracted_data', 'requirements_json', 'source_references']:
        if k in d and isinstance(d[k], str):
            try:
                d[k] = json.loads(d[k])
            except Exception:
                pass
    return d

def dict_list_from_rows(rows: List[sqlite3.Row]) -> List[Dict[str, Any]]:
    return [dict_from_row(r) for r in rows if r is not None]

# PROFILE OPERATIONS
def get_profile(user_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM profiles WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict_from_row(row)

def upsert_profile(user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    now = utc_now_iso()
    existing = conn.execute("SELECT id FROM profiles WHERE id = ?", (user_id,)).fetchone()
    if existing:
        conn.execute("""
            UPDATE profiles SET
                full_name = COALESCE(?, full_name),
                email = COALESCE(?, email),
                dob = COALESCE(?, dob),
                profession = COALESCE(?, profession),
                timezone = COALESCE(?, timezone),
                preferred_language = COALESCE(?, preferred_language),
                wedding_anniversary = COALESCE(?, wedding_anniversary),
                onboarding_completed = COALESCE(?, onboarding_completed),
                updated_at = ?
            WHERE id = ?
        """, (
            data.get('full_name'),
            data.get('email'),
            data.get('dob'),
            data.get('profession'),
            data.get('timezone'),
            data.get('preferred_language'),
            data.get('wedding_anniversary'),
            data.get('onboarding_completed'),
            now,
            user_id
        ))
    else:
        conn.execute("""
            INSERT INTO profiles (
                id, full_name, email, dob, profession, timezone, preferred_language, wedding_anniversary, onboarding_completed, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            data.get('full_name', 'User'),
            data.get('email', 'user@example.com'),
            data.get('dob'),
            data.get('profession', 'Other'),
            data.get('timezone', 'UTC'),
            data.get('preferred_language', 'en'),
            data.get('wedding_anniversary'),
            data.get('onboarding_completed', 0),
            now,
            now
        ))
    conn.commit()
    conn.close()
    return get_profile(user_id)

def get_preferences(user_id: str) -> Dict[str, Any]:
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM user_preferences WHERE user_id = ?", (user_id,)).fetchone()
    conn.close()
    if row:
        return dict(row)
    # Default preferences
    return {
        "user_id": user_id,
        "doc_organization": 1,
        "bill_tracking": 1,
        "deadline_mgmt": 1,
        "app_checklists": 1,
        "calendar_appts": 1,
        "family_reminders": 1,
        "daily_briefing": 1,
        "voice_assistant": 1
    }

def update_preferences(user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    now = utc_now_iso()
    existing = conn.execute("SELECT user_id FROM user_preferences WHERE user_id = ?", (user_id,)).fetchone()
    if existing:
        conn.execute("""
            UPDATE user_preferences SET
                doc_organization = COALESCE(?, doc_organization),
                bill_tracking = COALESCE(?, bill_tracking),
                deadline_mgmt = COALESCE(?, deadline_mgmt),
                app_checklists = COALESCE(?, app_checklists),
                calendar_appts = COALESCE(?, calendar_appts),
                family_reminders = COALESCE(?, family_reminders),
                daily_briefing = COALESCE(?, daily_briefing),
                voice_assistant = COALESCE(?, voice_assistant),
                updated_at = ?
            WHERE user_id = ?
        """, (
            data.get('doc_organization'),
            data.get('bill_tracking'),
            data.get('deadline_mgmt'),
            data.get('app_checklists'),
            data.get('calendar_appts'),
            data.get('family_reminders'),
            data.get('daily_briefing'),
            data.get('voice_assistant'),
            now,
            user_id
        ))
    else:
        conn.execute("""
            INSERT INTO user_preferences (
                user_id, doc_organization, bill_tracking, deadline_mgmt, app_checklists,
                calendar_appts, family_reminders, daily_briefing, voice_assistant, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id,
            data.get('doc_organization', 1),
            data.get('bill_tracking', 1),
            data.get('deadline_mgmt', 1),
            data.get('app_checklists', 1),
            data.get('calendar_appts', 1),
            data.get('family_reminders', 1),
            data.get('daily_briefing', 1),
            data.get('voice_assistant', 1),
            now
        ))
    conn.commit()
    conn.close()
    return get_preferences(user_id)

# FAMILY OPERATIONS
def get_family_members(user_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM family_members WHERE user_id = ? ORDER BY created_at ASC", (user_id,)).fetchall()
    conn.close()
    return dict_list_from_rows(rows)

def create_family_member(user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    member_id = str(uuid.uuid4())
    conn.execute("""
        INSERT INTO family_members (id, user_id, name, relationship, birthday, anniversary, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        member_id,
        user_id,
        data['name'],
        data['relationship'],
        data.get('birthday'),
        data.get('anniversary'),
        data.get('notes', '')
    ))
    conn.commit()
    row = conn.execute("SELECT * FROM family_members WHERE id = ?", (member_id,)).fetchone()
    conn.close()
    return dict_from_row(row)

def update_family_member(member_id: str, user_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    conn.execute("""
        UPDATE family_members SET
            name = COALESCE(?, name),
            relationship = COALESCE(?, relationship),
            birthday = COALESCE(?, birthday),
            anniversary = COALESCE(?, anniversary),
            notes = COALESCE(?, notes)
        WHERE id = ? AND user_id = ?
    """, (
        data.get('name'),
        data.get('relationship'),
        data.get('birthday'),
        data.get('anniversary'),
        data.get('notes'),
        member_id,
        user_id
    ))
    conn.commit()
    row = conn.execute("SELECT * FROM family_members WHERE id = ? AND user_id = ?", (member_id, user_id)).fetchone()
    conn.close()
    return dict_from_row(row)

def delete_family_member(member_id: str, user_id: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM family_members WHERE id = ? AND user_id = ?", (member_id, user_id))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

# DOCUMENT OPERATIONS
def create_document(user_id: str, doc_data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        doc_id = str(uuid.uuid4())
        extracted_json = json.dumps(doc_data.get('extracted_data', {}))
        conn.execute("""
            INSERT INTO documents (
                id, user_id, filename, original_name, file_size, mime_type, storage_path,
                category, status, summary, raw_text, extracted_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            doc_id,
            user_id,
            doc_data['filename'],
            doc_data['original_name'],
            doc_data.get('file_size', 0),
            doc_data.get('mime_type', 'application/pdf'),
            doc_data['storage_path'],
            doc_data.get('category', 'general'),
            doc_data.get('status', 'processed'),
            doc_data.get('summary', ''),
            doc_data.get('raw_text', ''),
            extracted_json
        ))
        conn.commit()
        row = conn.execute("SELECT * FROM documents WHERE id = ?", (doc_id,)).fetchone()
        return dict_from_row(row)
    finally:
        conn.close()

def get_documents(user_id: str, search: Optional[str] = None, category: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        query = "SELECT * FROM documents WHERE user_id = ?"
        params = [user_id]
        if category and category != 'all':
            query += " AND category = ?"
            params.append(category)
        if search:
            query += " AND (original_name LIKE ? OR summary LIKE ? OR raw_text LIKE ?)"
            like_term = f"%{search}%"
            params.extend([like_term, like_term, like_term])
        query += " ORDER BY created_at DESC"
        rows = conn.execute(query, params).fetchall()
        return dict_list_from_rows(rows)
    finally:
        conn.close()

def get_document(doc_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        row = conn.execute("SELECT * FROM documents WHERE id = ? AND user_id = ?", (doc_id, user_id)).fetchone()
        return dict_from_row(row)
    finally:
        conn.close()

def update_document(doc_id: str, user_id: str, updates: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    try:
        fields = []
        values = []
        for k in ['category', 'summary', 'raw_text', 'extracted_data', 'status']:
            if k in updates:
                v = updates[k]
                fields.append(f"{k} = ?")
                if k == 'extracted_data' and isinstance(v, (dict, list)):
                    values.append(json.dumps(v))
                else:
                    values.append(v)
        if not fields:
            return get_document(doc_id, user_id)
        fields.append("updated_at = CURRENT_TIMESTAMP")
        values.extend([doc_id, user_id])
        conn.execute(f"UPDATE documents SET {', '.join(fields)} WHERE id = ? AND user_id = ?", values)
        conn.commit()
        row = conn.execute("SELECT * FROM documents WHERE id = ? AND user_id = ?", (doc_id, user_id)).fetchone()
        return dict_from_row(row)
    finally:
        conn.close()

def delete_document(doc_id: str, user_id: str) -> bool:
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM documents WHERE id = ? AND user_id = ?", (doc_id, user_id))
        deleted = cursor.rowcount > 0
        conn.commit()
        return deleted
    finally:
        conn.close()

# EXTRACTED FACTS OPERATIONS
def create_extracted_fact(user_id: str, doc_id: str, fact_data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    try:
        fact_id = str(uuid.uuid4())
        conn.execute("""
            INSERT INTO extracted_facts (
                id, user_id, document_id, fact_type, label, value, confidence, page_number, verified, source_snippet
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            fact_id,
            user_id,
            doc_id,
            fact_data.get('fact_type', 'general'),
            fact_data.get('label', 'Fact'),
            str(fact_data.get('value', '')),
            fact_data.get('confidence', 1.0),
            fact_data.get('page_number', 1),
            fact_data.get('verified', 0),
            fact_data.get('source_snippet', '')
        ))
        conn.commit()
        row = conn.execute("SELECT * FROM extracted_facts WHERE id = ?", (fact_id,)).fetchone()
        return dict_from_row(row)
    finally:
        conn.close()

def get_extracted_facts(user_id: str, doc_id: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    if doc_id:
        rows = conn.execute("SELECT * FROM extracted_facts WHERE user_id = ? AND document_id = ?", (user_id, doc_id)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM extracted_facts WHERE user_id = ?", (user_id,)).fetchall()
    conn.close()
    return dict_list_from_rows(rows)

def update_extracted_fact(fact_id: str, user_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    conn.execute("""
        UPDATE extracted_facts SET
            value = COALESCE(?, value),
            verified = COALESCE(?, verified),
            label = COALESCE(?, label)
        WHERE id = ? AND user_id = ?
    """, (
        data.get('value'),
        data.get('verified'),
        data.get('label'),
        fact_id,
        user_id
    ))
    conn.commit()
    row = conn.execute("SELECT * FROM extracted_facts WHERE id = ? AND user_id = ?", (fact_id, user_id)).fetchone()
    conn.close()
    return dict_from_row(row)

# BILLS OPERATIONS
def create_bill(user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    bill_id = str(uuid.uuid4())
    conn.execute("""
        INSERT INTO bills (
            id, user_id, document_id, title, biller, amount, currency, due_date, status, advance_reminder_days, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        bill_id,
        user_id,
        data.get('document_id'),
        data.get('title', 'Upcoming Bill'),
        data.get('biller', 'Vendor'),
        float(data.get('amount', 0.0)),
        data.get('currency', 'INR'),
        data.get('due_date', datetime.now(timezone.utc).strftime("%Y-%m-%d")),
        data.get('status', 'upcoming'),
        data.get('advance_reminder_days', 3),
        data.get('notes', '')
    ))
    conn.commit()
    row = conn.execute("SELECT * FROM bills WHERE id = ?", (bill_id,)).fetchone()
    conn.close()
    return dict_from_row(row)

def get_bills(user_id: str, status: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    if status and status != 'all':
        rows = conn.execute("SELECT * FROM bills WHERE user_id = ? AND status = ? ORDER BY due_date ASC", (user_id, status)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM bills WHERE user_id = ? ORDER BY due_date ASC", (user_id,)).fetchall()
    conn.close()
    return dict_list_from_rows(rows)

def update_bill(bill_id: str, user_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    now = utc_now_iso()
    conn.execute("""
        UPDATE bills SET
            title = COALESCE(?, title),
            biller = COALESCE(?, biller),
            amount = COALESCE(?, amount),
            currency = COALESCE(?, currency),
            due_date = COALESCE(?, due_date),
            status = COALESCE(?, status),
            advance_reminder_days = COALESCE(?, advance_reminder_days),
            notes = COALESCE(?, notes),
            updated_at = ?
        WHERE id = ? AND user_id = ?
    """, (
        data.get('title'),
        data.get('biller'),
        data.get('amount'),
        data.get('currency'),
        data.get('due_date'),
        data.get('status'),
        data.get('advance_reminder_days'),
        data.get('notes'),
        now,
        bill_id,
        user_id
    ))
    conn.commit()
    row = conn.execute("SELECT * FROM bills WHERE id = ? AND user_id = ?", (bill_id, user_id)).fetchone()
    conn.close()
    return dict_from_row(row)

def delete_bill(bill_id: str, user_id: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM bills WHERE id = ? AND user_id = ?", (bill_id, user_id))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

# CALENDAR & EVENTS
def create_event(user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    event_id = str(uuid.uuid4())
    conn.execute("""
        INSERT INTO events (
            id, user_id, title, event_type, start_time, end_time, location, recurrence, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        event_id,
        user_id,
        data['title'],
        data.get('event_type', 'appointment'),
        data['start_time'],
        data.get('end_time'),
        data.get('location', ''),
        data.get('recurrence', 'none'),
        data.get('notes', '')
    ))
    conn.commit()
    row = conn.execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
    conn.close()
    return dict_from_row(row)

def get_events(user_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM events WHERE user_id = ? ORDER BY start_time ASC", (user_id,)).fetchall()
    conn.close()
    return dict_list_from_rows(rows)

def delete_event(event_id: str, user_id: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM events WHERE id = ? AND user_id = ?", (event_id, user_id))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

# REMINDERS
def create_reminder(user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    reminder_id = str(uuid.uuid4())
    conn.execute("""
        INSERT INTO reminders (
            id, user_id, title, due_time, reminder_type, status, advance_minutes, target_id, target_type
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        reminder_id,
        user_id,
        data['title'],
        data['due_time'],
        data.get('reminder_type', 'one_time'),
        data.get('status', 'scheduled'),
        data.get('advance_minutes', 60),
        data.get('target_id'),
        data.get('target_type')
    ))
    conn.commit()
    row = conn.execute("SELECT * FROM reminders WHERE id = ?", (reminder_id,)).fetchone()
    conn.close()
    return dict_from_row(row)

def get_reminders(user_id: str, status: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    if status and status != 'all':
        rows = conn.execute("SELECT * FROM reminders WHERE user_id = ? AND status = ? ORDER BY due_time ASC", (user_id, status)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM reminders WHERE user_id = ? ORDER BY due_time ASC", (user_id,)).fetchall()
    conn.close()
    return dict_list_from_rows(rows)

def update_reminder_status(reminder_id: str, user_id: str, status: str, new_due_time: Optional[str] = None) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    if new_due_time:
        conn.execute("UPDATE reminders SET status = ?, due_time = ? WHERE id = ? AND user_id = ?", (status, new_due_time, reminder_id, user_id))
    else:
        conn.execute("UPDATE reminders SET status = ? WHERE id = ? AND user_id = ?", (status, reminder_id, user_id))
    conn.commit()
    row = conn.execute("SELECT * FROM reminders WHERE id = ? AND user_id = ?", (reminder_id, user_id)).fetchone()
    conn.close()
    return dict_from_row(row)

# APPLICATION WORKFLOWS & CHECKLISTS
def create_application_workflow(user_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    conn = get_db_connection()
    wf_id = str(uuid.uuid4())
    now = utc_now_iso()
    requirements_json = json.dumps(data.get('requirements', []))
    clarifications_json = json.dumps(data.get('clarifying_questions', []))
    items = data.get('checklist_items', [])
    total_steps = len(items)

    conn.execute("""
        INSERT INTO application_workflows (
            id, user_id, title, goal, category, institution, deadline, status, progress, total_steps, completed_steps, requirements_json, clarifications_json, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        wf_id,
        user_id,
        data.get('title', 'Application Process'),
        data.get('goal', 'Application Preparation'),
        data.get('category', 'general'),
        data.get('institution', 'Authority / Department'),
        data.get('deadline'),
        'in_progress',
        0,
        total_steps,
        0,
        requirements_json,
        clarifications_json,
        now,
        now
    ))

    # Insert items
    for idx, item in enumerate(items):
        item_id = str(uuid.uuid4())
        conn.execute("""
            INSERT INTO checklist_items (
                id, workflow_id, user_id, title, description, order_index, status, required_document, matched_document_id, deadline, is_verified, source_type, source_reference
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            item_id,
            wf_id,
            user_id,
            item.get('title', f"Step {idx+1}"),
            item.get('description', ''),
            idx,
            item.get('status', 'pending'),
            item.get('required_document'),
            item.get('matched_document_id'),
            item.get('deadline'),
            1 if item.get('is_verified') else 0,
            item.get('source_type', 'suggestion'),
            item.get('source_reference')
        ))

    conn.commit()
    conn.close()
    return get_application_workflow(wf_id, user_id)

def get_application_workflows(user_id: str, category: Optional[str] = None) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    if category and category != 'all':
        rows = conn.execute("SELECT * FROM application_workflows WHERE user_id = ? AND category = ? ORDER BY created_at DESC", (user_id, category)).fetchall()
    else:
        rows = conn.execute("SELECT * FROM application_workflows WHERE user_id = ? ORDER BY created_at DESC", (user_id,)).fetchall()
    workflows = dict_list_from_rows(rows)
    for wf in workflows:
        item_rows = conn.execute("SELECT * FROM checklist_items WHERE workflow_id = ? ORDER BY order_index ASC", (wf['id'],)).fetchall()
        wf['checklist_items'] = dict_list_from_rows(item_rows)
    conn.close()
    return workflows

def get_application_workflow(wf_id: str, user_id: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    row = conn.execute("SELECT * FROM application_workflows WHERE id = ? AND user_id = ?", (wf_id, user_id)).fetchone()
    if not row:
        conn.close()
        return None
    wf = dict_from_row(row)
    item_rows = conn.execute("SELECT * FROM checklist_items WHERE workflow_id = ? ORDER BY order_index ASC", (wf_id,)).fetchall()
    wf['checklist_items'] = dict_list_from_rows(item_rows)
    conn.close()
    return wf

def update_checklist_item_status(item_id: str, user_id: str, status: str) -> Optional[Dict[str, Any]]:
    conn = get_db_connection()
    conn.execute("UPDATE checklist_items SET status = ? WHERE id = ? AND user_id = ?", (status, item_id, user_id))
    
    # Recalculate workflow progress
    item_row = conn.execute("SELECT workflow_id FROM checklist_items WHERE id = ?", (item_id,)).fetchone()
    if item_row:
        wf_id = item_row['workflow_id']
        total = conn.execute("SELECT count(*) as c FROM checklist_items WHERE workflow_id = ?", (wf_id,)).fetchone()['c']
        completed = conn.execute("SELECT count(*) as c FROM checklist_items WHERE workflow_id = ? AND status = 'completed'", (wf_id,)).fetchone()['c']
        progress = int((completed / total) * 100) if total > 0 else 0
        wf_status = 'completed' if progress == 100 else 'in_progress'
        conn.execute("UPDATE application_workflows SET progress = ?, completed_steps = ?, total_steps = ?, status = ?, updated_at = ? WHERE id = ?", (
            progress, completed, total, wf_status, utc_now_iso(), wf_id
        ))
    conn.commit()
    updated_item = conn.execute("SELECT * FROM checklist_items WHERE id = ?", (item_id,)).fetchone()
    conn.close()
    return dict_from_row(updated_item)

def delete_application_workflow(wf_id: str, user_id: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM application_workflows WHERE id = ? AND user_id = ?", (wf_id, user_id))
    deleted = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return deleted

# CONVERSATION MESSAGES
def save_conversation_message(user_id: str, role: str, content: str, source_references: Optional[List[Dict[str, Any]]] = None) -> Dict[str, Any]:
    conn = get_db_connection()
    msg_id = str(uuid.uuid4())
    refs_json = json.dumps(source_references or [])
    conn.execute("""
        INSERT INTO conversation_messages (id, user_id, role, content, source_references)
        VALUES (?, ?, ?, ?, ?)
    """, (msg_id, user_id, role, content, refs_json))
    conn.commit()
    row = conn.execute("SELECT * FROM conversation_messages WHERE id = ?", (msg_id,)).fetchone()
    conn.close()
    return dict_from_row(row)

def get_conversation_history(user_id: str, limit: int = 30) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM conversation_messages WHERE user_id = ? ORDER BY created_at ASC LIMIT ?", (user_id, limit)).fetchall()
    conn.close()
    return dict_list_from_rows(rows)

# NOTIFICATIONS & SMART ALERTS
def create_notification(user_id: str, title: str, message: str, alert_type: str = 'info', action_url: Optional[str] = None) -> Dict[str, Any]:
    conn = get_db_connection()
    notif_id = str(uuid.uuid4())
    conn.execute("""
        INSERT INTO notifications (id, user_id, title, message, alert_type, action_url)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (notif_id, user_id, title, message, alert_type, action_url))
    conn.commit()
    row = conn.execute("SELECT * FROM notifications WHERE id = ?", (notif_id,)).fetchone()
    conn.close()
    return dict_from_row(row)

def get_notifications(user_id: str) -> List[Dict[str, Any]]:
    conn = get_db_connection()
    rows = conn.execute("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC", (user_id,)).fetchall()
    conn.close()
    return dict_list_from_rows(rows)

def mark_notification_read(notif_id: str, user_id: str) -> bool:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?", (notif_id, user_id))
    updated = cursor.rowcount > 0
    conn.commit()
    conn.close()
    return updated
