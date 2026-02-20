# ArtMint Studio — Security & Hardening Audit Report v2

**Date:** 2026-02-20
**Scope:** Full production-readiness hardening pass
**Baseline:** Commit `9c62f7d` (MVP + v1 audit fixes applied)

---

## 1. Verification Commands

| Command | Result |
|---------|--------|
| `pnpm install` | Clean — 0 warnings |
| `pnpm lint` | 5 warnings (pre-existing `<img>` + exhaustive-deps — no errors) |
| `pnpm test` | **44/44 pass** (22 web + 6 AI + 7 render + 6 common + 3 exchangeart) |
| `pnpm build` | Success — all routes compiled, 15 pages |

---

## 2. Issues Fixed (v2 Hardening)

### P0 — Critical

| # | Issue | File(s) | Fix |
|---|-------|---------|-----|
| P0-1 | **No authentication on mutating endpoints** — any client could call `/api/ai/variations`, `/api/mint`, `/api/listing` without proving wallet ownership | All API route files | Implemented Sign-In With Solana (SIWS): nonce challenge → ed25519 signature verification → HMAC-signed httpOnly session cookie. All mutating endpoints now call `requireAuth()` and return 401 if unauthenticated. |
| P0-2 | **Unlimited AI cost drain** — no daily caps on AI generation; a script could exhaust the Anthropic API budget | `apps/web/src/app/api/ai/variations/route.ts` | Added per-user daily quota (default 10/day) and global daily circuit breaker (default 500/day). Returns 403 `quota_exceeded` or 503 `ai_paused`. |
| P0-3 | **IDOR: wallet from request body** — attacker could send any wallet in the POST body to mint/list as someone else | `route.ts` files for `/api/mint`, `/api/mint/confirm`, `/api/listing` | Wallet is now extracted exclusively from the authenticated session cookie — never from the request body. |
| P0-4 | **No on-chain tx verification in mint/confirm** — the confirm endpoint trusted client-supplied `txSignature` without checking it on-chain | `apps/web/src/app/api/mint/confirm/route.ts` | Added `verifyTransaction()` that checks: tx exists, confirmed, no errors, fee payer matches session wallet, recent (< 10 min), mint address in account keys. |

### P1 — High

| # | Issue | File(s) | Fix |
|---|-------|---------|-----|
| P1-1 | **In-memory rate limiter lost on restart / multi-instance** | `apps/web/src/lib/rate-limit.ts` | Replaced with DB-backed sliding window using Prisma `RateLimitWindow` model. Works across instances. |
| P1-2 | **No CORS protection** — cross-origin requests to API endpoints were allowed | `apps/web/src/middleware.ts` | Added Next.js middleware that blocks cross-origin API requests (checks `Origin` header against `NEXT_PUBLIC_APP_URL`). |
| P1-3 | **Missing security headers** — no CSP, X-Frame-Options, etc. | `apps/web/src/middleware.ts` | Added: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, and CSP for page routes. |
| P1-4 | **Client can't export 4K** — server render capped at 2160px, "Re-render 4K" only opened the artifact HTML | `apps/web/src/app/asset/[mintAddress]/AssetClient.tsx` | Added client-side 4K export: fetches SVG from render API → renders to Canvas at 3840px → exports PNG download. "Open Artifact" button retained as separate option. |
| P1-5 | **Session secret not enforced in production** | `apps/web/src/lib/auth.ts` | `getSessionSecret()` throws in production if `SESSION_SECRET` is unset or contains the dev placeholder. |

### P2 — Moderate

| # | Issue | File(s) | Fix |
|---|-------|---------|-----|
| P2-1 | **No ESLint config** — `pnpm lint` failed interactively | `apps/web/.eslintrc.json` | Created ESLint config extending `next/core-web-vitals`. |
| P2-2 | **Rate limit on AI not per-wallet** — only IP-based, trivially bypassed by multiple wallets from same IP | `apps/web/src/app/api/ai/variations/route.ts` | Added dual rate limiting: 20 req/min per IP + 5 req/min per authenticated wallet. |

---

## 3. New Files Created

| File | Purpose |
|------|---------|
| `apps/web/src/lib/auth.ts` | SIWS authentication: nonce generation, HMAC-signed session tokens, `requireAuth()`, `buildSignMessage()`, session cookie helpers |
| `apps/web/src/lib/quota.ts` | Per-user + global daily quota enforcement via Prisma `UsageCounter` model |
| `apps/web/src/lib/rate-limit.ts` | DB-backed sliding window rate limiter via Prisma `RateLimitWindow` model |
| `apps/web/src/lib/solana-verify.ts` | On-chain transaction verification (confirms tx existence, fee payer, recency, mint address) |
| `apps/web/src/middleware.ts` | CORS enforcement + security headers for all routes |
| `apps/web/src/app/api/auth/nonce/route.ts` | `GET` — returns SIWS nonce + message, stored in DB with 5-min expiry |
| `apps/web/src/app/api/auth/verify/route.ts` | `POST` — verifies ed25519 wallet signature, creates session, sets httpOnly cookie |
| `apps/web/src/app/api/auth/session/route.ts` | `GET` — returns current authentication status |
| `apps/web/src/app/api/auth/logout/route.ts` | `POST` — deletes session from DB, clears cookie |
| `apps/web/src/app/api/quota/route.ts` | `GET` — returns remaining daily AI quota for the authenticated user |
| `apps/web/src/__tests__/auth.test.ts` | Auth unit tests: nonce generation, session tokens, tamper rejection, expired tokens, SIWS message |
| `apps/web/src/__tests__/rate-limit.test.ts` | Rate limiter tests: IP extraction from x-forwarded-for |
| `apps/web/src/__tests__/solana-verify.test.ts` | TX verification tests: not found, on-chain error, too old, wrong fee payer, missing mint, valid tx, fail-open devnet vs fail-closed mainnet |
| `prisma/migrations/20260220120956_auth_quotas_ratelimit/` | Prisma migration adding AuthNonce, Session, UsageCounter, RateLimitWindow tables |
| `apps/web/.eslintrc.json` | ESLint configuration |

---

## 4. Modified Files

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Added 4 models: `AuthNonce`, `Session`, `UsageCounter`, `RateLimitWindow` |
| `apps/web/package.json` | Added `tweetnacl`, `bs58`, `vitest` deps; added `test` script |
| `apps/web/src/app/api/ai/variations/route.ts` | Auth + IP rate limit + wallet rate limit + daily quota + body size check |
| `apps/web/src/app/api/mint/route.ts` | Auth enforced, wallet from session (removed from body) |
| `apps/web/src/app/api/mint/confirm/route.ts` | Auth enforced, wallet from session, on-chain tx verification |
| `apps/web/src/app/api/listing/route.ts` | Auth enforced, wallet from session, ownership verification |
| `apps/web/src/app/api/render/route.ts` | Rate limiter now async (DB-backed) |
| `apps/web/src/app/studio/page.tsx` | Added SIWS sign-in flow, quota display, auth-gated generate button |
| `apps/web/src/app/asset/[mintAddress]/AssetClient.tsx` | Client-side 4K SVG-to-PNG export, removed wallet from listing body |
| `apps/web/src/components/DetailPanel.tsx` | Removed wallet from mint request body |
| `apps/web/src/lib/storage.ts` | Path traversal protection (basename + regex + resolve check) |
| `packages/common/src/schemas.ts` | superRefine for template-params validation, seed/title/tag limits |
| `.env.example` | Added `SESSION_SECRET`, `AI_MAX_DAILY_PER_USER`, `AI_MAX_DAILY_GLOBAL` |

---

## 5. Quota Policy & Environment Variables

### Environment variables (`.env.example`)

```bash
# Auth (REQUIRED in production)
SESSION_SECRET=<random-64-char-hex>  # HMAC key for session tokens

# AI quota limits
AI_MAX_DAILY_PER_USER=10   # Max AI generations per wallet per day
AI_MAX_DAILY_GLOBAL=500    # Global daily circuit breaker across all users

# Solana
SOLANA_RPC_URL=https://api.devnet.solana.com
SOLANA_CLUSTER=devnet      # "devnet" or "mainnet-beta"

# App URL (for CORS origin matching)
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Quota behavior

| Scenario | HTTP Status | Error Code | Response |
|----------|-------------|------------|----------|
| User exceeds daily limit (default 10) | 403 | `quota_exceeded` | `{ error, remaining: 0, limit, resetAt }` |
| Global daily cap reached (default 500) | 503 | `ai_paused` | `{ error, resetAt }` |
| Quotas reset | — | — | Midnight UTC daily (counter keyed by `YYYY-MM-DD`) |

### Rate limit behavior

| Endpoint | IP Limit | Wallet Limit |
|----------|----------|-------------|
| `/api/ai/variations` | 20 req/min | 5 req/min |
| `/api/mint` | 10 req/min | — |
| `/api/render` | 60 req/min | — |

---

## 6. Authentication Flow (SIWS)

```
Client                          Server
  │                                │
  │  GET /api/auth/nonce           │
  │ ─────────────────────────────▶ │  Generate random nonce
  │  { nonce, message }            │  Store in DB (5-min expiry)
  │ ◀───────────────────────────── │
  │                                │
  │  Wallet signs message          │
  │  (ed25519 detached signature)  │
  │                                │
  │  POST /api/auth/verify         │
  │  { wallet, nonce, signature }  │
  │ ─────────────────────────────▶ │  1. Validate nonce (exists, unused, not expired)
  │                                │  2. Verify ed25519 signature via tweetnacl
  │                                │  3. Mark nonce as used
  │                                │  4. Create session (DB + HMAC-signed cookie)
  │  Set-Cookie: artmint_session   │
  │  { success: true, wallet }     │
  │ ◀───────────────────────────── │
  │                                │
  │  Subsequent API calls          │
  │  Cookie: artmint_session=...   │
  │ ─────────────────────────────▶ │  requireAuth() validates cookie
  │                                │  Extracts wallet from session
```

Session cookie properties:
- `httpOnly: true` (no JS access)
- `secure: true` (HTTPS only, in production)
- `sameSite: strict` (CSRF protection)
- `maxAge: 86400` (24 hours)
- Backed by DB session record (can be invalidated server-side via logout)

---

## 7. Testing Locally

### Prerequisites
```bash
pnpm install
cp .env.example .env  # Edit SESSION_SECRET for production
pnpm prisma:migrate   # Apply all migrations
```

### Test auth flow
1. Start dev server: `pnpm dev`
2. Open `/studio` — should see "Connect your wallet" banner
3. Connect a Phantom/Solflare wallet
4. Click "Sign In With Solana" — wallet will prompt to sign a message
5. After signing, the button disappears and quota counter appears
6. Generate variations — counter decrements

### Test quota exhaustion
```bash
# Set a low limit for testing
AI_MAX_DAILY_PER_USER=2 pnpm dev

# Generate 2 times — 3rd should return 403 with code "quota_exceeded"
```

### Test circuit breaker
```bash
AI_MAX_DAILY_GLOBAL=1 pnpm dev

# After 1 generation from any user, all subsequent return 503 with code "ai_paused"
```

### Test 401 on mutating endpoints
```bash
# Without a session cookie:
curl -X POST http://localhost:3000/api/ai/variations \
  -H "content-type: application/json" \
  -d '{"prompt":"test"}'
# → 401 { "error": "Authentication required", "code": "auth_required" }

curl -X POST http://localhost:3000/api/mint \
  -H "content-type: application/json" \
  -d '{"templateId":"flow_fields","seed":1,"palette":["#ff0000"],"params":{}}'
# → 401

curl -X POST http://localhost:3000/api/listing \
  -H "content-type: application/json" \
  -d '{"mintAddress":"test","priceLamports":"1000000000"}'
# → 401
```

### Test tx verification
```bash
# In mint/confirm, an invalid txSignature will be checked on-chain:
curl -X POST http://localhost:3000/api/mint/confirm \
  -H "content-type: application/json" \
  -H "cookie: artmint_session=<valid-session>" \
  -d '{"mintAddress":"...","txSignature":"invalid"}'
# → 400 "Transaction not found on-chain" (on mainnet)
# → warning logged (on devnet, fail-open)
```

### Run the full test suite
```bash
pnpm test        # 44 tests across 5 packages
pnpm lint        # 5 pre-existing warnings, 0 errors
pnpm build       # Clean production build
```

---

## 8. Remaining Recommendations (Future Work)

| Priority | Item | Notes |
|----------|------|-------|
| P2 | Session cleanup cron | Expired `Session`, `AuthNonce`, `RateLimitWindow` rows accumulate. Add a daily cleanup job or Prisma middleware. |
| P2 | CSRF double-submit cookie | Current `sameSite: strict` + origin check provides good CSRF protection, but a double-submit token would add defense-in-depth. |
| P3 | Upgrade `<img>` to `<Image>` | 3 ESLint warnings for Next.js `<Image>` component — cosmetic perf improvement. |
| P3 | Move SESSION_SECRET to a secrets manager | Currently in `.env` — for production, use a proper secrets manager (AWS Secrets Manager, Vault, etc.). |
| P3 | Add structured logging | Replace `console.error` with a structured logger (pino, winston) for production observability. |
| P3 | IP rate limit spoofing | `x-forwarded-for` is trusted. In production, configure the reverse proxy to set a trusted IP header. |

---

## 9. Architecture Summary

```
┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│   Client     │───▶│  Middleware   │───▶│   API Routes     │
│  (React +    │    │  - CORS      │    │  - requireAuth() │
│   Wallet     │    │  - CSP       │    │  - checkRateLimit│
│   Adapter)   │    │  - Security  │    │  - checkQuota()  │
│              │    │    Headers   │    │  - verifyTx()    │
└─────────────┘    └──────────────┘    └────────┬────────┘
                                                │
                                    ┌───────────┴──────────┐
                                    │     Prisma (SQLite)   │
                                    │  - Mint, Listing      │
                                    │  - AuthNonce, Session  │
                                    │  - UsageCounter       │
                                    │  - RateLimitWindow    │
                                    └──────────────────────┘
```

All mutating endpoints (`POST`) require authenticated sessions.
Read-only endpoints (`GET /api/render`, `GET /api/auth/nonce`) are rate-limited but public.
