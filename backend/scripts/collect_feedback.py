#!/usr/bin/env python3
"""
Collect user feedback and interaction data for AI learning
"""
import argparse
import json
import sqlite3
from datetime import datetime, timedelta
import pandas as pd

def collect_feedback_data(source, output_file):
    """Collect feedback data from various sources"""
    feedback_data = {
        'collection_date': datetime.now().isoformat(),
        'source': source,
        'user_interactions': [],
        'application_outcomes': [],
        'job_match_ratings': [],
        'system_performance': {}
    }

    if source == 'production':
        # Collect from production database
        try:
            conn = sqlite3.connect('data/job_app_system.db')

            # Get recent applications
            query = """
                SELECT a.*, j.title, j.company, j.location, j.requirements
                FROM applications a
                LEFT JOIN job_listings j ON a.job_id = j.job_id
                WHERE a.application_date > datetime('now', '-7 days')
            """
            applications = pd.read_sql_query(query, conn)

            # Get user interactions
            interaction_query = """
                SELECT * FROM user_interactions
                WHERE timestamp > datetime('now', '-7 days')
            """
            interactions = pd.read_sql_query(interaction_query, conn)

            feedback_data['user_interactions'] = interactions.to_dict('records')
            feedback_data['application_outcomes'] = applications.to_dict('records')

            conn.close()

        except Exception as e:
            print(f"Error collecting production data: {e}")

    # Calculate performance metrics
    if feedback_data['application_outcomes']:
        total_apps = len(feedback_data['application_outcomes'])
        successful_apps = len([a for a in feedback_data['application_outcomes'] 
                              if a.get('status') in ['interview', 'offer']])

        feedback_data['system_performance'] = {
            'total_applications': total_apps,
            'success_rate': successful_apps / total_apps if total_apps > 0 else 0,
            'avg_applications_per_day': total_apps / 7,
            'needs_improvement': successful_apps / total_apps < 0.1 if total_apps > 0 else True
        }

    # Save feedback data
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w') as f:
        json.dump(feedback_data, f, indent=2)

    print(f"Collected feedback data: {len(feedback_data['user_interactions'])} interactions")
    print(f"Application outcomes: {len(feedback_data['application_outcomes'])} applications")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--source', default='production')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()

    collect_feedback_data(args.source, args.output)
