-- Performance Indexes for Production
-- Run this migration before deploying to mainnet

-- Auth indexes for session management
CREATE INDEX IF NOT EXISTS "Session_wallet_idx" ON "Session"("wallet");
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");
CREATE INDEX IF NOT EXISTS "AuthNonce_expiresAt_idx" ON "AuthNonce"("expiresAt");

-- Mint indexes for user queries and transaction lookups
CREATE INDEX IF NOT EXISTS "Mint_wallet_idx" ON "Mint"("wallet");
CREATE INDEX IF NOT EXISTS "Mint_txSignature_idx" ON "Mint"("txSignature");
CREATE INDEX IF NOT EXISTS "Mint_status_idx" ON "Mint"("status");
CREATE INDEX IF NOT EXISTS "Mint_createdAt_idx" ON "Mint"("createdAt");

-- Listing indexes for marketplace queries
CREATE INDEX IF NOT EXISTS "Listing_status_idx" ON "Listing"("status");
CREATE INDEX IF NOT EXISTS "Listing_mintAddress_idx" ON "Listing"("mintAddress");

-- Rate limiting indexes
CREATE INDEX IF NOT EXISTS "RateLimitWindow_key_idx" ON "RateLimitWindow"("key");
CREATE INDEX IF NOT EXISTS "RateLimitWindow_windowStart_idx" ON "RateLimitWindow"("windowStart");

-- Usage tracking indexes
CREATE INDEX IF NOT EXISTS "UsageCounter_date_idx" ON "UsageCounter"("date");
CREATE INDEX IF NOT EXISTS "UsageCounter_userWallet_idx" ON "UsageCounter"("userWallet");
CREATE INDEX IF NOT EXISTS "UsageCounter_action_idx" ON "UsageCounter"("action");

-- Draft indexes for user content
CREATE INDEX IF NOT EXISTS "Draft_wallet_idx" ON "Draft"("wallet");
CREATE INDEX IF NOT EXISTS "Draft_updatedAt_idx" ON "Draft"("updatedAt");

-- Composite index for common query pattern: user's mints with status
CREATE INDEX IF NOT EXISTS "Mint_wallet_status_idx" ON "Mint"("wallet", "status");

-- Composite index for usage tracking queries
CREATE INDEX IF NOT EXISTS "UsageCounter_date_user_action_idx" ON "UsageCounter"("date", "userWallet", "action");
