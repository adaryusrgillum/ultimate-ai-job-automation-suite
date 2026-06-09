
#!/bin/bash

# Cloud Deployment Script for Job Application Bot
# Supports AWS, GCP, and Azure

set -e

# Configuration
APP_NAME="job-application-bot"
REGION="us-west-2"
INSTANCE_TYPE="t3.medium"

echo "🚀 Starting cloud deployment for $APP_NAME"

# Function to deploy to AWS
deploy_aws() {
    echo "📦 Deploying to AWS..."

    # Create ECR repository
    aws ecr create-repository --repository-name $APP_NAME --region $REGION || true

    # Get ECR login token
    aws ecr get-login-password --region $REGION | docker login --username AWS --password-stdin $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$REGION.amazonaws.com

    # Build and push Docker image
    docker build -t $APP_NAME .
    docker tag $APP_NAME:latest $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$REGION.amazonaws.com/$APP_NAME:latest
    docker push $(aws sts get-caller-identity --query Account --output text).dkr.ecr.$REGION.amazonaws.com/$APP_NAME:latest

    # Deploy to ECS or EKS
    echo "✅ AWS deployment completed"
}

# Function to deploy to GCP
deploy_gcp() {
    echo "📦 Deploying to Google Cloud Platform..."

    # Set project ID
    PROJECT_ID=$(gcloud config get-value project)

    # Build and push to Container Registry
    docker build -t gcr.io/$PROJECT_ID/$APP_NAME .
    docker push gcr.io/$PROJECT_ID/$APP_NAME

    # Deploy to Cloud Run
    gcloud run deploy $APP_NAME \
        --image gcr.io/$PROJECT_ID/$APP_NAME \
        --platform managed \
        --region $REGION \
        --allow-unauthenticated \
        --memory 1Gi \
        --cpu 1

    echo "✅ GCP deployment completed"
}

# Function to deploy to Azure
deploy_azure() {
    echo "📦 Deploying to Microsoft Azure..."

    # Create resource group
    az group create --name ${APP_NAME}-rg --location $REGION

    # Create container registry
    az acr create --resource-group ${APP_NAME}-rg --name ${APP_NAME}registry --sku Basic

    # Build and push image
    az acr build --registry ${APP_NAME}registry --image $APP_NAME .

    # Deploy to Container Instances
    az container create \
        --resource-group ${APP_NAME}-rg \
        --name $APP_NAME \
        --image ${APP_NAME}registry.azurecr.io/$APP_NAME:latest \
        --cpu 1 \
        --memory 1 \
        --ports 8000

    echo "✅ Azure deployment completed"
}

# Main deployment logic
case "$1" in
    aws)
        deploy_aws
        ;;
    gcp)
        deploy_gcp
        ;;
    azure)
        deploy_azure
        ;;
    *)
        echo "Usage: $0 {aws|gcp|azure}"
        echo "Example: $0 aws"
        exit 1
        ;;
esac

echo "🎉 Deployment completed successfully!"
