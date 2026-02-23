# ArtMint Studio - E2E Testing Guide

> **Phase:** 1.3 - End-to-End Testing  
> **Network:** Devnet  
> **Date:** 2026-02-23

---

## Overview

This guide provides step-by-step instructions for testing the complete Exchange Art listing flow on Solana devnet.

---

## Prerequisites

### 1. Environment Setup

Ensure your `.env` file has devnet configuration:

```bash
# Solana Devnet
SOLANA_CLUSTER=devnet
SOLANA_RPC_URL=https://api.devnet.solana.com
NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com

# AI Provider (for minting test NFTs)
AI_PROVIDER=anthropic
AI_API_KEY=your-api-key
AI_MODEL=claude-sonnet-4-20250514

# Database
DATABASE_URL=your-dev-database

# Storage
STORAGE_PROVIDER=local  # or vercel-blob for remote testing

# Auth
SESSION_SECRET=dev-secret-do-not-use-in-production-000000000000
```

### 2. Wallet Setup

You need:
- Phantom or Solflare wallet
- Devnet SOL (get from https://faucet.solana.com/)
- At least 0.1 SOL for testing multiple transactions

### 3. Application Running

```bash
# Start the development server
pnpm dev

# Verify it's running
curl http://localhost:3000/api/health
```

---

## Test Scenarios

### Test 1: Happy Path - Full Listing Flow

**Objective:** Successfully list an NFT on Exchange Art

**Steps:**

1. **Generate an NFT**
   - Go to http://localhost:3000/studio
   - Connect wallet
   - Sign in with Solana
   - Enter prompt: "Geometric abstract waves"
   - Select "Minimal" preset
   - Click "Execute"
   - Select a variation
   - Click "Mint"

2. **Wait for Mint Confirmation**
   - Note the placeholder mint address
   - Wait for confirmation (or use existing confirmed mint)

3. **Navigate to Asset Page**
   - Go to http://localhost:3000/asset/[mint-address]
   - Verify NFT displays correctly

4. **List the NFT**
   - Enter price: 0.01 SOL
   - Click "List Asset"
   - Verify UI shows "Preparing transaction..."
   - Verify UI shows "Sign in your wallet..."
   - Approve transaction in wallet
   - Verify UI shows "Submitting to blockchain..."
   - Verify UI shows "Waiting for confirmation..."
   - Verify success message appears
   - Click Solana Explorer link
   - Verify transaction on devnet explorer

5. **Verify Database State**
   ```bash
   # Check listing status in database
   npx prisma studio
   # Navigate to Listing table
   # Verify status is "active"
   # Verify txSignature is populated
   # Verify saleStateKey is populated
   ```

**Expected Results:**
- ✅ Listing created in database
- ✅ Transaction visible on Solana Explorer
- ✅ Status shows "active"
- ✅ Price displays correctly

---

### Test 2: Error - User Rejects Wallet Signature

**Objective:** Handle graceful failure when user rejects transaction

**Steps:**
1. Start listing flow (enter price, click "List Asset")
2. When wallet popup appears, click "Reject"

**Expected Results:**
- ✅ Error message: "User rejected the request"
- ✅ UI returns to "idle" state
- ✅ Button shows "List Asset" again
- ✅ No database entry created

---

### Test 3: Error - Insufficient SOL Balance

**Objective:** Handle insufficient funds gracefully

**Steps:**
1. Create new wallet with 0 SOL
2. Connect to app
3. Try to list an NFT

**Expected Results:**
- ✅ Error message about insufficient funds
- ✅ Transaction never submitted
- ✅ Helpful error shown to user

---

### Test 4: Error - NFT Not Owned

**Objective:** Prevent listing NFTs user doesn't own

**Steps:**
1. Mint NFT with Wallet A
2. Transfer NFT to Wallet B (outside app)
3. Try to list with Wallet A

**Expected Results:**
- ✅ API returns 403 Forbidden
- ✅ Error: "Wallet does not own this NFT"
- ✅ Listing prevented

---

### Test 5: Error - Double Listing Prevention

**Objective:** Prevent listing same NFT twice

**Steps:**
1. Successfully list NFT
2. Try to list same NFT again

**Expected Results:**
- ✅ API returns 409 Conflict
- ✅ Error: "NFT is already listed"
- ✅ UI shows existing listing status

---

### Test 6: Edge Case - Page Refresh During Listing

**Objective:** Handle interrupted flows

**Steps:**
1. Start listing flow
2. Refresh page at "Sign in your wallet..." step
3. Try to list again

**Expected Results:**
- ✅ Flow can be restarted
- ✅ Previous preparation doesn't block new attempt
- ✅ Database state handled correctly

---

### Test 7: Edge Case - Network Timeout

**Objective:** Handle slow network conditions

**Steps:**
1. Throttle network to "Slow 3G" in DevTools
2. Start listing flow
3. Wait for timeout

**Expected Results:**
- ✅ Timeout after 60 seconds
- ✅ Error message shown
- ✅ UI returns to idle state

---

### Test 8: UI - Mobile Responsiveness

**Objective:** Ensure mobile-friendly interface

**Steps:**
1. Open Chrome DevTools
2. Toggle device toolbar
3. Select iPhone 12 Pro
4. Complete full listing flow

**Expected Results:**
- ✅ All UI elements visible
- ✅ Progress indicator readable
- ✅ Buttons tappable
- ✅ No horizontal scroll

---

## Automated E2E Test Script

Create `apps/web/src/__tests__/e2e/listing.e2e.test.ts`:

```typescript
import { describe, it, expect, beforeAll } from "vitest";
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";

// These tests require a running devnet node or devnet access
// Run with: TEST_WALLET_SECRET_KEY=xxx pnpm test:e2e

describe("E2E: Exchange Art Listing Flow", () => {
  let connection: Connection;
  let testWallet: Keypair;
  
  beforeAll(async () => {
    connection = new Connection("https://api.devnet.solana.com", "confirmed");
    
    // Load test wallet from env
    const secretKey = process.env.TEST_WALLET_SECRET_KEY;
    if (!secretKey) {
      console.warn("TEST_WALLET_SECRET_KEY not set, skipping E2E tests");
      return;
    }
    
    testWallet = Keypair.fromSecretKey(
      Buffer.from(secretKey, "base64")
    );
    
    // Check balance
    const balance = await connection.getBalance(testWallet.publicKey);
    console.log(`Test wallet balance: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.1 * LAMPORTS_PER_SOL) {
      console.warn("Test wallet has insufficient balance");
    }
  });

  it("prepares a listing transaction", async () => {
    // TODO: Implement with test server
  });

  it("confirms a listing after on-chain submission", async () => {
    // TODO: Implement with test server
  });

  it("rejects listing for non-owned NFT", async () => {
    // TODO: Implement with test server
  });
});
```

---

## Manual Test Checklist

### Pre-Test Setup
- [ ] App running on localhost:3000
- [ ] Wallet connected
- [ ] Devnet SOL in wallet (>0.1 SOL)
- [ ] Database connected
- [ ] AI API key configured (for generating test NFTs)

### Core Functionality
- [ ] Can generate AI variations
- [ ] Can mint NFT
- [ ] Can view asset page
- [ ] Can list NFT
- [ ] Transaction appears on Solana Explorer
- [ ] Database updated correctly

### Error Handling
- [ ] Rejected signature handled gracefully
- [ ] Insufficient funds error shown
- [ ] Non-owned NFT blocked
- [ ] Double listing prevented
- [ ] Network timeout handled

### UI/UX
- [ ] Progress indicator visible
- [ ] Status messages clear
- [ ] Explorer links work
- [ ] Mobile layout functional
- [ ] Error messages helpful

### Performance
- [ ] Prepare API responds < 2s
- [ ] Transaction submits < 10s
- [ ] Confirmation < 30s
- [ ] Total flow < 60s

---

## Debugging Tips

### Check Transaction Status
```bash
# Using Solana CLI
solana confirm <TX_SIGNATURE> --url devnet

# Using curl
curl https://api.devnet.solana.com -X POST -H "Content-Type: application/json" -d '{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "getTransaction",
  "params": ["<TX_SIGNATURE>", "json"]
}'
```

### Check Database State
```bash
# Start Prisma Studio
npx prisma studio --schema=prisma/schema.prisma

# Or query via psql
psql $DATABASE_URL -c "SELECT * FROM \"Listing\" WHERE mintAddress = '<MINT_ADDRESS>';"
```

### View Logs
```bash
# App logs
pnpm dev

# Filter for listing-related logs
grep -i "listing" logs.txt
```

### Common Issues

**Issue:** "Transaction not found on-chain"
- Check RPC URL is correct
- Verify transaction was actually sent
- Check blockhash hasn't expired

**Issue:** "Sale state account not found"
- Transaction may still be processing
- Wait a few seconds and retry confirm
- Check explorer for transaction status

**Issue:** "Wallet does not own this NFT"
- Verify correct wallet is connected
- Check NFT hasn't been transferred
- Verify mint address is correct

---

## Sign-Off Criteria

Phase 1.3 is complete when:

- [ ] All 8 test scenarios pass
- [ ] No critical bugs found
- [ ] Performance within acceptable limits
- [ ] Error handling robust
- [ ] Documentation complete

---

## Next Steps

After successful E2E testing:
1. Fix any bugs found
2. Optimize performance if needed
3. Update documentation
4. Proceed to Phase 2 (RPC & Transaction Improvements)
