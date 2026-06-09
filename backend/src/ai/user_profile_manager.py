
import json
import sqlite3
from datetime import datetime
from typing import Dict, List, Optional

class UserProfileManager:
    def __init__(self, db_path: str):
        self.db_path = db_path

    def create_user_profile(self, profile_data: Dict) -> str:
        """Create a new user profile in the database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Insert personal info
        personal = profile_data['personal_info']
        cursor.execute("""
            INSERT INTO user_profiles 
            (user_id, full_name, email, phone, location, linkedin_url, github_url, portfolio_url)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            profile_data['user_id'], personal['full_name'], personal['email'],
            personal.get('phone'), personal.get('location'),
            personal.get('linkedin_url'), personal.get('github_url'),
            personal.get('portfolio_url')
        ))

        # Insert skills
        for skill in profile_data.get('skills', []):
            cursor.execute("""
                INSERT INTO user_skills (user_id, skill_name, proficiency_level, years_experience)
                VALUES (?, ?, ?, ?)
            """, (profile_data['user_id'], skill['skill_name'], 
                  skill['proficiency_level'], skill['years_experience']))

        # Insert job preferences
        prefs = profile_data.get('job_preferences', {})
        cursor.execute("""
            INSERT INTO job_preferences 
            (user_id, preferred_roles, preferred_locations, salary_min, salary_max, 
             remote_preference, company_size_preference, industry_preferences)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            profile_data['user_id'],
            json.dumps(prefs.get('preferred_roles', [])),
            json.dumps(prefs.get('preferred_locations', [])),
            prefs.get('salary_min'), prefs.get('salary_max'),
            prefs.get('remote_preference'),
            json.dumps(prefs.get('company_size_preference', [])),
            json.dumps(prefs.get('industry_preferences', []))
        ))

        conn.commit()
        conn.close()
        return profile_data['user_id']

    def get_user_profile(self, user_id: str) -> Optional[Dict]:
        """Retrieve complete user profile"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()

        # Get basic profile
        cursor.execute("SELECT * FROM user_profiles WHERE user_id = ?", (user_id,))
        profile_row = cursor.fetchone()
        if not profile_row:
            return None

        # Get skills
        cursor.execute("SELECT * FROM user_skills WHERE user_id = ?", (user_id,))
        skills = cursor.fetchall()

        # Get preferences
        cursor.execute("SELECT * FROM job_preferences WHERE user_id = ?", (user_id,))
        prefs_row = cursor.fetchone()

        conn.close()

        # Build profile dict
        profile = {
            'user_id': user_id,
            'personal_info': {
                'full_name': profile_row[2],
                'email': profile_row[3],
                'phone': profile_row[4],
                'location': profile_row[5],
                'linkedin_url': profile_row[6],
                'github_url': profile_row[7],
                'portfolio_url': profile_row[8]
            },
            'skills': [
                {
                    'skill_name': skill[2],
                    'proficiency_level': skill[3],
                    'years_experience': skill[4]
                } for skill in skills
            ]
        }

        if prefs_row:
            profile['job_preferences'] = {
                'preferred_roles': json.loads(prefs_row[2] or '[]'),
                'preferred_locations': json.loads(prefs_row[3] or '[]'),
                'salary_min': prefs_row[4],
                'salary_max': prefs_row[5],
                'remote_preference': prefs_row[6],
                'company_size_preference': json.loads(prefs_row[7] or '[]'),
                'industry_preferences': json.loads(prefs_row[8] or '[]')
            }

        return profile
