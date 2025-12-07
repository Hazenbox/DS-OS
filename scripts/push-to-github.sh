#!/bin/bash

# Script to push to GitHub with automatic credential handling

cd "$(dirname "$0")"

echo "🚀 Pushing to GitHub..."
echo ""

# Check if we're ahead
AHEAD=$(git rev-list --count origin/main..HEAD 2>/dev/null)
if [ "$AHEAD" -eq 0 ]; then
    echo "✅ Nothing to push - already up to date"
    exit 0
fi

echo "📦 You have $AHEAD commit(s) ready to push"
echo ""

# Try HTTPS push first
echo "Attempting to push via HTTPS..."
if git push origin main 2>&1; then
    echo ""
    echo "✅ Successfully pushed to GitHub!"
    exit 0
fi

echo ""
echo "⚠️  HTTPS push requires authentication"
echo ""
echo "Please run one of the following:"
echo ""
echo "Option 1: Use GitHub CLI (recommended)"
echo "  gh auth login"
echo "  git push origin main"
echo ""
echo "Option 2: Use Personal Access Token"
echo "  git push origin main"
echo "  (When prompted, use your GitHub username and a Personal Access Token as password)"
echo "  (Create token at: https://github.com/settings/tokens)"
echo ""
echo "Option 3: Use SSH (if you have SSH keys set up)"
echo "  git remote set-url origin git@github.com:Hazenbox/DS-OS.git"
echo "  git push origin main"
echo ""

exit 1

