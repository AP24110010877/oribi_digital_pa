import unittest
import json
import os
import io
from app import create_app
import database

class OrbiBackendTestCase(unittest.TestCase):
    def setUp(self):
        self.app = create_app()
        self.client = self.app.test_client()
        self.test_user_id = f"test-user-qa-{os.urandom(4).hex()}"
        self.headers = {
            "Authorization": f"Bearer {self.test_user_id}",
            "Content-Type": "application/json"
        }

    def test_health_check(self):
        res = self.client.get('/api/health')
        self.assertEqual(res.status_code, 200)
        data = res.get_json()
        self.assertEqual(data['status'], 'healthy')

    def test_onboarding_and_profile(self):
        onboarding_payload = {
            "personal": {
                "full_name": "Eleanor Vance",
                "email": "eleanor@example.com",
                "profession": "Architect",
                "timezone": "America/Chicago",
                "preferred_language": "en",
                "wedding_anniversary": "2020-06-18"
            },
            "family": [
                {
                    "name": "Theo Vance",
                    "relationship": "Child",
                    "birthday": "2022-09-14"
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
        
        # Verify profile retrieval
        p_res = self.client.get('/api/profile', headers=self.headers)
        self.assertEqual(p_res.status_code, 200)
        p_data = p_res.get_json()
        self.assertEqual(p_data['profile']['full_name'], 'Eleanor Vance')
        self.assertEqual(len(p_data['family']), 1)
        self.assertEqual(p_data['family'][0]['name'], 'Theo Vance')

    def test_bills_and_reminders(self):
        bill_payload = {
            "title": "Cloud Server Hosting",
            "biller": "Digital Ocean",
            "amount": 48.50,
            "currency": "USD",
            "due_date": "2026-11-20",
            "advance_reminder_days": 2
        }
        res = self.client.post('/api/bills', headers=self.headers, data=json.dumps(bill_payload))
        self.assertEqual(res.status_code, 201)
        bill = res.get_json()
        self.assertEqual(bill['amount'], 48.50)

        # Update status
        patch_res = self.client.patch(f"/api/bills/{bill['id']}/status", headers=self.headers, data=json.dumps({"status": "paid"}))
        self.assertEqual(patch_res.status_code, 200)

    def test_application_companion(self):
        # 1. Propose workflow
        propose_payload = {
            "goal": "Apply for Schengen Visa",
            "institution": "Consulate General"
        }
        res = self.client.post('/api/applications/propose', headers=self.headers, data=json.dumps(propose_payload))
        self.assertEqual(res.status_code, 200)
        proposal = res.get_json()
        self.assertTrue(len(proposal['checklist_proposal']) > 0)

        # 2. Confirm workflow
        confirm_payload = {
            "title": proposal['title'],
            "goal": proposal['goal'],
            "institution": proposal['institution'],
            "checklist_items": proposal['checklist_proposal']
        }
        conf_res = self.client.post('/api/applications/confirm', headers=self.headers, data=json.dumps(confirm_payload))
        self.assertEqual(conf_res.status_code, 201)
        wf = conf_res.get_json()['workflow']
        self.assertEqual(wf['progress'], 0)

        # 3. Mark first item complete
        first_item = wf['checklist_items'][0]
        step_res = self.client.patch(f"/api/applications/items/{first_item['id']}", headers=self.headers, data=json.dumps({"status": "completed"}))
        self.assertEqual(step_res.status_code, 200)

        # Verify progress recalculated
        wf_res = self.client.get(f"/api/applications/{wf['id']}", headers=self.headers)
        updated_wf = wf_res.get_json()
        self.assertTrue(updated_wf['progress'] > 0)

    def test_daily_briefing_and_alerts(self):
        res = self.client.get('/api/briefing/today', headers=self.headers)
        self.assertEqual(res.status_code, 200)
        briefing = res.get_json()
        self.assertIn("greeting", briefing)
        self.assertIn("stats", briefing)
        self.assertIn("alerts", briefing)

    def test_ask_orbi_assistant(self):
        ask_payload = {"query": "What bills are due soon?"}
        res = self.client.post('/api/assistant/ask', headers=self.headers, data=json.dumps(ask_payload))
        self.assertEqual(res.status_code, 200)
        ans = res.get_json()
        self.assertIn("answer", ans)
        self.assertIn("source_references", ans)

if __name__ == '__main__':
    unittest.main()
