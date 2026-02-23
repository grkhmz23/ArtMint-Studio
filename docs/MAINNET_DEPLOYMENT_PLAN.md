# ArtMint Studio - Mainnet Deployment Plan

> **Status:** Ready for Implementation  
> **Last Updated:** 2026-02-23  
> **Target Mainnet Launch:** T+2 weeks after Phase 1 completion

---

## 📋 Executive Summary

This plan addresses all critical issues identified in the security audit. Phase 1 (Exchange Art listing fix) is the mainnet blocker. Phases 2-4 can be completed in parallel or sequentially based on team capacity.

---

## 🚨 PHASE 1: Fix Exchange Art Listing Flow (CRITICAL - MAINNET BLOCKER)

**Estimated Duration:** 3-4 days  
**Priority:** P0 - MUST COMPLETE BEFORE MAINNET  
**Dependencies:** None

### Problem
The current listing flow only creates a database record. The on-chain Exchange Art transaction is never built, signed, or submitted.

### Solution Architecture
Implement a 3-step listing flow:
1. **Prepare** → Build unsigned transaction, return to client
2. **Sign** → Wallet signs transaction (including sale state keypair)
3. **Confirm** → Submit to chain, update database

### Implementation Steps

#### Step 1.1: Create Listing Transaction Builder API (Day 1)
**Files:**
- `apps/web/src/app/api/listing/prepare/route.ts` (NEW)
- `packages/exchangeart/src/listing.ts` (MODIFY)

**Tasks:**
- [ ] Create new API route `/api/listing/prepare`
- [ ] Refactor `buildCreateBuyNowTransaction` to return full transaction details including `saleStateKeypair`
- [ ] Return serialized transaction + saleStateKeypair public key to client
- [ ] Add validation that user owns the NFT (on-chain check)

**Key Code Changes:**
```typescript
// Return saleStateKeypair secret key for client signing
return {
  transaction: transaction.serialize({ requireAllSignatures: false }),
  saleStatePublicKey: saleStateKeypair.publicKey.toBase58(),
  saleStateSecretKey: Buffer.from(saleStateKeypair.secretKey).toString('base64'),
};
```

#### Step 1.2: Update Frontend Listing Flow (Day 1-2)
**Files:**
- `apps/web/src/app/asset/[mintAddress]/AssetClient.tsx` (MODIFY)
- `apps/web/src/components/listing/ListingFlow.tsx` (NEW)

**Tasks:**
- [ ] Replace direct `/api/listing` call with new 3-step flow
- [ ] Call `/api/listing/prepare` to get unsigned transaction
- [ ] Use `@solana/web3.js` to partially sign with saleStateKeypair
- [ ] Use wallet adapter to sign with user's wallet
- [ ] Send fully signed transaction to chain
- [ ] Poll for confirmation
- [ ] Call `/api/listing/confirm` to update database

**UI Changes:**
- Add "Preparing..." → "Sign Transaction" → "Submitting..." → "Listed!" states
- Show transaction explorer link after confirmation

#### Step 1.3: Create Listing Confirmation API (Day 2)
**Files:**
- `apps/web/src/app/api/listing/confirm/route.ts` (NEW)

**Tasks:**
- [ ] Accept `mintAddress`, `txSignature`, `saleStateKey`
- [ ] Verify transaction on-chain (use existing `verifyTransaction`)
- [ ] Verify the sale state account was created
- [ ] Update database with `status: "active"`, `txSignature`, `saleStateKey`
- [ ] Add transaction replay protection

#### Step 1.4: Add Token Ownership Verification (Day 3)
**Files:**
- `apps/web/src/lib/solana-token.ts` (NEW)
- `apps/web/src/app/api/listing/prepare/route.ts` (MODIFY)

**Tasks:**
- [ ] Create helper to verify ATA ownership
- [ ] Check that user has token balance > 0 before allowing listing
- [ ] Return helpful error if NFT was transferred

#### Step 1.5: End-to-End Testing (Day 3-4)
**Test Scenarios:**
- [ ] Happy path: List NFT successfully on devnet
- [ ] Reject: User doesn't own NFT
- [ ] Reject: NFT already listed
- [ ] Reject: Transaction simulation fails
- [ ] Handle: User rejects wallet signature
- [ ] Handle: Transaction times out
- [ ] Verify: Listing appears on Exchange Art (devnet)

**Files:**
- `apps/web/src/__tests__/listing.test.ts` (NEW)

---

## ⚡ PHASE 2: RPC Provider & Transaction Reliability

**Estimated Duration:** 2-3 days  
**Priority:** P1 - HIGH  
**Dependencies:** None (can parallel with Phase 1)

### 2.1: Switch to Dedicated RPC Provider

**Files:**
- `apps/web/src/lib/solana-verify.ts` (MODIFY)
- `apps/web/src/lib/rpc.ts` (NEW)
- `apps/web/src/app/providers.tsx` (MODIFY)

**Tasks:**
- [ ] Sign up for Helius/QuickNode (mainnet + devnet)
- [ ] Add environment variables:
  ```
  SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=xxx
  SOLANA_RPC_DEVNET_URL=https://devnet.helius-rpc.com/?api-key=xxx
  SOLANA_RPC_BACKUP_URL=https://sleek-orbital-rain.solana-mainnet.quiknode.pro/xxx
  ```
- [ ] Create `RpcManager` class with:
  - Primary + backup RPC endpoints
  - Health check polling
  - Automatic failover
  - Request timeout handling (30s)
- [ ] Update all `Connection` usages to use `RpcManager`
- [ ] Add RPC latency metrics logging

**Key Code:**
```typescript
export class RpcManager {
  private endpoints: string[];
  private healthyIndex = 0;
  
  async getConnection(): Promise<Connection> {
    // Try primary, failover to backup
  }
  
  async healthCheck(): Promise<void> {
    // Poll all endpoints every 30s
  }
}
```

### 2.2: Add Compute Unit Limits & Priority Fees

**Files:**
- `packages/exchangeart/src/mint.ts` (MODIFY)
- `packages/exchangeart/src/listing.ts` (MODIFY)
- `packages/exchangeart/src/fees.ts` (NEW)

**Tasks:**
- [ ] Add `ComputeBudgetProgram` instructions to all transactions
- [ ] Set compute unit limit based on simulation (mint: 200k, listing: 100k)
- [ ] Add priority fee configuration:
  ```typescript
  // Default: 0.000005 SOL
  // High congestion: 0.0001 SOL
  const priorityFeeMicroLamports = process.env.PRIORITY_FEE_MICRO_LAMPORTS 
    ? parseInt(process.env.PRIORITY_FEE_MICRO_LAMPORTS) 
    : 5000;
  ```
- [ ] Create fee estimation helper that checks recent prioritization fees

**Code Template:**
```typescript
import { ComputeBudgetProgram } from "@solana/web3.js";

export function addPriorityFees(
  transaction: Transaction,
  computeUnits: number = 200000,
  priorityFeeMicroLamports: number = 5000
): void {
  transaction.add(
    ComputeBudgetProgram.setComputeUnitLimit({ units: computeUnits }),
    ComputeBudgetProgram.setComputeUnitPrice({ 
      microLamports: priorityFeeMicroLamports 
    })
  );
}
```

### 2.3: Add Transaction Retry Logic

**Files:**
- `packages/exchangeart/src/retry.ts` (NEW)
- `apps/web/src/lib/transaction.ts` (NEW)

**Tasks:**
- [ ] Create `TransactionSender` class with:
  - Blockhash refresh (every 60s)
  - Retry with exponential backoff (3 retries)
  - Pre-flight simulation
  - Confirmation polling with timeout
- [ ] Handle specific error codes:
  - `BlockhashNotFound` → Refresh blockhash, retry
  - `InsufficientFunds` → Fail immediately
  - `AlreadyProcessed` → Success
  - `Timeout` → Poll for confirmation

**Key Code:**
```typescript
export interface SendOptions {
  maxRetries?: number;
  confirmationTimeout?: number;
  skipPreflight?: boolean;
}

export async function sendAndConfirmWithRetry(
  connection: Connection,
  transaction: Transaction,
  signers: Keypair[],
  options: SendOptions = {}
): Promise<{ signature: string; confirmed: boolean }> {
  // Implementation with retry logic
}
```

---

## 📊 PHASE 3: Testing & Monitoring Infrastructure

**Estimated Duration:** 3-4 days  
**Priority:** P2 - MEDIUM  
**Dependencies:** Phase 1 recommended

### 3.1: Comprehensive Logging & Monitoring

**Files:**
- `apps/web/src/lib/logger.ts` (NEW)
- `apps/web/src/middleware.ts` (MODIFY)

**Tasks:**
- [ ] Create structured logger with levels (error, warn, info, debug)
- [ ] Add request logging middleware:
  - Method, path, IP, wallet (if auth), duration, status
- [ ] Add transaction logging:
  - Mint attempts, successes, failures
  - Listing attempts, successes, failures
  - AI generation usage
- [ ] Add performance logging:
  - AI generation duration
  - Image processing time
  - DB query duration
- [ ] Integrate with Vercel Logs (structured JSON)

**Log Format:**
```json
{
  "timestamp": "2026-02-23T12:00:00Z",
  "level": "info",
  "component": "mint",
  "wallet": "ABC...",
  "action": "mint_confirmed",
  "mintAddress": "DEF...",
  "txSignature": "...",
  "duration": 15000,
  "templateId": "flow_fields"
}
```

### 3.2: Automated Testing for Transaction Flows

**Files:**
- `apps/web/src/__tests__/e2e/mint.e2e.test.ts` (NEW)
- `apps/web/src/__tests__/e2e/listing.e2e.test.ts` (NEW)
- `packages/exchangeart/src/__tests__/transactions.test.ts` (NEW)

**Tasks:**
- [ ] Create e2e test suite using `@solana/web3.js` + local validator
- [ ] Test full mint flow:
  - Prepare → Confirm transaction building
  - Verify metadata structure
  - Verify on-chain state
- [ ] Test listing flow:
  - Build listing transaction
  - Verify account creation
  - Verify Exchange Art program integration
- [ ] Add transaction simulation tests
- [ ] Add property-based tests for deterministic rendering

**Test Environment:**
```bash
# Use solana-test-validator for local testing
solana-test-validator --reset --bpf-program EXBuY... editions_program_solana.so
```

### 3.3: Health Check Endpoints

**Files:**
- `apps/web/src/app/api/health/route.ts` (NEW)
- `apps/web/src/app/api/health/deep/route.ts` (NEW)

**Tasks:**
- [ ] Basic health check (`/api/health`):
  - Returns 200 if app is running
  - Quick response (< 100ms)
- [ ] Deep health check (`/api/health/deep`):
  - Database connectivity
  - RPC connectivity
  - Storage provider (Vercel Blob) access
  - AI provider availability
  - Returns detailed status for each dependency

**Response Format:**
```json
{
  "status": "healthy",
  "timestamp": "2026-02-23T12:00:00Z",
  "checks": {
    "database": { "status": "ok", "latency": "12ms" },
    "rpc": { "status": "ok", "latency": "45ms" },
    "storage": { "status": "ok" },
    "ai": { "status": "ok" }
  }
}
```

### 3.4: RPC Failure Alerts

**Files:**
- `apps/web/src/lib/alerts.ts` (NEW)
- `apps/web/src/app/api/cron/health-check/route.ts` (NEW)

**Tasks:**
- [ ] Set up Vercel Cron job (every 5 minutes)
- [ ] Monitor RPC health:
  - Response time > 2s → Warning
  - Response time > 5s or failure → Critical
  - 3 consecutive failures → Alert
- [ ] Alert channels:
  - Email to admin
  - Slack webhook (optional)
  - Log to error tracking service
- [ ] Automatic failover logging

**Alert Template:**
```
🚨 ArtMint RPC Alert
Endpoint: mainnet.helius-rpc.com
Status: Down (3 consecutive failures)
Error: Request timeout after 30s
Failover: Activated (backup: quicknode)
Time: 2026-02-23 12:00:00 UTC
```

### 3.5: Queue for Mint Processing (Optional)

**Files:**
- `apps/web/src/lib/queue.ts` (NEW)
- `apps/web/src/app/api/jobs/process/route.ts` (NEW)

**Tasks:**
- [ ] Evaluate need based on launch volume
- [ ] Implement using:
  - Option A: In-memory queue (bullmq)
  - Option B: Vercel KV + Cron
  - Option C: External (QStash, Inngest)
- [ ] Queue operations:
  - Image generation
  - Metadata upload
  - Transaction submission
- [ ] Retry with exponential backoff
- [ ] Dead letter queue for failed jobs

---

## 🔒 PHASE 4: Long-term Security Hardening

**Estimated Duration:** 1-2 weeks  
**Priority:** P3 - LOW (Post-launch)  
**Dependencies:** Stable mainnet deployment

### 4.1: Formal Verification for Transaction Builders

**Files:**
- `packages/exchangeart/src/verified/` (NEW DIRECTORY)

**Tasks:**
- [ ] Document all transaction invariants:
  - Account relationships
  - Data field constraints
  - PDA derivations
- [ ] Add runtime assertions for invariants
- [ ] Consider using @solana/kit for type-safe transactions
- [ ] Independent security audit (recommended)

### 4.2: Multi-sig for Admin Functions

**Tasks:**
- [ ] Identify admin operations (if any)
- [ ] Set up Squads or Snowflake multi-sig
- [ ] Document admin key management procedures
- [ ] Add timelock for critical operations

### 4.3: Immutable Deployments

**Tasks:**
- [ ] Set up reproducible builds
- [ ] Pin all dependencies with exact versions
- [ ] Use Vercel Git integration for traceability
- [ ] Document deployment rollback procedures

### 4.4: Bug Bounty Program

**Tasks:**
- [ ] Define scope (smart contracts, web app, API)
- [ ] Set reward tiers:
  - Critical: $5,000 - $10,000
  - High: $1,000 - $5,000
  - Medium: $250 - $1,000
  - Low: $100 - $250
- [ ] Create SECURITY.md with disclosure process
- [ ] List on Immunefi or similar platform

---

## 📅 Implementation Timeline

### Week 1: Critical Path (Phase 1)
| Day | Task | Owner | Output |
|-----|------|-------|--------|
| 1 | Step 1.1: Listing Transaction Builder | Dev | API working on devnet |
| 1-2 | Step 1.2: Frontend Listing Flow | Dev | UI with 3-step flow |
| 2 | Step 1.3: Listing Confirmation API | Dev | Confirmation endpoint |
| 3 | Step 1.4: Token Ownership Check | Dev | Ownership verification |
| 3-4 | Step 1.5: E2E Testing | QA | All test scenarios pass |

### Week 2: Reliability (Phase 2 + Phase 3 start)
| Day | Task | Owner | Output |
|-----|------|-------|--------|
| 1 | 2.1: RPC Provider Setup | Dev | Helius/QuickNode accounts |
| 1-2 | 2.2: Priority Fees | Dev | All tx have priority fees |
| 2-3 | 2.3: Transaction Retry | Dev | Retry logic working |
| 3-4 | 3.1: Logging | Dev | Structured logs in Vercel |
| 4-5 | 3.3: Health Checks | Dev | /api/health endpoints |

### Week 3: Monitoring & Testing (Phase 3 completion)
| Day | Task | Owner | Output |
|-----|------|-------|--------|
| 1-2 | 3.2: Automated Tests | QA | E2E test suite |
| 2-3 | 3.4: RPC Alerts | Dev | Alert system active |
| 3-4 | 3.5: Queue (if needed) | Dev | Queue implementation |
| 4-5 | Integration Testing | QA | Full flow tested |

### Week 4: Launch Prep & Hardening
| Day | Task | Owner | Output |
|-----|------|-------|--------|
| 1-2 | Final security review | Security | Sign-off document |
| 2-3 | Mainnet dry run | All | Test on mainnet-beta |
| 3-4 | Documentation | Dev | Deployment docs |
| 4-5 | Launch! | All | Live on mainnet |

---

## 🎯 Success Criteria

### Phase 1 Complete When:
- [ ] User can list NFT on Exchange Art from UI
- [ ] Transaction succeeds on devnet 10/10 times
- [ ] Ownership verification prevents unauthorized listings
- [ ] E2E tests pass

### Phase 2 Complete When:
- [ ] Using dedicated RPC (not public endpoint)
- [ ] All transactions include priority fees
- [ ] Transaction success rate > 99% (no blockhash failures)

### Phase 3 Complete When:
- [ ] All requests logged with structured format
- [ ] Health checks pass all dependencies
- [ ] RPC failover works automatically
- [ ] E2E tests run in CI/CD

### Mainnet Launch Ready When:
- [ ] All Phase 1-3 complete
- [ ] Security audit passed (or no critical issues)
- [ ] Team has runbook for common issues
- [ ] Monitoring dashboard configured

---

## 📝 Appendix

### Environment Variables Reference

```bash
# Core
NEXT_PUBLIC_APP_URL=https://artmint.studio
SESSION_SECRET=<64-char-hex>

# Solana (Dedicated RPC REQUIRED)
SOLANA_CLUSTER=mainnet-beta
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=xxx
SOLANA_RPC_BACKUP_URL=https://...quiknode.pro/xxx
NEXT_PUBLIC_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=xxx

# Transaction Fees
PRIORITY_FEE_MICRO_LAMPORTS=5000
COMPUTE_UNIT_LIMIT_MINT=200000
COMPUTE_UNIT_LIMIT_LISTING=100000

# AI
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-...
AI_MODEL=claude-sonnet-4-20250514

# Database
DATABASE_URL=postgresql://...

# Storage
STORAGE_PROVIDER=vercel-blob
BLOB_READ_WRITE_TOKEN=vercel_blob_...
BLOB_ACCESS=public

# Quotas
AI_MAX_DAILY_PER_USER=10
AI_MAX_DAILY_GLOBAL=500

# Monitoring (optional)
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
ALERT_EMAIL=admin@artmint.studio
```

### Testing Checklist

```
□ Connect wallet
□ Generate AI variations (all presets)
□ Mint NFT (flow_fields template)
□ Mint NFT (jazz_noir template)
□ Mint custom code NFT
□ Upload and mint image
□ List NFT on Exchange Art
□ Cancel listing
□ View NFT on asset page
□ Export 4K PNG
□ Download HTML artifact
□ View live render
□ Check dashboard stats
□ Test rate limiting
□ Test quota enforcement
□ Test session expiration
□ Test wallet switching
```

---

**Next Step:** Begin Phase 1.1 - Create the listing transaction builder API.
