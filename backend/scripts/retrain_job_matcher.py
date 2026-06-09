#!/usr/bin/env python3
"""
Retrain the job matching AI model based on feedback data
"""
import argparse
import json
import pickle
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

def retrain_job_matcher(feedback_file, mode, output_file):
    """Retrain the job matching model"""

    with open(feedback_file, 'r') as f:
        feedback_data = json.load(f)

    # Prepare training data from feedback
    applications = feedback_data.get('application_outcomes', [])

    if not applications:
        print("No application data available for training")
        return

    # Create features and labels
    job_texts = []
    labels = []

    for app in applications:
        # Combine job information into text
        job_text = f"{app.get('title', '')} {app.get('company', '')} {app.get('requirements', '')}"
        job_texts.append(job_text)

        # Label: 1 for successful applications, 0 for unsuccessful
        success = 1 if app.get('status') in ['interview', 'offer'] else 0
        labels.append(success)

    if len(set(labels)) < 2:
        print("Insufficient label diversity for training")
        return

    # Vectorize job descriptions
    vectorizer = TfidfVectorizer(max_features=1000, stop_words='english')
    X = vectorizer.fit_transform(job_texts)
    y = np.array(labels)

    # Split data
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Train model
    if mode == 'incremental':
        # In a real implementation, this would load the existing model
        # and perform incremental learning
        model = RandomForestClassifier(n_estimators=100, random_state=42)
    else:
        model = RandomForestClassifier(n_estimators=100, random_state=42)

    model.fit(X_train, y_train)

    # Evaluate model
    y_pred = model.predict(X_test)
    accuracy = accuracy_score(y_test, y_pred)

    print(f"Model Accuracy: {accuracy:.3f}")
    print(f"Training samples: {len(X_train)}")
    print(f"Test samples: {len(X_test)}")

    # Save model and vectorizer
    model_data = {
        'model': model,
        'vectorizer': vectorizer,
        'accuracy': accuracy,
        'training_date': feedback_data['collection_date'],
        'mode': mode
    }

    os.makedirs(os.path.dirname(output_file), exist_ok=True)
    with open(output_file, 'wb') as f:
        pickle.dump(model_data, f)

    print(f"Model saved to: {output_file}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--feedback-data', required=True)
    parser.add_argument('--mode', choices=['incremental', 'full_retrain'], default='incremental')
    parser.add_argument('--output', required=True)
    args = parser.parse_args()

    retrain_job_matcher(args.feedback_data, args.mode, args.output)
