
#!/usr/bin/env python3
"""
Automated Job Application System
Main application entry point
"""

import sys
import os
import json
import argparse
from pathlib import Path

# Add src directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from ai.user_profile_manager import UserProfileManager
from ai.job_scraper import JobScraper
from ai.ai_job_matcher import AIJobMatcher
from browser.automation import BrowserAutomation
from browser.form_filler import FormFiller
from browser.application_manager import ApplicationManager

class JobApplicationBot:
    def __init__(self, config_path: str = "config/settings.json"):
        self.config = self.load_config(config_path)
        self.db_path = self.config.get('database_path', 'data/job_app_system.db')

        # Initialize components
        self.profile_manager = UserProfileManager(self.db_path)
        self.job_scraper = JobScraper()
        self.ai_matcher = AIJobMatcher()
        self.browser = BrowserAutomation(
            headless=self.config.get('headless_browser', False),
            user_data_dir=self.config.get('browser_profile_path')
        )

    def load_config(self, config_path: str) -> dict:
        """Load configuration from JSON file"""
        try:
            with open(config_path, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"Config file {config_path} not found. Using defaults.")
            return {
                'database_path': 'data/job_app_system.db',
                'headless_browser': False,
                'max_applications_per_day': 10,
                'delay_between_applications': 60
            }

    def setup_user_profile(self, profile_data: dict) -> str:
        """Create or update user profile"""
        user_id = self.profile_manager.create_user_profile(profile_data)
        print(f"✅ User profile created/updated: {user_id}")
        return user_id

    def search_jobs(self, query: str, location: str, max_jobs: int = 50) -> list:
        """Search for jobs using multiple sources"""
        print(f"🔍 Searching for jobs: '{query}' in '{location}'")

        jobs = []

        # Search Indeed
        try:
            indeed_jobs = self.job_scraper.scrape_indeed_jobs(query, location, max_pages=5)
            jobs.extend(indeed_jobs)
            print(f"Found {len(indeed_jobs)} jobs from Indeed")
        except Exception as e:
            print(f"Error scraping Indeed: {e}")

        # Add more job sources here (LinkedIn, Glassdoor, etc.)

        return jobs[:max_jobs]

    def find_matching_jobs(self, user_id: str, jobs: list, top_k: int = 10) -> list:
        """Find jobs that match user preferences"""
        user_profile = self.profile_manager.get_user_profile(user_id)
        if not user_profile:
            print("❌ User profile not found")
            return []

        # Train AI matcher on available jobs
        self.ai_matcher.train_on_jobs(jobs)

        # Get top matches
        matches = self.ai_matcher.match_user_to_jobs(user_profile, top_k)

        print(f"🎯 Found {len(matches)} matching jobs")
        return matches

    def apply_to_jobs(self, user_id: str, job_matches: list, max_applications: int = 5) -> list:
        """Apply to selected jobs automatically"""
        user_profile = self.profile_manager.get_user_profile(user_id)
        if not user_profile:
            print("❌ User profile not found")
            return []

        # Setup browser automation
        self.browser.setup_driver()

        # Initialize form filler and application manager
        form_filler = FormFiller(self.browser, user_profile)
        app_manager = ApplicationManager(
            self.db_path, self.browser, form_filler, self.ai_matcher
        )

        # Set resume path if available
        resume_path = self.config.get('resume_path')
        if resume_path and os.path.exists(resume_path):
            form_filler.set_resume_path(resume_path)

        try:
            # Extract job data from matches
            jobs_to_apply = [match[0] for match in job_matches[:max_applications]]

            # Apply to jobs
            results = app_manager.batch_apply(jobs_to_apply, user_profile, max_applications)

            return results

        finally:
            self.browser.close_driver()

    def run_full_workflow(self, user_id: str, search_query: str, location: str):
        """Run the complete job application workflow"""
        print("🚀 Starting Automated Job Application Workflow")
        print("=" * 60)

        # Step 1: Search for jobs
        jobs = self.search_jobs(search_query, location)
        if not jobs:
            print("❌ No jobs found")
            return

        # Step 2: Find matching jobs
        matches = self.find_matching_jobs(user_id, jobs)
        if not matches:
            print("❌ No matching jobs found")
            return

        # Step 3: Display top matches
        print("\n🎯 Top Job Matches:")
        for i, (job, score) in enumerate(matches[:5], 1):
            print(f"{i}. {job.get('title')} at {job.get('company')} (Score: {score:.2f})")

        # Step 4: Apply to jobs
        max_apps = self.config.get('max_applications_per_day', 5)
        results = self.apply_to_jobs(user_id, matches, max_apps)

        # Step 5: Summary
        successful = sum(1 for r in results if r['success'])
        print(f"\n📊 Application Summary:")
        print(f"✅ Successful applications: {successful}")
        print(f"❌ Failed applications: {len(results) - successful}")

        return results

def main():
    parser = argparse.ArgumentParser(description='Automated Job Application System')
    parser.add_argument('--user-id', required=True, help='User ID')
    parser.add_argument('--query', required=True, help='Job search query')
    parser.add_argument('--location', required=True, help='Job location')
    parser.add_argument('--config', default='config/settings.json', help='Config file path')
    parser.add_argument('--max-apps', type=int, default=5, help='Maximum applications to send')

    args = parser.parse_args()

    # Initialize bot
    bot = JobApplicationBot(args.config)

    # Run workflow
    results = bot.run_full_workflow(args.user_id, args.query, args.location)

    print("\n🎉 Workflow completed!")

if __name__ == "__main__":
    main()
