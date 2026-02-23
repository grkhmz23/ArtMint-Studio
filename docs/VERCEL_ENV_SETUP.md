# Vercel Environment Variables Setup

> **Last Updated:** 2026-02-23  
> **Status:** All required variables documented

---

## Required Variables (Production)

### 1. Core Application
```
NEXT_PUBLIC_APP_URL=https://art-mint-studio-web.vercel.app
```
Your production domain.

---

### 2. Solana RPC (CRITICAL - Mainnet Only)
```
SOLANA_CLUSTER=mainnet-beta
SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY
SOLANA_RPC_BACKUP_URL=https://your-quicknode-url.solana-mainnet.quiknode.pro/YOUR_TOKEN
NEXT_PUBLIC_SOLANA_RPC_URL=https://mainnet.helius-rpc.com/?api-key=YOUR_HELIUS_KEY
```

**Get API Keys:**
- **Helius:** https://helius.xyz (recommended primary)
- **QuickNode:** https://quicknode.com (recommended backup)

⚠️ **Never use public RPC for production!**

---

### 3. AI Provider (Anthropic Recommended)
```
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-api03-YOUR_ANTHROPIC_KEY
AI_MODEL=claude-sonnet-4-20250514
```

**Get API Key:** https://console.anthropic.com

**Quota Settings:**
```
AI_MAX_DAILY_PER_USER=10
AI_MAX_DAILY_GLOBAL=500
```

---

### 4. Database (PostgreSQL)
```
DATABASE_URL=postgresql://user:password@your-db-host:5432/artmint?sslmode=require
```

**Recommended Providers:**
- **Railway:** https://railway.app (easiest)
- **Supabase:** https://supabase.com (has free tier)
- **Neon:** https://neon.tech (serverless)

⚠️ **Must use SSL in production!**

---

### 5. Storage (Vercel Blob)
```
STORAGE_PROVIDER=vercel-blob
BLOB_ACCESS=public
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_YOUR_TOKEN
```

**Get Token:** Vercel Dashboard → Storage → Blob → Create Token

---

### 6. Session Secret (Generate New!)
```
SESSION_SECRET=your-64-character-hex-string-here
```

**Generate:**
```bash
openssl rand -hex 32
```

⚠️ **Must be different from development! Never commit this!**

---

## Optional Variables

### Transaction Fee Settings
```
PRIORITY_FEE_MICRO_LAMPORTS=5000
COMPUTE_UNIT_LIMIT_MINT=200000
COMPUTE_UNIT_LIMIT_LISTING=100000
```

### Logging Level
```
LOG_LEVEL=info
```
Options: `debug`, `info`, `warn`, `error`

---

## Complete Environment Setup Script

```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Login
vercel login

# 3. Link project
vercel link

# 4. Set all environment variables
vercel env add NEXT_PUBLIC_APP_URL
# Enter: https://art-mint-studio-web.vercel.app

vercel env add SOLANA_CLUSTER
# Enter: mainnet-beta

vercel env add SOLANA_RPC_URL
# Enter: https://mainnet.helius-rpc.com/?api-key=YOUR_KEY

vercel env add SOLANA_RPC_BACKUP_URL
# Enter: https://your-backup-rpc.com

vercel env add NEXT_PUBLIC_SOLANA_RPC_URL
# Enter: https://mainnet.helius-rpc.com/?api-key=YOUR_KEY

vercel env add AI_PROVIDER
# Enter: anthropic

vercel env add AI_API_KEY
# Enter: sk-ant-api03-...

vercel env add AI_MODEL
# Enter: claude-sonnet-4-20250514

vercel env add AI_MAX_DAILY_PER_USER
# Enter: 10

vercel env add AI_MAX_DAILY_GLOBAL
# Enter: 500

vercel env add DATABASE_URL
# Enter: postgresql://...

vercel env add STORAGE_PROVIDER
# Enter: vercel-blob

vercel env add BLOB_ACCESS
# Enter: public

vercel env add BLOB_READ_WRITE_TOKEN
# Enter: vercel_blob_rw_...

vercel env add SESSION_SECRET
# Enter: (generate with openssl rand -hex 32)
```

---

## Verification Checklist

Before deploying, verify:

- [ ] `SOLANA_CLUSTER` is set to `mainnet-beta` (not devnet!)
- [ ] `SOLANA_RPC_URL` is NOT using public RPC endpoint
- [ ] `SESSION_SECRET` is 64 characters (hex)
- [ ] `SESSION_SECRET` is different from development
- [ ] `DATABASE_URL` includes `sslmode=require`
- [ ] `AI_API_KEY` is a production key (not limited)
- [ ] `BLOB_READ_WRITE_TOKEN` is from Vercel dashboard
- [ ] All URLs use `https://` (not http)

---

## How to Add in Vercel Dashboard

### Method 1: Web UI

1. Go to https://vercel.com/dashboard
2. Select your project
3. Click **Settings** tab
4. Click **Environment Variables**
5. Add each variable:
   - Name: Variable name (e.g., `SESSION_SECRET`)
   - Value: Variable value
   - Environment: Select **Production** (and Preview if needed)
6. Click **Save**

### Method 2: Vercel CLI (Faster)

```bash
# Add production-only variable
echo "your-secret-value" | vercel env add SESSION_SECRET production

# Add to all environments
echo "your-value" | vercel env add NEXT_PUBLIC_APP_URL
```

---

## Testing After Setup

```bash
# Pull environment variables to local
vercel env pull .env.local

# Verify all variables are set
vercel env ls

# Deploy and test
git push origin main
# or
vercel --prod
```

---

## Troubleshooting

### "Missing SESSION_SECRET"
Generate a new one: `openssl rand -hex 32`

### "Cannot connect to database"
- Check `DATABASE_URL` has `sslmode=require`
- Verify database allows connections from Vercel IPs

### "AI generation failing"
- Check `AI_API_KEY` is valid
- Verify quota hasn't been exceeded

### "BLOB_READ_WRITE_TOKEN invalid"
- Generate new token from Vercel Dashboard
- Ensure token has read/write permissions

### "Transaction failing on mainnet"
- Verify `SOLANA_RPC_URL` uses dedicated provider
- Check wallet has sufficient SOL for fees

---

## Security Reminders

🔒 **NEVER commit these to Git:**
- SESSION_SECRET
- AI_API_KEY
- DATABASE_URL (with password)
- BLOB_READ_WRITE_TOKEN
- Any RPC URLs with API keys

✅ **Best Practices:**
- Use Vercel's environment variable encryption
- Rotate SESSION_SECRET periodically
- Use separate API keys for production vs development
- Monitor AI quota usage
- Set up rate limiting alerts

---

## Summary Table

| Variable | Required | Source | Sensitive |
|----------|----------|--------|-----------|
| NEXT_PUBLIC_APP_URL | ✅ | Your domain | No |
| SOLANA_CLUSTER | ✅ | mainnet-beta | No |
| SOLANA_RPC_URL | ✅ | Helius/QuickNode | Yes (API key) |
| SOLANA_RPC_BACKUP_URL | ✅ | QuickNode | Yes (API key) |
| NEXT_PUBLIC_SOLANA_RPC_URL | ✅ | Helius | Yes (API key) |
| AI_PROVIDER | ✅ | anthropic | No |
| AI_API_KEY | ✅ | Anthropic Console | Yes |
| AI_MODEL | ✅ | claude-sonnet-4-20250514 | No |
| AI_MAX_DAILY_PER_USER | ✅ | 10 | No |
| AI_MAX_DAILY_GLOBAL | ✅ | 500 | No |
| DATABASE_URL | ✅ | Railway/Supabase/Neon | Yes (password) |
| STORAGE_PROVIDER | ✅ | vercel-blob | No |
| BLOB_ACCESS | ✅ | public | No |
| BLOB_READ_WRITE_TOKEN | ✅ | Vercel Dashboard | Yes |
| SESSION_SECRET | ✅ | openssl rand -hex 32 | **CRITICAL** |
| PRIORITY_FEE_MICRO_LAMPORTS | ❌ | 5000 | No |
| COMPUTE_UNIT_LIMIT_* | ❌ | defaults | No |
| LOG_LEVEL | ❌ | info | No |

---

**Total Required Variables: 15**  
**Total Optional Variables: 4**

Ready to deploy! 🚀
