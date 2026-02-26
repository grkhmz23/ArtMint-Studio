#!/bin/bash
#
# Mainnet Test Execution Script
# Run this after deployment to verify mainnet functionality
#

set -uo pipefail

BASE_URL="${1:-https://art-mint-studio-web.vercel.app}"
TESTS_PASSED=0
TESTS_FAILED=0

BODY_FILE="/tmp/artmint-mainnet-body.$$"
HEADERS_FILE="/tmp/artmint-mainnet-headers.$$"
trap 'rm -f "$BODY_FILE" "$HEADERS_FILE"' EXIT

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
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    if [ -n "${2:-}" ]; then
        echo "  Details: $2"
    fi
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

warn() {
    echo -e "${YELLOW}⚠ WARN${NC}: $1"
}

http_get() {
    local url="$1"
    rm -f "$BODY_FILE" "$HEADERS_FILE"
    curl -sS -o "$BODY_FILE" -D "$HEADERS_FILE" -w "%{http_code}" "$url" 2>/dev/null || echo "000"
}

http_post() {
    local url="$1"
    rm -f "$BODY_FILE" "$HEADERS_FILE"
    curl -sS -X POST -o "$BODY_FILE" -D "$HEADERS_FILE" -w "%{http_code}" "$url" 2>/dev/null || echo "000"
}

body_contains() {
    local pattern="$1"
    grep -q "$pattern" "$BODY_FILE" 2>/dev/null
}

body_snippet() {
    if [ -f "$BODY_FILE" ]; then
        tr '\n' ' ' < "$BODY_FILE" | head -c 220
    fi
}

request_time() {
    local url="$1"
    curl -sS -o /dev/null -w "%{time_total}" "$url" 2>/dev/null || echo "999"
}

time_lt() {
    local actual="$1"
    local threshold="$2"
    awk -v actual="$actual" -v threshold="$threshold" 'BEGIN { exit !((actual + 0) < (threshold + 0)) }'
}

check_health_component() {
    local name="$1"
    if body_contains "\"name\":\"$name\",\"status\":\"healthy\""; then
        pass "Health check '$name' is healthy"
    else
        fail "Health check '$name' is not healthy" "$(body_snippet)"
    fi
}

# Test 1: Health Check
echo "📊 Test 1: Health Endpoint"
echo "---------------------------"
HEALTH_STATUS=$(http_get "$BASE_URL/api/health")
if [ "$HEALTH_STATUS" = "200" ] || [ "$HEALTH_STATUS" = "503" ]; then
    if body_contains '"status":"healthy"'; then
        pass "Health endpoint overall status is healthy"
    elif body_contains '"status":"degraded"'; then
        warn "Health endpoint reports degraded"
    else
        fail "Health endpoint returned unexpected payload" "$(body_snippet)"
    fi

    check_health_component "database"
    check_health_component "solana-rpc"
    check_health_component "configuration"
    check_health_component "storage"

    if body_contains '"cluster":"mainnet-beta"' || body_contains '"cluster":"mainnet"'; then
        pass "Health endpoint reports mainnet cluster"
    else
        fail "Health endpoint does not report mainnet cluster" "$(body_snippet)"
    fi
else
    fail "Health endpoint not responding correctly (HTTP $HEALTH_STATUS)"
fi
echo ""

# Test 2: Deep Health Check (optional until implemented)
echo "📊 Test 2: Deep Health Check"
echo "---------------------------"
DEEP_STATUS=$(http_get "$BASE_URL/api/health/deep")
if [ "$DEEP_STATUS" = "404" ]; then
    warn "Deep health endpoint is not implemented (/api/health/deep returns 404)"
elif [ "$DEEP_STATUS" = "200" ]; then
    if body_contains '"healthy"'; then
        pass "Deep health endpoint responds"
    else
        warn "Deep health endpoint returned unexpected payload"
    fi
else
    fail "Deep health endpoint returned HTTP $DEEP_STATUS" "$(body_snippet)"
fi
echo ""

# Test 3: API Response Times
echo "📊 Test 3: API Response Times"
echo "---------------------------"

EXPLORE_TIME=$(request_time "$BASE_URL/api/explore")
if time_lt "$EXPLORE_TIME" "2.0"; then
    pass "Explore API: ${EXPLORE_TIME}s"
else
    fail "Explore API slow or unavailable: ${EXPLORE_TIME}s"
fi

AUCTIONS_TIME=$(request_time "$BASE_URL/api/auctions")
if time_lt "$AUCTIONS_TIME" "2.0"; then
    pass "Auctions API: ${AUCTIONS_TIME}s"
else
    fail "Auctions API slow or unavailable: ${AUCTIONS_TIME}s"
fi
echo ""

# Test 4: Static Assets
echo "📊 Test 4: Static Assets"
echo "---------------------------"
FAVICON_STATUS=$(http_get "$BASE_URL/favicon.svg")
if [ "$FAVICON_STATUS" = "200" ]; then
    pass "Favicon accessible"
else
    warn "Favicon not accessible (HTTP $FAVICON_STATUS)"
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
    STATUS=$(http_get "$BASE_URL$page")
    if [ "$STATUS" = "200" ]; then
        pass "Page $page: HTTP $STATUS"
    elif [ "$STATUS" = "307" ] || [ "$STATUS" = "308" ]; then
        pass "Page $page: Redirect $STATUS"
    else
        fail "Page $page: HTTP $STATUS" "$(body_snippet)"
    fi
done
echo ""

# Test 6: Public API Endpoints (without auth)
echo "📊 Test 6: Public API Endpoints"
echo "---------------------------"

ENDPOINTS=(
    "/api/health"
    "/api/explore"
    "/api/auctions"
    "/api/collections"
)

for endpoint in "${ENDPOINTS[@]}"; do
    STATUS=$(http_get "$BASE_URL$endpoint")
    if [ "$STATUS" = "200" ]; then
        pass "API $endpoint: HTTP $STATUS"
    else
        fail "API $endpoint: HTTP $STATUS" "$(body_snippet)"
    fi
done

if [ "$TESTS_FAILED" -gt 0 ]; then
    warn "If /api/explore, /api/auctions, or /api/collections return 500, check Vercel logs for Prisma P2021 (missing tables) and run production migrations."
fi
echo ""

# Test 7: Auth/CORS behavior
echo "📊 Test 7: Auth and CORS"
echo "---------------------------"
MINT_GET_STATUS=$(http_get "$BASE_URL/api/mint")
if [ "$MINT_GET_STATUS" = "405" ]; then
    pass "GET /api/mint correctly returns 405"
else
    warn "GET /api/mint returned HTTP $MINT_GET_STATUS (expected 405)"
fi

MINT_POST_STATUS=$(http_post "$BASE_URL/api/mint")
if [ "$MINT_POST_STATUS" = "401" ]; then
    pass "POST /api/mint unauthenticated returns 401"
else
    fail "POST /api/mint unauthenticated returned HTTP $MINT_POST_STATUS" "$(body_snippet)"
fi

rm -f "$BODY_FILE" "$HEADERS_FILE"
CORS_STATUS=$(curl -sS -o "$BODY_FILE" -D "$HEADERS_FILE" -w "%{http_code}" -H "Origin: https://evil-site.com" "$BASE_URL/api/health" 2>/dev/null || echo "000")
if [ "$CORS_STATUS" = "403" ]; then
    pass "CORS blocks invalid origin on /api/health"
else
    warn "CORS check returned HTTP $CORS_STATUS (expected 403)"
fi
echo ""

# Test 8: Error Pages
echo "📊 Test 8: Error Pages"
echo "---------------------------"
STATUS_404=$(http_get "$BASE_URL/non-existent-page-12345")
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

if [ "$TESTS_FAILED" -eq 0 ]; then
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
