
#!/usr/bin/env python3
"""
Demo script for the Automated Job Application System
This script demonstrates the system's capabilities with sample data
"""

import sys
import os
import json
from pathlib import Path

# Add src directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'src'))

from ai.user_profile_manager import UserProfileManager
from ai.job_scraper import JobScraper
from ai.ai_job_matcher import AIJobMatcher

def create_sample_jobs():
    """Create sample job listings for demonstration"""
    return [
        {
            'job_id': 'demo_001',
            'title': 'Senior Python Developer',
            'company': 'TechCorp Inc',
            'location': 'San Francisco, CA',
            'salary_range': '$120,000 - $160,000',
            'job_type': 'full-time',
            'remote_option': True,
            'description': 'We are looking for a Senior Python Developer with experience in machine learning and web development. Must have 5+ years of Python experience.',
            'requirements': 'Python, Django, Flask, Machine Learning, SQL, Git',
            'source_url': 'https://example.com/job1'
        },
        {
            'job_id': 'demo_002',
            'title': 'Machine Learning Engineer',
            'company': 'AI Innovations',
            'location': 'Remote',
            'salary_range': '$130,000 - $180,000',
            'job_type': 'full-time',
            'remote_option': True,
            'description': 'Join our ML team to build cutting-edge AI solutions. Experience with TensorFlow, PyTorch, and cloud platforms required.',
            'requirements': 'Python, TensorFlow, PyTorch, AWS, Machine Learning, Statistics',
            'source_url': 'https://example.com/job2'
        },
        {
            'job_id': 'demo_003',
            'title': 'Full Stack Developer',
            'company': 'StartupXYZ',
            'location': 'New York, NY',
            'salary_range': '$100,000 - $140,000',
            'job_type': 'full-time',
            'remote_option': False,
            'description': 'Looking for a full stack developer to join our growing team. React and Node.js experience preferred.',
            'requirements': 'JavaScript, React, Node.js, MongoDB, HTML, CSS',
            'source_url': 'https://example.com/job3'
        },
        {
            'job_id': 'demo_004',
            'title': 'Data Scientist',
            'company': 'DataTech Solutions',
            'location': 'San Francisco, CA',
            'salary_range': '$110,000 - $150,000',
            'job_type': 'full-time',
            'remote_option': True,
            'description': 'Seeking a data scientist to analyze large datasets and build predictive models. PhD preferred.',
            'requirements': 'Python, R, SQL, Machine Learning, Statistics, Pandas, NumPy',
            'source_url': 'https://example.com/job4'
        }
    ]

def demo_user_profile_management():
    """Demonstrate user profile management"""
    print("👤 Demo: User Profile Management")
    print("-" * 40)

    # Load sample user profile
    with open('data/sample_user_profile.json', 'r') as f:
        sample_profile = json.load(f)

    # Initialize profile manager
    profile_manager = UserProfileManager('data/job_app_system.db')

    # Create user profile
    user_id = profile_manager.create_user_profile(sample_profile)
    print(f"✅ Created user profile: {user_id}")

    # Retrieve user profile
    retrieved_profile = profile_manager.get_user_profile(user_id)
    print(f"✅ Retrieved profile for: {retrieved_profile['personal_info']['full_name']}")

    return user_id, retrieved_profile

def demo_job_matching():
    """Demonstrate AI job matching"""
    print("\n🤖 Demo: AI Job Matching")
    print("-" * 40)

    # Create sample jobs
    jobs = create_sample_jobs()
    print(f"📋 Created {len(jobs)} sample job listings")

    # Load user profile
    with open('data/sample_user_profile.json', 'r') as f:
        user_profile = json.load(f)

    # Initialize AI matcher
    ai_matcher = AIJobMatcher()
    ai_matcher.train_on_jobs(jobs)

    # Find matches
    matches = ai_matcher.match_user_to_jobs(user_profile, top_k=3)

    print(f"\n🎯 Top {len(matches)} job matches:")
    for i, (job, score) in enumerate(matches, 1):
        print(f"{i}. {job['title']} at {job['company']} (Score: {score:.3f})")
        print(f"   Location: {job['location']}")
        print(f"   Salary: {job['salary_range']}")
        print()

    return matches

def demo_cover_letter_generation():
    """Demonstrate cover letter generation"""
    print("📝 Demo: Cover Letter Generation")
    print("-" * 40)

    # Load user profile
    with open('data/sample_user_profile.json', 'r') as f:
        user_profile = json.load(f)

    # Create sample job
    job = create_sample_jobs()[0]  # Use first job

    # Initialize AI matcher
    ai_matcher = AIJobMatcher()

    # Generate cover letter
    cover_letter = ai_matcher.generate_cover_letter(user_profile, job)

    print(f"Generated cover letter for {job['title']} at {job['company']}:")
    print("-" * 60)
    print(cover_letter)
    print("-" * 60)

    # Save cover letter
    cover_letter_path = f"data/cover_letters/demo_cover_letter.txt"
    os.makedirs(os.path.dirname(cover_letter_path), exist_ok=True)
    with open(cover_letter_path, 'w') as f:
        f.write(cover_letter)

    print(f"✅ Cover letter saved to: {cover_letter_path}")

def demo_application_tracking():
    """Demonstrate application tracking"""
    print("\n📊 Demo: Application Tracking")
    print("-" * 40)

    # This would normally be done by the ApplicationManager
    # For demo purposes, we'll show what the tracking data looks like

    sample_applications = [
        {
            'application_id': 1,
            'job_id': 'demo_001',
            'application_date': '2024-01-15 10:30:00',
            'status': 'applied',
            'title': 'Senior Python Developer',
            'company': 'TechCorp Inc',
            'location': 'San Francisco, CA'
        },
        {
            'application_id': 2,
            'job_id': 'demo_002',
            'application_date': '2024-01-15 11:45:00',
            'status': 'applied',
            'title': 'Machine Learning Engineer',
            'company': 'AI Innovations',
            'location': 'Remote'
        }
    ]

    print("Recent Applications:")
    for app in sample_applications:
        print(f"• {app['title']} at {app['company']}")
        print(f"  Status: {app['status'].upper()}")
        print(f"  Applied: {app['application_date']}")
        print()

def main():
    """Run the complete demo"""
    print("🚀 Automated Job Application System - DEMO")
    print("=" * 60)

    try:
        # Demo 1: User Profile Management
        user_id, user_profile = demo_user_profile_management()

        # Demo 2: Job Matching
        matches = demo_job_matching()

        # Demo 3: Cover Letter Generation
        demo_cover_letter_generation()

        # Demo 4: Application Tracking
        demo_application_tracking()

        print("\n🎉 Demo completed successfully!")
        print("\n📋 Next Steps:")
        print("1. Install required dependencies: pip install -r requirements.txt")
        print("2. Configure your settings in config/settings.json")
        print("3. Add your resume to the specified path")
        print("4. Run the main application: python main.py --user-id your_id --query 'python developer' --location 'San Francisco'")

    except Exception as e:
        print(f"❌ Demo failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
