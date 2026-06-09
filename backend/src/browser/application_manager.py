
import sqlite3
from datetime import datetime
from typing import Dict, List, Optional
import json

class ApplicationManager:
    def __init__(self, db_path: str, browser_automation, form_filler, ai_matcher):
        self.db_path = db_path
        self.browser = browser_automation
        self.form_filler = form_filler
        self.ai_matcher = ai_matcher

    def apply_to_job(self, job_data: Dict, user_profile: Dict) -> Dict[str, any]:
        """Complete application process for a single job"""
        application_result = {
            'job_id': job_data.get('job_id'),
            'success': False,
            'error_message': None,
            'steps_completed': []
        }

        try:
            # Step 1: Navigate to job
            if self.browser.navigate_to_job(job_data.get('source_url')):
                application_result['steps_completed'].append('navigation')
            else:
                application_result['error_message'] = "Failed to navigate to job"
                return application_result

            # Step 2: Find and click apply button
            apply_selector = self.browser.find_apply_button()
            if apply_selector and self.browser.click_apply_button(apply_selector):
                application_result['steps_completed'].append('apply_button_clicked')
            else:
                application_result['error_message'] = "Could not find or click apply button"
                return application_result

            # Step 3: Generate cover letter
            cover_letter = self.ai_matcher.generate_cover_letter(user_profile, job_data)
            cover_letter_path = self.form_filler.create_cover_letter_file(cover_letter, job_data)
            self.form_filler.set_cover_letter_path(cover_letter_path)
            application_result['steps_completed'].append('cover_letter_generated')

            # Step 4: Fill application form
            if self.form_filler.fill_application_form(job_data):
                application_result['steps_completed'].append('form_filled')
            else:
                application_result['error_message'] = "Failed to fill application form"
                return application_result

            # Step 5: Validate form
            validation = self.form_filler.validate_form_completion()
            if validation.get('has_errors', False):
                application_result['error_message'] = f"Form validation failed: {validation.get('error_count', 0)} errors"
                return application_result

            application_result['steps_completed'].append('form_validated')

            # Step 6: Submit application (optional - can be manual)
            # if self.browser.submit_application():
            #     application_result['steps_completed'].append('submitted')

            application_result['success'] = True

            # Record application in database
            self.record_application(user_profile['user_id'], job_data, 'applied', cover_letter)

        except Exception as e:
            application_result['error_message'] = str(e)

        return application_result

    def record_application(self, user_id: str, job_data: Dict, status: str, cover_letter: str):
        """Record application in database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO applications 
            (user_id, job_id, status, cover_letter, notes)
            VALUES (?, ?, ?, ?, ?)
        """, (
            user_id,
            job_data.get('job_id'),
            status,
            cover_letter,
            json.dumps({'company': job_data.get('company'), 'title': job_data.get('title')})
        ))

        conn.commit()
        conn.close()

    def batch_apply(self, jobs: List[Dict], user_profile: Dict, max_applications: int = 5) -> List[Dict]:
        """Apply to multiple jobs in batch"""
        results = []
        applications_sent = 0

        for job in jobs[:max_applications]:
            if applications_sent >= max_applications:
                break

            print(f"\nApplying to: {job.get('title')} at {job.get('company')}")
            result = self.apply_to_job(job, user_profile)
            results.append(result)

            if result['success']:
                applications_sent += 1
                print(f"✅ Application successful!")
            else:
                print(f"❌ Application failed: {result.get('error_message')}")

            # Delay between applications
            import time
            import random
            time.sleep(random.uniform(30, 60))  # 30-60 second delay

        return results

    def get_application_history(self, user_id: str) -> List[Dict]:
        """Get user's application history"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        cursor.execute("""
            SELECT a.*, j.title, j.company, j.location
            FROM applications a
            LEFT JOIN job_listings j ON a.job_id = j.job_id
            WHERE a.user_id = ?
            ORDER BY a.application_date DESC
        """, (user_id,))

        applications = cursor.fetchall()
        conn.close()

        return [
            {
                'application_id': app[0],
                'job_id': app[2],
                'application_date': app[3],
                'status': app[4],
                'title': app[7],
                'company': app[8],
                'location': app[9]
            }
            for app in applications
        ]
