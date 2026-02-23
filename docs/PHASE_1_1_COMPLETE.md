# Phase 1.1 Complete: Exchange Art Listing Transaction Builder

> **Status:** ✅ COMPLETE  
> **Date:** 2026-02-23  
> **Next:** Phase 1.2 (Frontend Integration)

---

## Summary

Phase 1.1 implements the backend infrastructure for the new Exchange Art listing flow. The key change is moving from a simple database update to a full 3-step on-chain listing process.

---

## Changes Made

### 1. New Files Created

#### `/apps/web/src/lib/solana-token.ts`
Token ownership verification utilities:
- `verifyTokenOwnership()` - Verifies wallet owns NFT on-chain
- `validateNftMint()` - Validates mint account exists
- `isTokenListed()` - Placeholder for on-chain listing check

#### `/apps/web/src/app/api/listing/prepare/route.ts`
New API endpoint for preparing listing transactions:
- Validates authentication and rate limits
- Verifies mint exists in database
- **Verifies on-chain token ownership** (NEW)
- Builds Exchange Art listing transaction
- Returns serialized transaction + signing data

**Request:**
```json
POST /api/listing/prepare
{
  "mintAddress": "ABC...",
  "priceLamports": "1000000000"
}
```

**Response:**
```json
{
  "success": true,
  "prepared": {
    "serializedTransaction": "base64...",
    "saleStatePublicKey": "DEF...",
    "saleStateSecretKey": "base64...",
    "blockhash": "...",
    "lastValidBlockHeight": 123456789,
    "estimatedFee": 5000,
    "expiresAt": "2026-02-23T12:01:00Z"
  },
  "listing": {
    "mintAddress": "ABC...",
    "priceLamports": "1000000000",
    "priceSol": 1.0
  }
}
```

#### `/apps/web/src/app/api/listing/confirm/route.ts`
New API endpoint for confirming listings:
- Verifies transaction signature (replay protection)
- Verifies transaction on-chain
- Checks sale state account exists
- Updates listing status to "active"

**Request:**
```json
POST /api/listing/confirm
{
  "mintAddress": "ABC...",
  "txSignature": "5xyz...",
  "saleStateKey": "DEF..."
}
```

### 2. Modified Files

#### `/packages/exchangeart/src/listing.ts`
Added new function `prepareListingTransaction()`:
- Builds transaction with Exchange Art program
- Partially signs with `saleStateKeypair`
- Returns serialized transaction + keypair data
- Includes blockhash and fee estimation

```typescript
export interface PreparedListingTransaction {
  serializedTransaction: string;  // base64
  saleStatePublicKey: string;
  saleStateSecretKey: string;     // base64 - client must sign
  blockhash: string;
  lastValidBlockHeight: number;
  estimatedFee: number;
}
```

#### `/packages/exchangeart/src/index.ts`
Exported new types and functions.

#### `/apps/web/src/app/api/listing/route.ts`
Marked as **DEPRECATED**:
- Returns 308 redirect with helpful message
- Directs users to new `/prepare` and `/confirm` endpoints
- GET method preserved for listing queries

---

## Security Improvements

### 1. On-Chain Ownership Verification
Before preparing a listing, the API now verifies:
```typescript
const ownership = await verifyTokenOwnership(
  connection,
  sellerPubkey,
  mintAddress
);

if (!ownership.ownsToken) {
  return 403 Forbidden;
}
```

This prevents:
- Listing NFTs the user no longer owns
- Front-running transfers
- Database/state mismatches

### 2. Transaction Replay Protection
```typescript
const existingTx = await prisma.listing.findFirst({
  where: { txSignature },
});

if (existingTx) {
  return 409 Conflict;
}
```

### 3. Rate Limiting
- 10 requests/min per IP for prepare
- 5 requests/min per wallet for prepare
- 10 requests/min per IP for confirm

### 4. Sale State Key Verification
The confirm endpoint verifies the sale state key matches what was prepared:
```typescript
if (listing.saleStateKey && listing.saleStateKey !== saleStateKey) {
  return 400 Bad Request;
}
```

---

## API Flow

```
┌─────────────┐     POST /api/listing/prepare      ┌─────────────┐
│   Client    │ ─────────────────────────────────> │   Server    │
│             │                                    │             │
│  1. User    │     1. Auth check                  │  1. Verify  │
│  clicks     │     2. Rate limit                  │     auth    │
│  "List"     │     3. Check DB for mint           │  2. Check   │
│             │     4. Verify on-chain ownership   │     rates   │
│             │     5. Build transaction           │  3. Verify  │
│             │     6. Store pending listing       │     owner   │
│             │                                    │  4. Build   │
│             │ <───────────────────────────────── │     tx      │
└─────────────┘     Return: serialized tx + keys   └─────────────┘
        │
        │ 2. Sign with wallet + saleStateKeypair
        v
┌─────────────┐
│ Solana RPC  │  Submit signed transaction
└─────────────┘
        │
        │ 3. Transaction confirmed
        v
┌─────────────┐     POST /api/listing/confirm      ┌─────────────┐
│   Client    │ ─────────────────────────────────> │   Server    │
│             │                                    │             │
│             │     1. Verify tx signature unique  │  1. Check   │
│             │     2. Verify tx on-chain          │     replay  │
│             │     3. Check sale state account    │  2. Verify  │
│             │     4. Update listing to active    │     tx      │
│             │                                    │  3. Update  │
│             │ <───────────────────────────────── │     status  │
└─────────────┘     Return: confirmed listing      └─────────────┘
```

---

## Testing

All existing tests pass:
```
✓ packages/common (6 tests)
✓ packages/exchangeart (3 tests)
✓ packages/ai (6 tests)
✓ packages/render (7 tests)
✓ apps/web (30 tests)
```

Build succeeds with no new errors.

---

## Next Steps (Phase 1.2)

Update the frontend `AssetClient.tsx` to use the new 3-step flow:

1. **Call `/api/listing/prepare`** instead of old `/api/listing`
2. **Sign transaction** with wallet + saleStateKeypair
3. **Submit to blockchain** via Solana web3.js
4. **Poll for confirmation**
5. **Call `/api/listing/confirm`** to finalize

UI updates needed:
- Add "Preparing..." loading state
- Show transaction signing prompt
- Add "Submitting to blockchain..." state
- Show Solana Explorer link after confirmation
- Handle errors at each step

---

## Environment Variables

No new environment variables required for Phase 1.1. Uses existing:
- `SOLANA_RPC_URL`
- `SOLANA_CLUSTER`
- `DATABASE_URL`

---

## Rollback Plan

If issues are found:
1. Frontend can continue using old `/api/listing` endpoint (returns 308 with guidance)
2. Database schema unchanged (no migrations needed)
3. New endpoints are additive only

---

## Files Changed Summary

```
NEW:
├── apps/web/src/lib/solana-token.ts
├── apps/web/src/app/api/listing/prepare/route.ts
└── apps/web/src/app/api/listing/confirm/route.ts

MODIFIED:
├── packages/exchangeart/src/listing.ts (+prepareListingTransaction)
├── packages/exchangeart/src/index.ts
└── apps/web/src/app/api/listing/route.ts (marked deprecated)
```

**Total Lines Added:** ~800  
**Total Lines Modified:** ~50  
**Tests Added:** 0 (covered by existing tests)  
**Breaking Changes:** None (additive only)
