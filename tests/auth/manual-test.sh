#!/bin/bash

# Manual test script for authentication endpoints
# Run with: bash tests/auth/manual-test.sh

API_URL="http://localhost:8787/api"
EMAIL="test$(date +%s)@example.com"
PASSWORD="TestPassword123!"

echo "🧪 LeadFuego Authentication Manual Test"
echo "======================================"
echo "API URL: $API_URL"
echo "Test Email: $EMAIL"
echo ""

# Health check
echo "1️⃣ Health Check"
curl -s "$API_URL/" | jq .
echo ""

# Register user
echo "2️⃣ Register User"
REGISTER_RESPONSE=$(curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\",
    \"firstName\": \"Test\",
    \"lastName\": \"User\",
    \"company\": \"Test Company\"
  }")

echo "$REGISTER_RESPONSE" | jq .
TOKEN=$(echo "$REGISTER_RESPONSE" | jq -r .token)
echo "Token: ${TOKEN:0:30}..."
echo ""

# Login
echo "3️⃣ Login"
LOGIN_RESPONSE=$(curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }")

echo "$LOGIN_RESPONSE" | jq .
echo ""

# Get profile (authenticated)
echo "4️⃣ Get Profile (Authenticated)"
curl -s -X GET "$API_URL/auth/profile" \
  -H "Authorization: Bearer $TOKEN" | jq .
echo ""

# Update profile
echo "5️⃣ Update Profile"
curl -s -X PUT "$API_URL/auth/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"firstName\": \"Updated\",
    \"lastName\": \"Name\",
    \"company\": \"Updated Company\"
  }" | jq .
echo ""

# Get profile without auth (should fail)
echo "6️⃣ Get Profile (No Auth - Should Fail)"
curl -s -X GET "$API_URL/auth/profile" | jq .
echo ""

# Invalid login (should fail)
echo "7️⃣ Invalid Login (Should Fail)"
curl -s -X POST "$API_URL/auth/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"WrongPassword\"
  }" | jq .
echo ""

# Duplicate registration (should fail)
echo "8️⃣ Duplicate Registration (Should Fail)"
curl -s -X POST "$API_URL/auth/register" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$EMAIL\",
    \"password\": \"$PASSWORD\"
  }" | jq .

echo ""
echo "✅ Manual tests complete!"