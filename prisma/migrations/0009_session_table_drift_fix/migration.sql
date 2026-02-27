-- Session table drift fix
-- Ensures auth session persistence works even if an older database missed
-- the baseline Session table creation.

CREATE TABLE IF NOT EXISTS "Session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Session_token_key" ON "Session"("token");
CREATE INDEX IF NOT EXISTS "Session_wallet_idx" ON "Session"("wallet");
CREATE INDEX IF NOT EXISTS "Session_expiresAt_idx" ON "Session"("expiresAt");
