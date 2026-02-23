# ArtMint Studio - Production Readiness Checklist

Use this checklist before deploying to mainnet.

## 🔴 Critical - Must Fix Before Production

### Security
- [ ] **SESSION_SECRET** is set to a secure 64-character hex value (not the dev default)
- [ ] **SOLANA_RPC_URL** uses a dedicated provider (Helius/QuickNode), NOT public RPC
- [ ] **SOLANA_RPC_BACKUP_URL** is configured for failover
- [ ] All API routes have proper authentication checks
- [ ] Rate limiting is enabled and configured
- [ ] CORS is properly configured in middleware

### Environment Variables
- [ ] `NEXT_PUBLIC_APP_URL` points to production domain
- [ ] `SOLANA_CLUSTER` is set to `mainnet-beta`
- [ ] `STORAGE_PROVIDER` is set to `vercel-blob` (not `local`)
- [ ] `BLOB_READ_WRITE_TOKEN` is configured
- [ ] `DATABASE_URL` uses production database with SSL
- [ ] `AI_API_KEY` is a production key with appropriate limits

### Smart Contracts
- [ ] All Exchange Art program IDs verified against official sources
- [ ] Test mint transaction successful on mainnet
- [ ] Test listing transaction successful on mainnet
- [ ] Transaction fees configured for mainnet congestion

## 🟡 Important - Should Fix Before Production

### Monitoring
- [ ] Health check endpoint `/api/health` is accessible
- [ ] Error tracking configured (Sentry recommended)
- [ ] Database monitoring enabled
- [ ] RPC latency monitoring enabled

### Performance
- [ ] Database indexes are created (see below)
- [ ] Connection pooling configured for database
- [ ] Static assets served via CDN

### Database
```sql
-- Run these to ensure indexes exist
CREATE INDEX IF NOT EXISTS "Session_wallet_idx" ON "Session"("wallet");
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX IF NOT EXISTS "AuthNonce_expiresAt_idx" ON "AuthNonce"("expiresAt");
CREATE INDEX IF NOT EXISTS "Mint_wallet_idx" ON "Mint"("wallet");
CREATE INDEX IF NOT EXISTS "Mint_txSignature_idx" ON "Mint"("txSignature");
CREATE INDEX IF NOT EXISTS "Listing_status_idx" ON "Listing"("status");
CREATE INDEX IF NOT EXISTS "RateLimitWindow_key_idx" ON "RateLimitWindow"("key");
```

## 🟢 Nice to Have

### UX Improvements
- [ ] Custom error pages (404, 500)
- [ ] Loading states for all async operations
- [ ] Transaction status notifications

### Analytics
- [ ] Web analytics configured
- [ ] On-chain analytics via Helius webhooks
- [ ] Custom event tracking

### Documentation
- [ ] User documentation complete
- [ ] API documentation available
- [ ] Troubleshooting guide created

---

## Pre-Launch Testing

### Functional Testing
- [ ] Wallet connection works on mainnet
- [ ] AI variation generation works
- [ ] Mint flow completes end-to-end
- [ ] Listing flow completes end-to-end
- [ ] Upload flow works for images
- [ ] Profile page displays user's NFTs
- [ ] Asset detail page shows correct data

### Security Testing
- [ ] Rate limiting triggers correctly
- [ ] Authentication blocks unauthorized requests
- [ ] CORS blocks cross-origin requests to API
- [ ] Session expires correctly
- [ ] Transaction replay protection works

### Performance Testing
- [ ] Page load time < 3 seconds
- [ ] API response time < 500ms (p95)
- [ ] Database queries < 100ms (p95)

---

## Launch Day Checklist

### Before Launch
- [ ] All environment variables configured in production
- [ ] Database migrations applied
- [ ] Health check returns 200
- [ ] Test transactions successful
- [ ] Monitoring dashboards accessible
- [ ] Team has access to logs and metrics

### During Launch
- [ ] Monitor error rates closely
- [ ] Watch AI quota usage
- [ ] Monitor RPC latency
- [ ] Check database connection pool

### After Launch
- [ ] Verify first real user transactions
- [ ] Check that NFTs appear on Exchange Art
- [ ] Monitor for 24 hours
- [ ] Review and document any issues

---

## Post-Launch Monitoring

### Daily
- [ ] Check error rates
- [ ] Review AI quota usage
- [ ] Monitor RPC health
- [ ] Check database performance

### Weekly
- [ ] Review transaction success rates
- [ ] Analyze user behavior
- [ ] Check for security alerts
- [ ] Review and rotate logs

### Monthly
- [ ] Security audit of dependencies
- [ ] Performance optimization review
- [ ] Cost analysis (AI, RPC, storage)
- [ ] Disaster recovery test

---

**Sign-off**

| Role | Name | Signature | Date |
|------|------|-----------|------|
| Tech Lead | | | |
| Security Review | | | |
| Product Owner | | | |
