#!/bin/bash
set -e

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
  echo "Error: gh (GitHub CLI) is not installed." >&2
  exit 1
fi

# Verify DOCKERHUB_TOKEN is set
if [ -z "$DOCKERHUB_TOKEN" ]; then
  echo "Error: DOCKERHUB_TOKEN environment variable is not set." >&2
  exit 1
fi

echo "Configuring GitHub Actions secrets..."
gh secret set DOCKERHUB_USERNAME --body "fxhibon"
gh secret set DOCKERHUB_TOKEN --body "$DOCKERHUB_TOKEN"

echo "Configuring Dependabot secrets..."
gh secret set DOCKERHUB_USERNAME --app dependabot --body "fxhibon"
gh secret set DOCKERHUB_TOKEN --app dependabot --body "$DOCKERHUB_TOKEN"

echo "Secrets successfully configured!"
