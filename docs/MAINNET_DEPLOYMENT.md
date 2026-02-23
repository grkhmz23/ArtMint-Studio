# ArtMint Studio - Mainnet Deployment Guide

This guide covers everything needed to deploy ArtMint Studio to Solana mainnet.

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Infrastructure Requirements](#infrastructure-requirements)
3. [Environment Configuration](#environment-configuration)
4. [Database Setup](#database-setup)
5. [Deployment Steps](#deployment-steps)
6. [Post-Deployment Verification](#post-deployment-verification)
7. [Monitoring & Alerting](#monitoring--alerting)
8. [Emergency Procedures](#emergency-procedures)

---

## Pre-Deployment Checklist

### ✅ Critical Security Items

- [ ] **SESSION_SECRET**: Generate a new 64-character hex string using `openssl rand -hex 32`
- [ ] **SOLANA_RPC_URL**: Use a dedicated RPC provider (Helius/QuickNode), NOT public RPC
- [ ] **SOLANA_RPC_BACKUP_URL**: Configure a backup RPC endpoint
- [ ] **AI_API_KEY**: Use a production API key with appropriate rate limits
- [ ] **BLOB_READ_WRITE_TOKEN**: Configure Vercel Blob for production storage
- [ ] **DATABASE_URL**: Use a production PostgreSQL instance with SSL

### ✅ Smart Contract Verification

- [ ] Verify all Exchange Art program IDs are correct:
  - Code Canvas: `CoCaSGpuNso2yQP3oqi1tXt82wBp3y78SJDwLCboc8WS`
  - Buy Now + Editions: `EXBuYPNgBUXMTsjCbezENRUtFQzjUNZxvPGTd11Pznk5`
  - Offers: `exofLDXJoFji4Qyf9jSAH59J4pp82UT5pmGgR6iT24Z`
- [ ] Test mint transaction on mainnet with small amount
- [ ] Test listing transaction on mainnet with small amount

### ✅ Rate Limiting & Quotas

- [ ] Configure `AI_MAX_DAILY_PER_USER` (suggested: 10-20 for production)
- [ ] Configure `AI_MAX_DAILY_GLOBAL` (suggested: 500-2000 for production)
- [ ] Verify rate limiting middleware is active

---

## Infrastructure Requirements

### RPC Providers (REQUIRED)

**Primary Options:**
- **Helius** (Recommended): https://helius.xyz
  - Offers enhanced APIs and Webhooks
  - Good for NFT metadata fetching
  
- **QuickNode**: https://quicknode.com
  - Reliable, global infrastructure
  - Good for high-throughput applications

**Configuration:**
```bash
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY
SOLANA_RPC_BACKUP_URL=https://YOUR_QUICKNODE_ENDPOINT.solana-mainnet.quiknode.pro/YOUR_TOKEN/
```

### Database

**Requirements:**
- PostgreSQL 14+
- SSL/TLS connections enforced
- Automated backups enabled
- Connection pooling (PgBouncer recommended for high traffic)

**Recommended Providers:**
- Vercel Postgres (if deploying on Vercel)
- Supabase
- AWS RDS
- Google Cloud SQL

### Storage

**For Production:**
- Vercel Blob (recommended for Vercel deployments)
- Arweave (for permanent storage)
- IPFS with pinning service

**Configuration:**
```bash
STORAGE_PROVIDER=vercel-blob
BLOB_ACCESS=public
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

---

## Environment Configuration

### Required Environment Variables

```bash
# App
NEXT_PUBLIC_APP_URL=https://artmint.studio

# Solana - MAINNET
SOLANA_CLUSTER=mainnet-beta
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY
SOLANA_RPC_BACKUP_URL=https://YOUR_BACKUP_RPC.com
NEXT_PUBLIC_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_API_KEY

# AI Provider
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-api03-YOUR_API_KEY
AI_MODEL=claude-sonnet-4-20250514

# Storage
STORAGE_PROVIDER=vercel-blob
BLOB_ACCESS=public
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...

# Database
DATABASE_URL=postgresql://user:pass@host:5432/artmint?sslmode=require

# Auth (CRITICAL - generate with: openssl rand -hex 32)
SESSION_SECRET=YOUR_64_CHAR_HEX_SECRET_HERE

# Quotas
AI_MAX_DAILY_PER_USER=20
AI_MAX_DAILY_GLOBAL=2000

# Transaction Settings (optional)
PRIORITY_FEE_MICRO_LAMPORTS=5000
COMPUTE_UNIT_LIMIT_MINT=200000
COMPUTE_UNIT_LIMIT_LISTING=100000
```

### Security Warnings

⚠️ **NEVER commit `.env` files to git!**

⚠️ **NEVER use these values in production:**
- `SESSION_SECRET=dev-secret-do-not-use-in-production...`
- `SOLANA_RPC_URL=https://api.mainnet-beta.solana.com` (public RPC)
- `STORAGE_PROVIDER=local`

---

## Database Setup

### 1. Create Production Database

```bash
# Create database
createdb artmint_production

# Run migrations
pnpm db:migrate
```

### 2. Verify Indexes

Ensure these indexes exist for performance:

```sql
-- Auth indexes
CREATE INDEX IF NOT EXISTS "Session_wallet_idx" ON "Session"("wallet");
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX IF NOT EXISTS "AuthNonce_expiresAt_idx" ON "AuthNonce"("expiresAt");

-- Mint indexes
CREATE INDEX IF NOT EXISTS "Mint_wallet_idx" ON "Mint"("wallet");
CREATE INDEX IF NOT EXISTS "Mint_txSignature_idx" ON "Mint"("txSignature");

-- Listing indexes
CREATE INDEX IF NOT EXISTS "Listing_status_idx" ON "Listing"("status");

-- Rate limiting indexes
CREATE INDEX IF NOT EXISTS "RateLimitWindow_key_idx" ON "RateLimitWindow"("key");
```

### 3. Backup Strategy

- Enable automated daily backups
- Test restore procedure before going live
- Consider point-in-time recovery for critical data

---

## Deployment Steps

### Option 1: Vercel Deployment (Recommended)

1. **Connect Repository**
   ```bash
   vercel --prod
   ```

2. **Configure Environment Variables**
   - Go to Project Settings → Environment Variables
   - Add all variables from the configuration section
   - Mark `SESSION_SECRET` and `AI_API_KEY` as sensitive

3. **Configure Domain**
   - Add custom domain in Vercel dashboard
   - Update `NEXT_PUBLIC_APP_URL` accordingly

4. **Deploy**
   ```bash
   git push origin main
   # Or trigger manually: vercel --prod
   ```

### Option 2: Self-Hosted

1. **Build Application**
   ```bash
   pnpm install
   pnpm build
   ```

2. **Start Production Server**
   ```bash
   pnpm start
   # Or with PM2 for process management
   pm2 start pnpm --name "artmint" -- start
   ```

---

## Post-Deployment Verification

### 1. Health Check

```bash
curl https://your-domain.com/api/health
```

Expected response:
```json
{
  "status": "healthy",
  "checks": [
    { "name": "database", "status": "healthy" },
    { "name": "solana-rpc", "status": "healthy" },
    { "name": "configuration", "status": "healthy" },
    { "name": "storage", "status": "healthy" }
  ]
}
```

### 2. End-to-End Testing

1. **Connect Wallet**
   - Verify wallet adapter works
   - Confirm mainnet network detection

2. **Test AI Generation**
   - Generate variations
   - Verify rate limiting works

3. **Test Mint Flow**
   - Mint a test NFT (use minimal cost)
   - Verify transaction confirmation
   - Check metadata on-chain

4. **Test Listing Flow**
   - List the test NFT
   - Verify Exchange Art integration
   - Test cancellation if needed

5. **Test Upload Flow**
   - Upload a test image
   - Verify all three files stored correctly

### 3. Security Verification

```bash
# Check security headers
curl -I https://your-domain.com

# Verify CSP headers
curl -I https://your-domain.com | grep -i content-security-policy

# Test CORS (should fail from wrong origin)
curl -H "Origin: https://evil.com" https://your-domain.com/api/health
```

---

## Monitoring & Alerting

### Recommended Tools

1. **Vercel Analytics** (if on Vercel)
   - Built-in performance monitoring
   - Web Vitals tracking

2. **Helius Webhooks**
   - Monitor on-chain events
   - Track NFT sales/transfers

3. **Database Monitoring**
   - Connection pool usage
   - Query performance
   - Error rates

### Key Metrics to Monitor

| Metric | Warning Threshold | Critical Threshold |
|--------|------------------|-------------------|
| API Response Time | > 500ms | > 2000ms |
| RPC Latency | > 1000ms | > 5000ms |
| Database Connections | > 80% | > 95% |
| Error Rate | > 1% | > 5% |
| AI API Quota | > 80% | > 95% |

### Health Check Alerts

Set up alerts for:
- Health check returns non-200 status
- Database connectivity issues
- RPC endpoint failures
- High error rates

---

## Emergency Procedures

### RPC Failover

The application has automatic RPC failover. If the primary fails:

1. Check `/api/health` to see which endpoint is active
2. Verify backup RPC is configured: `SOLANA_RPC_BACKUP_URL`
3. If all RPCs fail, check provider status pages

### Database Issues

1. **Connection Pool Exhausted**
   - Check for connection leaks
   - Restart application to clear stale connections
   - Consider increasing pool size

2. **Database Down**
   - Verify DATABASE_URL is correct
   - Check provider status page
   - Restore from backup if needed

### Security Incidents

1. **Suspicious Activity Detected**
   - Enable maintenance mode if possible
   - Review logs for attack patterns
   - Rotate SESSION_SECRET immediately
   - Check AI quota usage for abuse

2. **Secret Compromise**
   - Rotate all secrets immediately:
     ```bash
     # SESSION_SECRET
     openssl rand -hex 32
     
     # AI_API_KEY - regenerate in provider dashboard
     # BLOB_READ_WRITE_TOKEN - regenerate in Vercel dashboard
     ```
   - Invalidate all active sessions
   - Review access logs

---

## Support & Troubleshooting

### Common Issues

**Issue**: Transactions failing on mainnet
- **Solution**: Check RPC health, verify priority fees are configured

**Issue**: AI generation not working
- **Solution**: Verify AI_API_KEY quota and validity

**Issue**: Uploads failing
- **Solution**: Check BLOB_READ_WRITE_TOKEN and storage provider status

**Issue**: Database connection errors
- **Solution**: Verify DATABASE_URL, check SSL settings, ensure IP allowlisting

### Getting Help

- Review logs: `vercel logs --production`
- Check health endpoint: `/api/health`
- Review application errors in monitoring dashboard

---

## Maintenance Windows

For planned maintenance:

1. Set maintenance page/mode
2. Run database migrations during low-traffic period
3. Verify all services after deployment
4. Monitor error rates for 30 minutes post-deployment

---

**Last Updated**: 2026-02-23  
**Version**: 1.0.0
