import logging
import uuid
from datetime import datetime, timedelta, timezone
from apscheduler.schedulers.background import BackgroundScheduler
import database

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("OrbiScheduler")

scheduler = BackgroundScheduler(daemon=True)

def check_due_reminders():
    """
    Background worker that runs every 60 seconds to inspect scheduled reminders.
    Uses strict, isolated connection handling with try/finally to prevent deadlocks.
    """
    try:
        now_iso = datetime.now(timezone.utc).isoformat()
        
        # Step 1: Read-only query for due reminders
        due_list = []
        conn = database.get_db_connection()
        try:
            due_reminders = conn.execute("""
                SELECT id, user_id, title, due_time FROM reminders
                WHERE status = 'scheduled' AND due_time <= ?
            """, (now_iso,)).fetchall()
            due_list = [dict(r) for r in due_reminders]
        finally:
            conn.close()

        # Step 2: Mark each reminder sent and insert notification atomically
        for r in due_list:
            logger.info(f"Triggering reminder: {r['title']} for user: {r['user_id']}")
            conn = database.get_db_connection()
            try:
                conn.execute("UPDATE reminders SET status = 'sent', sent_at = ? WHERE id = ?", (now_iso, r['id']))
                conn.execute("""
                    INSERT INTO notifications (id, user_id, title, message, alert_type)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    str(uuid.uuid4()),
                    r['user_id'],
                    f"Reminder: {r['title']}",
                    f"Scheduled reminder reached its due time ({r['due_time']}).",
                    "reminder"
                ))
                conn.commit()
            except Exception as e:
                conn.rollback()
                logger.error(f"Error marking reminder {r['id']}: {e}")
            finally:
                conn.close()

        # Step 3: Check bills approaching due date
        today_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        three_days_later = (datetime.now(timezone.utc) + timedelta(days=3)).strftime("%Y-%m-%d")

        bills_list = []
        conn = database.get_db_connection()
        try:
            approaching_bills = conn.execute("""
                SELECT id, user_id, title, amount, currency, due_date FROM bills
                WHERE status = 'upcoming' AND due_date BETWEEN ? AND ?
            """, (today_date, three_days_later)).fetchall()
            bills_list = [dict(b) for b in approaching_bills]
        finally:
            conn.close()

        for b in bills_list:
            conn = database.get_db_connection()
            try:
                existing = conn.execute("SELECT id FROM reminders WHERE target_id = ? AND target_type = 'bill'", (b['id'],)).fetchone()
                if not existing:
                    conn.execute("""
                        INSERT INTO reminders (id, user_id, title, due_time, reminder_type, status, advance_minutes, target_id, target_type)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                    """, (
                        str(uuid.uuid4()),
                        b['user_id'],
                        f"Payment due: {b['title']} ({b['currency']} {b['amount']})",
                        f"{b['due_date']}T09:00:00",
                        "one_time",
                        "scheduled",
                        1440,
                        b['id'],
                        "bill"
                    ))
                    conn.commit()
            except Exception as e:
                conn.rollback()
                logger.error(f"Error auto-scheduling reminder for bill {b['id']}: {e}")
            finally:
                conn.close()

    except Exception as e:
        logger.error(f"Error checking reminders: {e}")

def start_scheduler():
    if not scheduler.running:
        scheduler.add_job(check_due_reminders, 'interval', seconds=60, id='orbi_reminder_checker', replace_existing=True)
        scheduler.start()
        logger.info("Orbi Background Scheduler started successfully.")
