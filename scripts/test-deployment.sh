#!/bin/bash

# Test Deployment Script
# Tests all API endpoints after deployment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get Vercel URL from environment or prompt
if [ -z "$VERCEL_URL" ]; then
    echo -e "${YELLOW}Enter your Vercel deployment URL (e.g., https://your-project.vercel.app):${NC}"
    read VERCEL_URL
fi

# Remove trailing slash
VERCEL_URL=${VERCEL_URL%/}

echo -e "${GREEN}Testing deployment at: $VERCEL_URL${NC}\n"

# Test 1: Screenshot Service
echo -e "${YELLOW}1. Testing Screenshot Service...${NC}"
SCREENSHOT_RESPONSE=$(curl -s -X POST "$VERCEL_URL/api/screenshot" \
  -H "Content-Type: application/json" \
  -d '{
    "componentCode": "window.Component = () => React.createElement(\"div\", { style: { padding: \"20px\", background: \"#f0f0f0\" } }, \"Hello World\");"
  }')

if echo "$SCREENSHOT_RESPONSE" | grep -q "screenshotUrl"; then
    echo -e "${GREEN}✓ Screenshot service working${NC}"
else
    echo -e "${RED}✗ Screenshot service failed${NC}"
    echo "$SCREENSHOT_RESPONSE"
    exit 1
fi

# Test 2: Image Diff Service (using base64 images)
echo -e "${YELLOW}2. Testing Image Diff Service...${NC}"
# Create a simple 1x1 PNG in base64
SIMPLE_PNG="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

DIFF_RESPONSE=$(curl -s -X POST "$VERCEL_URL/api/image-diff" \
  -H "Content-Type: application/json" \
  -d "{
    \"image1Url\": \"data:image/png;base64,$SIMPLE_PNG\",
    \"image2Url\": \"data:image/png;base64,$SIMPLE_PNG\",
    \"threshold\": 0.1
  }")

if echo "$DIFF_RESPONSE" | grep -q "diffPercentage"; then
    echo -e "${GREEN}✓ Image diff service working${NC}"
else
    echo -e "${RED}✗ Image diff service failed${NC}"
    echo "$DIFF_RESPONSE"
    exit 1
fi

# Test 3: Accessibility Service
echo -e "${YELLOW}3. Testing Accessibility Service...${NC}"
ACCESSIBILITY_RESPONSE=$(curl -s -X POST "$VERCEL_URL/api/accessibility" \
  -H "Content-Type: application/json" \
  -d '{
    "componentCode": "window.Component = () => React.createElement(\"button\", { \"aria-label\": \"Click me\" }, \"Click\");",
    "level": "AA"
  }')

if echo "$ACCESSIBILITY_RESPONSE" | grep -q "passed"; then
    echo -e "${GREEN}✓ Accessibility service working${NC}"
else
    echo -e "${RED}✗ Accessibility service failed${NC}"
    echo "$ACCESSIBILITY_RESPONSE"
    exit 1
fi

echo -e "\n${GREEN}All API endpoints are working! ✓${NC}"

