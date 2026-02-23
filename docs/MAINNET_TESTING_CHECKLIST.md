# ArtMint Studio - Mainnet Testing Checklist

> **Date:** 2026-02-23  
> **Status:** Ready for Mainnet Testing  
> **Target:** Validate all critical paths work on mainnet-beta

---

## Pre-Testing Setup

### Environment Variables (Production)

```bash
# Copy and configure for mainnet
cp .env.example .env.production

# Required variables:
NEXT_PUBLIC_APP_URL=https://art-mint-studio-web.vercel.app
SOLANA_CLUSTER=mainnet-beta
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
SOLANA_RPC_BACKUP_URL=https://your-backup-rpc.com
NEXT_PUBLIC_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_KEY
SESSION_SECRET=<64-char-hex-from-openssl>
DATABASE_URL=<production-db-with-ssl>
STORAGE_PROVIDER=vercel-blob
BLOB_READ_WRITE_TOKEN=<vercel-token>
AI_PROVIDER=anthropic
AI_API_KEY=<production-key>
```

### Pre-Flight Checks

- [ ] Environment variables configured in Vercel dashboard
- [ ] Database migrations applied to production DB
- [ ] Helius/QuickNode mainnet RPC active
- [ ] Vercel Blob storage configured
- [ ] AI API key has sufficient quota
- [ ] Session secret is 64-character hex (not dev default)
- [ ] `/api/health` returns 200 OK
- [ ] `/api/health/deep` shows all systems green

---

## Test Phase 1: Core Wallet & Authentication

### 1.1 Wallet Connection
- [ ] Connect Phantom wallet on mainnet
- [ ] Connect Solflare wallet on mainnet
- [ ] Verify wallet network indicator shows "mainnet-beta"
- [ ] Disconnect and reconnect wallet
- [ ] Switch wallets and verify session persists correctly

### 1.2 Authentication
- [ ] Sign message to authenticate
- [ ] Verify session cookie is set
- [ ] Access protected routes while authenticated
- [ ] Session expires correctly after timeout
- [ ] Re-authenticate after session expiry

**Expected:** Clean auth flow, no errors, session persists appropriately

---

## Test Phase 2: AI Generation

### 2.1 Generate Variations
- [ ] Enter prompt: "Cosmic ocean waves with aurora borealis"
- [ ] Select "Minimal" preset
- [ ] Click "Generate 12 Variations"
- [ ] Verify all 12 render correctly
- [ ] Check quota counter decreases

### 2.2 Template Selection
- [ ] Switch to "flow_fields" template
- [ ] Generate variations
- [ ] Switch to "jazz_noir" template
- [ ] Generate variations

### 2.3 "More Like This"
- [ ] Click "More like this" on a variation
- [ ] Verify new variations are similar to selected
- [ ] Check quota counter updates

**Expected:** 10-15 second generation time, all renders deterministic

---

## Test Phase 3: Minting (⚠️ USE SMALL AMOUNTS)

### 3.1 Mint AI-Generated Art
- [ ] Select a variation
- [ ] Click "Mint this"
- [ ] Confirm wallet transaction (~0.01-0.02 SOL)
- [ ] Wait for confirmation
- [ ] Verify mint appears in profile

### 3.2 Mint Custom Code
- [ ] Go to `/studio/code`
- [ ] Enter valid P5.js code
- [ ] Render preview
- [ ] Mint with minimal SOL

### 3.3 Upload & Mint
- [ ] Go to `/upload`
- [ ] Upload test image (small file)
- [ ] Process and mint

**Expected:**
- Transaction succeeds within 30 seconds
- NFT appears on asset page
- Metadata displays correctly
- Image loads properly

**Cost Estimate:** ~0.02 SOL per mint

---

## Test Phase 4: Listings (Exchange Art Integration)

### 4.1 Create Listing
- [ ] Go to asset page of minted NFT
- [ ] Enter price (e.g., 0.1 SOL)
- [ ] Click "List Buy Now"
- [ ] Sign transaction (3-step flow)
- [ ] Wait for confirmation

### 4.2 Verify on Exchange Art
- [ ] Check NFT appears on Exchange Art
- [ ] Verify price matches
- [ ] Check listing status on asset page

### 4.3 Cancel Listing
- [ ] Cancel listing from asset page
- [ ] Verify transaction succeeds
- [ ] Confirm delisting on Exchange Art

**Expected:**
- Listing transaction succeeds
- Appears on Exchange Art within 5 minutes
- Status updates correctly in UI

**Cost Estimate:** ~0.005 SOL for listing

---

## Test Phase 5: Offers System

### 5.1 Make Offer
- [ ] Find NFT on explore page (not owned)
- [ ] Click "Make Offer"
- [ ] Enter offer amount (e.g., 0.05 SOL)
- [ ] Submit offer
- [ ] Verify offer appears in "Sent Offers"

### 5.2 Receive & Respond to Offer
- [ ] From another wallet, make offer on your NFT
- [ ] Check notification received
- [ ] View offer in "Received Offers"
- [ ] Accept offer (or reject)
- [ ] Verify status updates

**Expected:**
- Offer creation instant
- Notifications delivered
- Accept/reject works smoothly

---

## Test Phase 6: Auctions

### 6.1 Create English Auction
- [ ] Create auction from asset page
- [ ] Select "English" type
- [ ] Set start price: 0.1 SOL
- [ ] Set min bid increment: 0.01 SOL
- [ ] Set duration: 1 hour
- [ ] Create auction

### 6.2 Create Dutch Auction
- [ ] Create auction from asset page
- [ ] Select "Dutch" type
- [ ] Set start price: 0.2 SOL
- [ ] Set reserve price: 0.05 SOL
- [ ] Set duration: 1 hour
- [ ] Create auction

### 6.3 Place Bids
- [ ] From second wallet, bid on English auction
- [ ] Verify bid appears in history
- [ ] Place higher bid from third wallet
- [ ] Verify first bidder gets "outbid" notification

### 6.4 Dutch Auction Purchase
- [ ] From second wallet, buy Dutch auction
- [ ] Verify purchase succeeds
- [ ] Check ownership transferred

**Expected:**
- Auction creation instant
- Bids recorded correctly
- Price updates in real-time (Dutch)
- Notifications sent appropriately

---

## Test Phase 7: Social Features

### 7.1 Favorites
- [ ] Favorite an artwork
- [ ] Check owner receives notification
- [ ] View favorites in profile
- [ ] Unfavorite and verify removal

### 7.2 Follows
- [ ] Follow a creator profile
- [ ] Check creator receives notification
- [ ] View followers count update
- [ ] Unfollow and verify

### 7.3 Notifications
- [ ] Receive notification for each event type:
  - [ ] offer_received
  - [ ] offer_accepted
  - [ ] bid_placed
  - [ ] outbid
  - [ ] auction_won
  - [ ] follow
  - [ ] favorite
- [ ] Mark notifications as read
- [ ] Clear all notifications

**Expected:**
- All notifications delivered within seconds
- Real-time updates in UI
- Bell icon shows unread count

---

## Test Phase 8: Collections

### 8.1 Create Collection
- [ ] Go to `/collections`
- [ ] Click "Create Collection"
- [ ] Enter name, description, image
- [ ] Create collection

### 8.2 Add Items
- [ ] Add minted NFTs to collection
- [ ] Verify items appear in collection
- [ ] Check collection page displays correctly

### 8.3 View Collection
- [ ] Navigate to collection slug
- [ ] Verify all items display
- [ ] Check metadata correct

---

## Test Phase 9: Edge Cases & Error Handling

### 9.1 Error Pages
- [ ] Visit non-existent route → 404 page
- [ ] Trigger error boundary → 500 page
- [ ] Verify error pages have navigation links

### 9.2 Rate Limiting
- [ ] Rapid-fire API requests → Should be rate limited
- [ ] Verify 429 responses handled gracefully

### 9.3 Invalid Inputs
- [ ] Submit invalid wallet address
- [ ] Submit negative price
- [ ] Submit oversized image
- [ ] Verify proper error messages

### 9.4 Network Failures
- [ ] Disconnect wallet mid-transaction
- [ ] Refresh page during pending transaction
- [ ] Verify state recovers correctly

---

## Test Phase 10: Performance & Load

### 10.1 Page Load Times
- [ ] `/explore` loads < 3 seconds
- [ ] `/auctions` loads < 3 seconds
- [ ] Asset page loads < 2 seconds
- [ ] Profile page loads < 3 seconds

### 10.2 API Response Times
- [ ] `/api/health` < 100ms
- [ ] `/api/explore` < 500ms
- [ ] `/api/auctions` < 500ms
- [ ] `/api/notifications` < 300ms

### 10.3 Image Loading
- [ ] Thumbnails load quickly
- [ ] Full images load on demand
- [ ] No broken images in gallery

---

## Post-Test Validation

### Database Integrity
- [ ] No duplicate mint records
- [ ] All transactions have corresponding DB records
- [ ] Foreign key constraints intact
- [ ] No orphaned records

### Blockchain Verification
- [ ] Verify 5 random mints on Solana Explorer
- [ ] Verify 3 random listings on Exchange Art
- [ ] Check all transaction signatures valid

### Cost Analysis
- [ ] Total SOL spent on testing
- [ ] Average transaction cost
- [ ] Estimate monthly operational costs

---

## Sign-Off Checklist

| Role | Name | Date | Signature |
|------|------|------|-----------|
| Lead Developer | | | |
| QA Tester | | | |
| Product Owner | | | |
| Security Review | | | |

---

## Known Issues & Blockers

Document any issues found during testing:

| Issue | Severity | Status | Notes |
|-------|----------|--------|-------|
| | | | |

---

## Go/No-Go Decision

**Go Criteria:**
- All critical tests pass (Phases 1-5)
- No security vulnerabilities
- Performance within acceptable ranges
- Team sign-off complete

**No-Go Criteria:**
- Any critical test fails
- Security vulnerability discovered
- Performance unacceptable
- Missing sign-offs

**Decision:** ☐ GO  ☐ NO-GO  
**Date:** _______________

---

## Post-Launch Monitoring

First 24 hours:
- [ ] Monitor error rates every 2 hours
- [ ] Check transaction success rates
- [ ] Verify AI quota not exceeded
- [ ] Monitor RPC health
- [ ] Check database performance

First week:
- [ ] Daily error review
- [ ] User feedback collection
- [ ] Performance metrics review
- [ ] Cost analysis

Good luck! 🚀
