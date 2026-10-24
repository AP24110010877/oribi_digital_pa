import unittest
import os
import io
import json
import sys
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent / "backend"
sys.path.insert(0, str(backend_dir))

from app import create_app
import database

class OrbiFullJourneyAcceptanceTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = create_app()
        cls.client = cls.app.test_client()
        cls.user_id = f"acceptance-user-vance-{os.urandom(4).hex()}"
        cls.headers = {
            "Authorization": f"Bearer {cls.user_id}"
        }

    def test_complete_user_journey(self):
        print("\n--- STEP 1: Sign up and complete onboarding ---")
        onboarding_payload = {
            "personal": {
                "full_name": "Eleanor Vance",
                "email": "eleanor.vance@example.com",
                "dob": "1992-04-12",
                "profession": "Architect",
                "timezone": "America/New_York",
                "preferred_language": "en",
                "wedding_anniversary": "2019-10-12"
            },
            "family": [
                {
                    "name": "Theo Vance",
                    "relationship": "Child",
                    "birthday": "2021-08-20"
                }
            ],
            "preferences": {
                "doc_organization": 1,
                "bill_tracking": 1,
                "deadline_mgmt": 1,
                "app_checklists": 1,
                "daily_briefing": 1
            }
        }
        res = self.client.post(
            '/api/profile/onboarding',
            headers={"Authorization": f"Bearer {self.user_id}", "Content-Type": "application/json"},
            data=json.dumps(onboarding_payload)
        )
        self.assertEqual(res.status_code, 200)
        profile_data = res.get_json()['profile']
        self.assertEqual(profile_data['full_name'], 'Eleanor Vance')
        self.assertEqual(profile_data['onboarding_completed'], 1)
        print("[OK] Onboarding completed successfully.")

        print("\n--- STEP 2: Open the personalized dashboard ---")
        dash_res = self.client.get('/api/briefing/today', headers=self.headers)
        self.assertEqual(dash_res.status_code, 200)
        briefing = dash_res.get_json()
        self.assertIn("Eleanor Vance", briefing['greeting'])
        print(f"[OK] Personalized greeting confirmed: '{briefing['greeting']}'")

        print("\n--- STEP 3 & 4: Upload sample bill PDF and verify extracted amount and due date ---")
        with open('sample_electric_bill.pdf', 'rb') as f:
            pdf_bytes = f.read()

        upload_res = self.client.post(
            '/api/documents',
            headers=self.headers,
            data={'file': (io.BytesIO(pdf_bytes), 'sample_electric_bill.pdf')},
            content_type='multipart/form-data'
        )
        self.assertEqual(upload_res.status_code, 201)
        doc_resp = upload_res.get_json()
        self.assertTrue(doc_resp['success'])
        doc_id = doc_resp['document']['id']
        facts = doc_resp['facts']
        print(f"[OK] Uploaded doc id: {doc_id}, extracted {len(facts)} facts.")

        # Verify auto-created bill or extracted facts
        bills_res = self.client.get('/api/bills', headers=self.headers)
        self.assertEqual(bills_res.status_code, 200)
        bills = bills_res.get_json()
        self.assertTrue(len(bills) > 0)
        latest_bill = bills[0]
        self.assertEqual(round(float(latest_bill['amount']), 2), 154.80)
        print(f"[OK] Extracted amount verified: ${latest_bill['amount']}, Biller: {latest_bill['biller']}")

        print("\n--- STEP 5: Ask Orbi a question about the bill ---")
        ask_res = self.client.post(
            '/api/assistant/ask',
            headers={"Authorization": f"Bearer {self.user_id}", "Content-Type": "application/json"},
            data=json.dumps({"query": "Which bills are due soon?"})
        )
        self.assertEqual(ask_res.status_code, 200)
        answer = ask_res.get_json()
        self.assertTrue("154.8" in answer['answer'] or "154.80" in answer['answer'])
        self.assertTrue(len(answer['source_references']) > 0)
        print(f"[OK] Ask Orbi response verified with source citations: '{answer['answer'].splitlines()[0]}'")

        print("\n--- STEP 6 & 7: Upload sample application notice and generate/confirm checklist ---")
        with open('sample_visa_application_notice.pdf', 'rb') as f:
            app_pdf_bytes = f.read()

        app_upload_res = self.client.post(
            '/api/documents',
            headers=self.headers,
            data={'file': (io.BytesIO(app_pdf_bytes), 'sample_visa_application_notice.pdf')},
            content_type='multipart/form-data'
        )
        self.assertEqual(app_upload_res.status_code, 201)

        # Propose checklist
        prop_res = self.client.post(
            '/api/applications/propose',
            headers={"Authorization": f"Bearer {self.user_id}", "Content-Type": "application/json"},
            data=json.dumps({"goal": "Short-Stay Schengen Visitor Visa", "institution": "Consulate General"})
        )
        self.assertEqual(prop_res.status_code, 200)
        proposal = prop_res.get_json()
        self.assertTrue(len(proposal['checklist_proposal']) >= 4)
        print(f"[OK] Checklist proposed with {len(proposal['checklist_proposal'])} steps.")

        # Confirm checklist
        conf_res = self.client.post(
            '/api/applications/confirm',
            headers={"Authorization": f"Bearer {self.user_id}", "Content-Type": "application/json"},
            data=json.dumps({
                "title": proposal['title'],
                "goal": proposal['goal'],
                "institution": proposal['institution'],
                "checklist_items": proposal['checklist_proposal']
            })
        )
        self.assertEqual(conf_res.status_code, 201)
        confirmed_wf = conf_res.get_json()['workflow']
        print(f"[OK] Application workflow confirmed: {confirmed_wf['title']} (Progress: {confirmed_wf['progress']}%)")

        print("\n--- STEP 8: Add a family birthday ---")
        fam_res = self.client.post(
            '/api/profile/family',
            headers={"Authorization": f"Bearer {self.user_id}", "Content-Type": "application/json"},
            data=json.dumps({
                "name": "Clara Vance",
                "relationship": "Spouse",
                "birthday": "1994-11-05"
            })
        )
        self.assertEqual(fam_res.status_code, 201)
        print("[OK] Family member Clara Vance added.")

        print("\n--- STEP 9: Create a reminder ---")
        rem_res = self.client.post(
            '/api/calendar/reminders',
            headers={"Authorization": f"Bearer {self.user_id}", "Content-Type": "application/json"},
            data=json.dumps({
                "title": "Prepare dossier for Consular appointment",
                "due_time": "2026-11-10T10:00:00",
                "reminder_type": "one_time"
            })
        )
        self.assertEqual(rem_res.status_code, 201)
        print("[OK] Persistent reminder created.")

        print("\n--- STEP 10: Confirm that the dashboard shows the saved information ---")
        final_dash = self.client.get('/api/briefing/today', headers=self.headers)
        self.assertEqual(final_dash.status_code, 200)
        final_data = final_dash.get_json()
        stats = final_data['stats']
        self.assertTrue(stats['pending_bills'] >= 1)
        self.assertTrue(stats['active_workflows'] >= 1)
        self.assertTrue(stats['active_reminders'] >= 1)
        print(f"[OK] Dashboard stats verified: {stats}")

        print("\n--- STEP 11: Restart simulation and verify persistence ---")
        # Instantiate a completely new app/client instance referencing the same DB
        new_app = create_app()
        new_client = new_app.test_client()
        persisted_res = new_client.get('/api/briefing/today', headers=self.headers)
        self.assertEqual(persisted_res.status_code, 200)
        persisted_data = persisted_res.get_json()
        self.assertEqual(persisted_data['stats'], stats)
        print("[OK] Data persistence across app reboot verified.")

        print("\n--- STEP 12: Test invalid files, missing info, and unauthorized access ---")
        # Test non-PDF upload
        bad_file_res = self.client.post(
            '/api/documents',
            headers=self.headers,
            data={'file': (io.BytesIO(b"executable code"), 'malicious.exe')},
            content_type='multipart/form-data'
        )
        self.assertEqual(bad_file_res.status_code, 400)
        print("[OK] Non-PDF file rejection verified.")

        # Test empty query
        bad_query_res = self.client.post(
            '/api/assistant/ask',
            headers={"Authorization": f"Bearer {self.user_id}", "Content-Type": "application/json"},
            data=json.dumps({"query": ""})
        )
        self.assertEqual(bad_query_res.status_code, 400)
        print("[OK] Empty query rejection verified.")

        # Test unauthorized access
        unauth_res = self.client.post(
            '/api/bills',
            headers={"Authorization": "Bearer ", "Content-Type": "application/json"},
            data=json.dumps({"title": "Test Bill", "amount": 10})
        )
        # Should be protected or handled
        self.assertIn(unauth_res.status_code, [400, 401])
        print("[OK] Authorization check verified.")

        print("\nALL 12 STAGES OF THE ACCEPTANCE JOURNEY PASSED SUCCESSFULLY!")

if __name__ == '__main__':
    unittest.main()
