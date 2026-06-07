#!/bin/bash
set -e

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
  echo "Error: gh (GitHub CLI) is not installed." >&2
  exit 1
fi

echo "Configuring GitHub repository settings..."

echo "Disabling GitHub Projects and Wiki..."
gh repo edit --enable-projects=false --enable-wiki=false

echo "Enabling branch protection on master..."
gh api --method PUT /repos/{owner}/{repo}/branches/master/protection --input - <<EOF
{
  "required_status_checks": {
    "strict": true,
    "contexts": [
      "docker-build / Build & Push Docker Image"
    ]
  },
  "enforce_admins": null,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0
  },
  "restrictions": null
}
EOF

echo "Repository settings configured successfully!"
