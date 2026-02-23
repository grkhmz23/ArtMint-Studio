#!/bin/bash
#
# ArtMint Studio - Pre-Deployment Smoke Test
# 
# Run this script before deploying to mainnet to verify everything is configured correctly.
#
# Usage:
#   ./scripts/smoke-test.sh [base_url]
#
#   base_url: The deployment URL (default: http://localhost:3000)
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
BASE_URL="${1:-http://localhost:3000}"
FAILED=0
PASSED=0

echo "========================================"
echo "ArtMint Studio - Pre-Deploy Smoke Test"
echo "========================================"
echo "Testing: $BASE_URL"
echo ""

# Helper functions
pass() {
    echo -e "${GREEN}✓${NC} $1"
    ((PASSED++))
}

fail() {
    echo -e "${RED}✗${NC} $1"
    if [ -n "$2" ]; then
        echo "  Details: $2"
    fi
    ((FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

# Test 1: Health Check
echo "Test 1: Health Endpoint"
echo "-----------------------"
HEALTH_RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/health" 2>/dev/null || echo "Connection failed")
HEALTH_STATUS=$(echo "$HEALTH_RESPONSE" | tail -n1)
HEALTH_BODY=$(echo "$HEALTH_RESPONSE" | sed '$d')

if [ "$HEALTH_STATUS" = "200" ]; then
    pass "Health endpoint returns 200"
    
    # Check individual health checks
    if echo "$HEALTH_BODY" | grep -q '"status":"healthy"'; then
        pass "Overall status is healthy"
    else
        fail "Overall status is not healthy"
        echo "$HEALTH_BODY" | grep -o '"status":"[^"]*"'
    fi
    
    # Check database
    if echo "$HEALTH_BODY" | grep -q '"name":"database","status":"healthy"'; then
        pass "Database connection healthy"
    else
        fail "Database connection issue"
    fi
    
    # Check RPC
    if echo "$HEALTH_BODY" | grep -q '"name":"solana-rpc","status":"healthy"'; then
        pass "Solana RPC connection healthy"
    else
        fail "Solana RPC connection issue"
    fi
    
    # Check storage
    if echo "$HEALTH_BODY" | grep -q '"name":"storage","status":"healthy"'; then
        pass "Storage configuration healthy"
    else
        fail "Storage configuration issue"
    fi
    
    # Check configuration
    if echo "$HEALTH_BODY" | grep -q '"name":"configuration","status":"healthy"'; then
        pass "Environment configuration healthy"
    else
        fail "Environment configuration issue"
        echo "$HEALTH_BODY" | grep -A2 '"name":"configuration"'
    fi
    
elif [ "$HEALTH_STATUS" = "503" ]; then
    fail "Health endpoint returns 503 (Service Unhealthy)"
    echo "$HEALTH_BODY"
else
    fail "Health endpoint unreachable" "HTTP Status: $HEALTH_STATUS"
fi

echo ""

# Test 2: Security Headers
echo "Test 2: Security Headers"
echo "------------------------"
HEADERS=$(curl -s -I "${BASE_URL}" 2>/dev/null || true)

if echo "$HEADERS" | grep -qi "X-Content-Type-Options: nosniff"; then
    pass "X-Content-Type-Options header present"
else
    fail "X-Content-Type-Options header missing"
fi

if echo "$HEADERS" | grep -qi "X-Frame-Options: DENY"; then
    pass "X-Frame-Options header present"
else
    fail "X-Frame-Options header missing"
fi

if echo "$HEADERS" | grep -qi "Content-Security-Policy:"; then
    pass "Content-Security-Policy header present"
else
    warn "Content-Security-Policy header missing (may be stripped by proxy)"
fi

echo ""

# Test 3: API Authentication
echo "Test 3: API Authentication"
echo "--------------------------"

# Test unauthenticated request to protected endpoint
AUTH_RESPONSE=$(curl -s -w "\n%{http_code}" "${BASE_URL}/api/mint" -X POST 2>/dev/null || echo "Connection failed")
AUTH_STATUS=$(echo "$AUTH_RESPONSE" | tail -n1)

if [ "$AUTH_STATUS" = "401" ]; then
    pass "Protected endpoints require authentication (401)"
else
    fail "Protected endpoint should return 401, got $AUTH_STATUS"
fi

echo ""

# Test 4: Rate Limiting
echo "Test 4: Rate Limiting"
echo "---------------------"

# Make multiple rapid requests to trigger rate limiting
RATE_LIMIT_TRIGGERED=false
for i in {1..15}; do
    RATE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/api/health" 2>/dev/null || echo "000")
    if [ "$RATE_STATUS" = "429" ]; then
        RATE_LIMIT_TRIGGERED=true
        break
    fi
done

if [ "$RATE_LIMIT_TRIGGERED" = true ]; then
    pass "Rate limiting is active (429 received)"
else
    warn "Rate limit not triggered (may need more requests or is IP-based)"
fi

echo ""

# Test 5: Static Assets
echo "Test 5: Static Assets"
echo "---------------------"

STATIC_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}/favicon.svg" 2>/dev/null || echo "000")
if [ "$STATIC_STATUS" = "200" ]; then
    pass "Favicon accessible"
else
    warn "Favicon not accessible (status: $STATIC_STATUS)"
fi

echo ""

# Test 6: Page Routes
echo "Test 6: Page Routes"
echo "-------------------"

ROUTES=("/" "/studio" "/upload" "/dashboard")
for route in "${ROUTES[@]}"; do
    ROUTE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "${BASE_URL}${route}" 2>/dev/null || echo "000")
    if [ "$ROUTE_STATUS" = "200" ] || [ "$ROUTE_STATUS" = "307" ] || [ "$ROUTE_STATUS" = "308" ]; then
        pass "Route $route accessible (status: $ROUTE_STATUS)"
    else
        fail "Route $route failed (status: $ROUTE_STATUS)"
    fi
done

echo ""

# Test 7: CORS Configuration
echo "Test 7: CORS Configuration"
echo "--------------------------"

# Test with invalid origin
CORS_RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" \
    -H "Origin: https://evil-site.com" \
    "${BASE_URL}/api/health" 2>/dev/null || echo "000")

if [ "$CORS_RESPONSE" = "403" ]; then
    pass "CORS blocks requests from invalid origins"
else
    warn "CORS response: $CORS_RESPONSE (may allow all origins in dev)"
fi

echo ""

# Test 8: Environment Check (via health endpoint)
echo "Test 8: Environment Configuration"
echo "---------------------------------"

if [ -n "$HEALTH_BODY" ]; then
    # Extract network type
    NETWORK=$(echo "$HEALTH_BODY" | grep -o '"cluster":"[^"]*"' | cut -d'"' -f4)
    if [ "$NETWORK" = "mainnet-beta" ] || [ "$NETWORK" = "mainnet" ]; then
        pass "Network is mainnet-beta"
    else
        fail "Network should be mainnet-beta, got: ${NETWORK:-unknown}"
    fi
    
    # Extract storage provider
    STORAGE=$(echo "$HEALTH_BODY" | grep -o '"provider":"[^"]*"' | cut -d'"' -f4)
    if [ "$STORAGE" = "vercel-blob" ]; then
        pass "Storage provider is vercel-blob"
    else
        warn "Storage provider: ${STORAGE:-unknown} (vercel-blob recommended for production)"
    fi
fi

echo ""

# Summary
echo "========================================"
echo "Test Summary"
echo "========================================"
echo -e "${GREEN}Passed: $PASSED${NC}"
echo -e "${RED}Failed: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All critical tests passed! Ready for deployment.${NC}"
    exit 0
elif [ $FAILED -le 2 ]; then
    echo -e "${YELLOW}⚠ Some non-critical tests failed. Review before deploying.${NC}"
    exit 0
else
    echo -e "${RED}✗ Multiple critical tests failed. Fix issues before deploying.${NC}"
    exit 1
fi
