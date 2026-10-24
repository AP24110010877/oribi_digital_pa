import unittest
import json
import os
from datetime import datetime
from zoneinfo import ZoneInfo
from app import create_app
from services.ai_service import format_date_dmy

class TestGreetingAndDateFormatting(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.client = self.app.test_client()
        self.test_user_id = f"test-user-greeting-{os.urandom(4).hex()}"
        self.headers = {
            "Authorization": f"Bearer {self.test_user_id}",
            "Content-Type": "application/json"
        }

    def test_greeting_welcome_dynamic_name_and_dd_mm_yyyy_date(self):
        # 1. Complete onboarding with custom name Sonikavelaga and timezone Asia/Kolkata
        onboarding_payload = {
            "personal": {
                "full_name": "Sonikavelaga",
                "email": "sonikavelaga@example.com",
                "profession": "Engineer",
                "timezone": "Asia/Kolkata",
                "preferred_language": "en"
            },
            "family": [
                {
                    "name": "Arjun",
                    "relationship": "Brother",
                    "birthday": "2026-11-15"
                }
            ],
            "preferences": {
                "bill_tracking": 1,
                "deadline_mgmt": 1,
                "daily_briefing": 1
            }
        }
        res = self.client.post('/api/profile/onboarding', headers=self.headers, data=json.dumps(onboarding_payload))
        self.assertEqual(res.status_code, 200)

        # 2. Add an upcoming bill with due date 2026-10-28
        bill_res = self.client.post('/api/bills', headers=self.headers, data=json.dumps({
            "title": "Broadband Internet",
            "biller": "Airtel Fiber",
            "amount": 1099.0,
            "currency": "INR",
            "due_date": "2026-10-28"
        }))
        self.assertIn(bill_res.status_code, [200, 201])

        # 3. Retrieve briefing
        b_res = self.client.get('/api/briefing/today', headers=self.headers)
        self.assertEqual(b_res.status_code, 200)
        briefing = b_res.get_json()

        # Requirement 1: Welcome, [User Name]
        self.assertEqual(briefing["greeting"], "Welcome, Sonikavelaga.")
        self.assertNotIn("Good morning", briefing["greeting"])
        self.assertNotIn("Good afternoon", briefing["greeting"])
        self.assertNotIn("Good evening", briefing["greeting"])

        # Requirement 2: Date in DD/MM/YYYY format using user's configured timezone
        self.assertRegex(briefing["date"], r"^\d{2}/\d{2}/\d{4}$")
        expected_today = datetime.now(ZoneInfo("Asia/Kolkata")).strftime("%d/%m/%Y")
        self.assertEqual(briefing["date"], expected_today)

        # Requirement 3: Alerts formatted with DD/MM/YYYY
        bill_alert = next((a for a in briefing["alerts"] if a["type"] == "bill_due"), None)
        self.assertIsNotNone(bill_alert)
        self.assertIn("28/10/2026", bill_alert["description"])

        bday_alert = next((a for a in briefing["alerts"] if a["type"] == "family_birthday"), None)
        self.assertIsNotNone(bday_alert)
        self.assertIn("15/11/2026", bday_alert["description"])

    def test_another_dynamic_user_name_and_timezone(self):
        user2_headers = {
            "Authorization": f"Bearer test-user-chicago-{os.urandom(4).hex()}",
            "Content-Type": "application/json"
        }
        onboarding_payload = {
            "personal": {
                "full_name": "Eleanor Vance",
                "email": "eleanor@example.com",
                "profession": "Architect",
                "timezone": "America/Chicago",
                "preferred_language": "en"
            },
            "family": [],
            "preferences": {}
        }
        self.client.post('/api/profile/onboarding', headers=user2_headers, data=json.dumps(onboarding_payload))
        
        b_res = self.client.get('/api/briefing/today', headers=user2_headers)
        briefing = b_res.get_json()
        self.assertEqual(briefing["greeting"], "Welcome, Eleanor Vance.")
        self.assertRegex(briefing["date"], r"^\d{2}/\d{2}/\d{4}$")
        expected_chicago_date = datetime.now(ZoneInfo("America/Chicago")).strftime("%d/%m/%Y")
        self.assertEqual(briefing["date"], expected_chicago_date)

    def test_date_formatting_utilities(self):
        # Verify 2026-10-24 -> 24/10/2026
        self.assertEqual(format_date_dmy("2026-10-24"), "24/10/2026")
        self.assertEqual(format_date_dmy("October 24, 2026"), "24/10/2026")
        self.assertEqual(format_date_dmy("24/10/2026"), "24/10/2026")
        self.assertEqual(format_date_dmy("2026-10-24T18:00:00"), "24/10/2026")
        self.assertEqual(format_date_dmy("2026-05-03"), "03/05/2026")

    def test_database_keeps_machine_readable_dates(self):
        # Check that bills in DB retain machine readable YYYY-MM-DD
        bill_res = self.client.post('/api/bills', headers=self.headers, data=json.dumps({
            "title": "Water Bill",
            "biller": "Municipal Water",
            "amount": 350.0,
            "currency": "INR",
            "due_date": "2026-11-30"
        }))
        self.assertIn(bill_res.status_code, [200, 201])
        bill_data = bill_res.get_json()
        self.assertEqual(bill_data["due_date"], "2026-11-30")

if __name__ == "__main__":
    unittest.main()
