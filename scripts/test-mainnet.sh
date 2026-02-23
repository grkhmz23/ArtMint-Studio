#!/bin/bash
#
# Mainnet Test Execution Script
# Run this after deployment to verify mainnet functionality
#

set -e

BASE_URL="${1:-https://art-mint-studio-web.vercel.app}"
TESTS_PASSED=0
TESTS_FAILED=0

echo "🚀 ArtMint Studio - Mainnet Test Execution"
echo "=========================================="
echo "Testing against: $BASE_URL"
echo ""

# Color codes
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    ((TESTS_PASSED++))
}

fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    ((TESTS_FAILED++))
}

warn() {
    echo -e "${YELLOW}⚠ WARN${NC}: $1"
}

# Test 1: Health Check
echo "📊 Test 1: Health Endpoint"
echo "---------------------------"
if curl -s "$BASE_URL/api/health" | grep -q "ok"; then
    pass "Health endpoint returns OK"
else
    fail "Health endpoint not responding correctly"
fi
echo ""

# Test 2: Deep Health Check
echo "📊 Test 2: Deep Health Check"
echo "---------------------------"
HEALTH_RESPONSE=$(curl -s "$BASE_URL/api/health/deep" 2>/dev/null || echo "{}")
if echo "$HEALTH_RESPONSE" | grep -q "healthy"; then
    pass "Deep health shows healthy"
    
    # Check individual services
    if echo "$HEALTH_RESPONSE" | grep -q '"database".*"ok"'; then
        pass "Database connection OK"
    else
        fail "Database connection issue"
    fi
    
    if echo "$HEALTH_RESPONSE" | grep -q '"rpc".*"ok"'; then
        pass "RPC connection OK"
    else
        fail "RPC connection issue"
    fi
else
    fail "Deep health check failed"
fi
echo ""

# Test 3: API Response Times
echo "📊 Test 3: API Response Times"
echo "---------------------------"

# Test explore endpoint
EXPLORE_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$BASE_URL/api/explore" 2>/dev/null || echo "999")
if (( $(echo "$EXPLORE_TIME < 2.0" | bc -l) )); then
    pass "Explore API: ${EXPLORE_TIME}s"
else
    fail "Explore API slow: ${EXPLORE_TIME}s"
fi

# Test auctions endpoint
AUCTIONS_TIME=$(curl -s -o /dev/null -w "%{time_total}" "$BASE_URL/api/auctions" 2>/dev/null || echo "999")
if (( $(echo "$AUCTIONS_TIME < 2.0" | bc -l) )); then
    pass "Auctions API: ${AUCTIONS_TIME}s"
else
    fail "Auctions API slow: ${AUCTIONS_TIME}s"
fi
echo ""

# Test 4: Static Assets
echo "📊 Test 4: Static Assets"
echo "---------------------------"
if curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/favicon.svg" | grep -q "200"; then
    pass "Favicon accessible"
else
    warn "Favicon not accessible"
fi

echo ""

# Test 5: Page Accessibility
echo "📊 Test 5: Page Accessibility"
echo "---------------------------"

PAGES=(
    "/"
    "/explore"
    "/auctions"
    "/collections"
    "/offers"
    "/activity"
    "/studio"
    "/dashboard"
)

for page in "${PAGES[@]}"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$page" 2>/dev/null || echo "000")
    if [ "$STATUS" = "200" ]; then
        pass "Page $page: HTTP $STATUS"
    elif [ "$STATUS" = "307" ] || [ "$STATUS" = "308" ]; then
        pass "Page $page: Redirect $STATUS"
    else
        fail "Page $page: HTTP $STATUS"
    fi
done
echo ""

# Test 6: API Endpoints (without auth)
echo "📊 Test 6: Public API Endpoints"
echo "---------------------------"

ENDPOINTS=(
    "/api/health"
    "/api/explore"
    "/api/auctions"
    "/api/collections"
)

for endpoint in "${ENDPOINTS[@]}"; do
    STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL$endpoint" 2>/dev/null || echo "000")
    if [ "$STATUS" = "200" ]; then
        pass "API $endpoint: HTTP $STATUS"
    else
        fail "API $endpoint: HTTP $STATUS"
    fi
done
echo ""

# Test 7: Error Pages
echo "📊 Test 7: Error Pages"
echo "---------------------------"

# 404 page
STATUS_404=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/non-existent-page-12345" 2>/dev/null || echo "000")
if [ "$STATUS_404" = "404" ]; then
    pass "404 page returns correct status"
else
    warn "404 page returned HTTP $STATUS_404 (expected 404)"
fi

echo ""

# Summary
echo "=========================================="
echo "📋 Test Summary"
echo "=========================================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}🎉 All automated tests passed!${NC}"
    echo ""
    echo "Next: Perform manual tests from MAINNET_TESTING_CHECKLIST.md"
    echo ""
    echo "Critical manual tests:"
    echo "  1. Wallet connection on mainnet"
    echo "  2. AI generation (1 test)"
    echo "  3. Mint an NFT (use minimal SOL)"
    echo "  4. Create a listing"
    echo "  5. Place a bid on an auction"
    exit 0
else
    echo -e "${RED}⚠️  Some tests failed. Review before continuing.${NC}"
    exit 1
fi
