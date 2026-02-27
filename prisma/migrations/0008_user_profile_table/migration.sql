-- User profiles table
-- Added after profile pages started querying the UserProfile model directly.

CREATE TABLE "UserProfile" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "username" TEXT,
    "displayName" TEXT,
    "bio" TEXT,
    "avatarUrl" TEXT,
    "website" TEXT,
    "twitter" TEXT,
    "discord" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "UserProfile_wallet_key" ON "UserProfile"("wallet");
CREATE UNIQUE INDEX "UserProfile_username_key" ON "UserProfile"("username");
CREATE INDEX "UserProfile_username_idx" ON "UserProfile"("username");
CREATE INDEX "UserProfile_verified_idx" ON "UserProfile"("verified");
