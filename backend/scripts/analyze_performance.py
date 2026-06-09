#!/usr/bin/env python3
"""
Analyze system performance and determine if retraining is needed
"""
import argparse
import json
import numpy as np
from datetime import datetime

def analyze_performance(feedback_file, output_file):
    """Analyze system performance from feedback data"""

    with open(feedback_file, 'r') as f:
        feedback_data = json.load(f)

    performance = feedback_data.get('system_performance', {})

    # Calculate overall performance score
    success_rate = performance.get('success_rate', 0)
    total_apps = performance.get('total_applications', 0)

    # Performance scoring (0-1 scale)
    score_components = {
        'success_rate': min(success_rate * 10, 1.0),  # Scale up success rate
        'application_volume': min(total_apps / 50, 1.0),  # Normalize by target volume
        'user_satisfaction': 0.8,  # Placeholder - would come from user ratings
        'system_reliability': 0.9   # Placeholder - would come from error rates
    }

    overall_score = np.mean(list(score_components.values()))

    # Determine if retraining is needed
    needs_retraining = (
        overall_score < 0.7 or  # Overall performance below threshold
        success_rate < 0.05 or  # Very low success rate
        total_apps < 10         # Too few applications
    )

    analysis_result = {
        'analysis_date': datetime.now().isoformat(),
        'overall_score': float(overall_score),
        'score_components': score_components,
        'needs_retraining': needs_retraining,
        'performance_metrics': performance,
        'recommendations': []
    }

    # Generate recommendations
    if success_rate < 0.05:
        analysis_result['recommendations'].append('Improve job matching algorithm')
    if total_apps < 10:
        analysis_result['recommendations'].append('Increase job discovery and application frequency')
    if overall_score < 0.7:
        analysis_result['recommendations'].append('Full system retraining recommended')

    # Save analysis
    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'w') as f:
        json.dump(analysis_result, f, indent=2)

    print(f"Performance Analysis Complete:")
    print(f"Overall Score: {overall_score:.3f}")
    print(f"Needs Retraining: {needs_retraining}")
    print(f"Recommendations: {len(analysis_result['recommendations'])}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--feedback-data', required=True)
    parser.add_argument('--output', required=True)
    args = parser.parse_args()

    analyze_performance(args.feedback_data, args.output)
