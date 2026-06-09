
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from typing import Dict, List, Tuple
import json

class AIJobMatcher:
    def __init__(self):
        self.vectorizer = TfidfVectorizer(
            max_features=1000,
            stop_words='english',
            ngram_range=(1, 2)
        )
        self.job_vectors = None
        self.jobs_data = []

    def train_on_jobs(self, jobs: List[Dict]):
        """Train the matcher on available job listings"""
        self.jobs_data = jobs

        # Create text representations of jobs
        job_texts = []
        for job in jobs:
            text = f"{job.get('title', '')} {job.get('description', '')} {job.get('requirements', '')}"
            job_texts.append(text)

        # Vectorize job descriptions
        if job_texts:
            self.job_vectors = self.vectorizer.fit_transform(job_texts)

    def match_user_to_jobs(self, user_profile: Dict, top_k: int = 10) -> List[Tuple[Dict, float]]:
        """Find best matching jobs for a user"""
        if not self.job_vectors or not self.jobs_data:
            return []

        # Create user profile text
        user_text = self._create_user_text(user_profile)

        # Vectorize user profile
        user_vector = self.vectorizer.transform([user_text])

        # Calculate similarities
        similarities = cosine_similarity(user_vector, self.job_vectors)[0]

        # Get top matches
        top_indices = np.argsort(similarities)[::-1][:top_k]

        matches = []
        for idx in top_indices:
            job = self.jobs_data[idx]
            score = similarities[idx]

            # Apply preference filters
            if self._passes_user_filters(job, user_profile):
                matches.append((job, score))

        return matches

    def _create_user_text(self, user_profile: Dict) -> str:
        """Create searchable text from user profile"""
        text_parts = []

        # Add skills
        for skill in user_profile.get('skills', []):
            text_parts.append(skill['skill_name'])

        # Add preferred roles
        prefs = user_profile.get('job_preferences', {})
        text_parts.extend(prefs.get('preferred_roles', []))

        # Add work experience
        for exp in user_profile.get('work_experience', []):
            text_parts.append(exp.get('position', ''))
            text_parts.append(exp.get('description', ''))

        return ' '.join(text_parts)

    def _passes_user_filters(self, job: Dict, user_profile: Dict) -> bool:
        """Check if job passes user's preference filters"""
        prefs = user_profile.get('job_preferences', {})

        # Location filter
        preferred_locations = prefs.get('preferred_locations', [])
        if preferred_locations:
            job_location = job.get('location', '').lower()
            if not any(loc.lower() in job_location for loc in preferred_locations):
                if 'remote' not in preferred_locations and not job.get('remote_option', False):
                    return False

        # Remote preference
        remote_pref = prefs.get('remote_preference')
        if remote_pref == 'remote' and not job.get('remote_option', False):
            return False
        elif remote_pref == 'onsite' and job.get('remote_option', False):
            return False

        return True

    def generate_cover_letter(self, user_profile: Dict, job: Dict) -> str:
        """Generate a personalized cover letter"""
        template = f"""
Dear Hiring Manager,

I am writing to express my strong interest in the {job.get('title', 'position')} role at {job.get('company', 'your company')}. 

With {len(user_profile.get('work_experience', []))} years of experience and expertise in {', '.join([skill['skill_name'] for skill in user_profile.get('skills', [])[:3]])}, I am confident I would be a valuable addition to your team.

In my previous role at {user_profile.get('work_experience', [{}])[0].get('company_name', 'my previous company')}, I {user_profile.get('work_experience', [{}])[0].get('achievements', 'contributed significantly to the team')}.

I am particularly excited about this opportunity because it aligns with my career goals and interests in {', '.join(user_profile.get('job_preferences', {}).get('industry_preferences', ['technology']))}.

Thank you for considering my application. I look forward to discussing how my skills and experience can contribute to your team's success.

Best regards,
{user_profile.get('personal_info', {}).get('full_name', 'Your Name')}
        """
        return template.strip()
