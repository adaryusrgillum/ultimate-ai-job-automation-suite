
from typing import Dict, List, Optional
import os
from pathlib import Path

class FormFiller:
    def __init__(self, browser_automation, user_profile: Dict):
        self.browser = browser_automation
        self.user_profile = user_profile
        self.resume_path = None
        self.cover_letter_path = None

    def set_resume_path(self, path: str):
        """Set the path to the user's resume"""
        self.resume_path = os.path.abspath(path)

    def set_cover_letter_path(self, path: str):
        """Set the path to the cover letter"""
        self.cover_letter_path = os.path.abspath(path)

    def fill_application_form(self, job_data: Dict) -> bool:
        """Fill out a job application form"""
        try:
            # Detect form fields
            form_fields = self.browser.detect_form_fields()

            if not form_fields:
                print("No form fields detected")
                return False

            # Fill personal information
            personal_info = self.user_profile.get('personal_info', {})

            field_mappings = {
                'first_name': personal_info.get('full_name', '').split()[0] if personal_info.get('full_name') else '',
                'last_name': ' '.join(personal_info.get('full_name', '').split()[1:]) if personal_info.get('full_name') else '',
                'email': personal_info.get('email', ''),
                'phone': personal_info.get('phone', ''),
                'linkedin': personal_info.get('linkedin_url', ''),
                'portfolio': personal_info.get('portfolio_url', '')
            }

            # Fill text fields
            for field_name, value in field_mappings.items():
                if field_name in form_fields and value:
                    success = self.browser.fill_form_field(form_fields[field_name], value)
                    if success:
                        print(f"✅ Filled {field_name}: {value}")
                    else:
                        print(f"❌ Failed to fill {field_name}")

            # Upload resume
            if 'resume' in form_fields and self.resume_path:
                success = self.browser.upload_file(form_fields['resume'], self.resume_path)
                if success:
                    print("✅ Uploaded resume")
                else:
                    print("❌ Failed to upload resume")

            # Fill cover letter
            if 'cover_letter' in form_fields and self.cover_letter_path:
                with open(self.cover_letter_path, 'r') as f:
                    cover_letter_text = f.read()
                success = self.browser.fill_form_field(form_fields['cover_letter'], cover_letter_text)
                if success:
                    print("✅ Filled cover letter")
                else:
                    print("❌ Failed to fill cover letter")

            return True

        except Exception as e:
            print(f"Error filling application form: {e}")
            return False

    def create_cover_letter_file(self, cover_letter_text: str, job_data: Dict) -> str:
        """Create a cover letter file for the specific job"""
        filename = f"cover_letter_{job_data.get('company', 'company').replace(' ', '_')}.txt"
        filepath = f"./outputs/job_application_system/data/cover_letters/{filename}"

        os.makedirs(os.path.dirname(filepath), exist_ok=True)

        with open(filepath, 'w') as f:
            f.write(cover_letter_text)

        return os.path.abspath(filepath)

    def validate_form_completion(self) -> Dict[str, bool]:
        """Validate that required fields are filled"""
        validation_results = {}

        # Check for validation messages
        error_selectors = [
            ".error-message",
            ".field-error",
            "[aria-invalid='true']",
            ".required-field-error"
        ]

        for selector in error_selectors:
            try:
                elements = self.browser.driver.find_elements(By.CSS_SELECTOR, selector)
                if elements:
                    validation_results['has_errors'] = True
                    validation_results['error_count'] = len(elements)
                    break
            except:
                continue

        if 'has_errors' not in validation_results:
            validation_results['has_errors'] = False
            validation_results['error_count'] = 0

        return validation_results
