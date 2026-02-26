-- Social Features Migration
-- Adds favorites, follows, activity feed, and collections

-- Favorites table
CREATE TABLE "Favorite" (
    "id" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "mintAddress" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- Follows table
CREATE TABLE "Follow" (
    "id" TEXT NOT NULL,
    "followerWallet" TEXT NOT NULL,
    "followingWallet" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Follow_pkey" PRIMARY KEY ("id")
);

-- Activity feed table
CREATE TABLE "Activity" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "wallet" TEXT NOT NULL,
    "targetWallet" TEXT,
    "mintAddress" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- Collections table
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "creatorWallet" TEXT NOT NULL,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Collection_slug_key" UNIQUE ("slug")
);

-- Collection items (junction table)
CREATE TABLE "CollectionItem" (
    "id" TEXT NOT NULL,
    "collectionId" TEXT NOT NULL,
    "mintAddress" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CollectionItem_pkey" PRIMARY KEY ("id")
);

-- Create indexes for performance
CREATE UNIQUE INDEX "Favorite_wallet_mintAddress_key" ON "Favorite"("wallet", "mintAddress");
CREATE INDEX "Favorite_wallet_idx" ON "Favorite"("wallet");
CREATE INDEX "Favorite_mintAddress_idx" ON "Favorite"("mintAddress");

CREATE UNIQUE INDEX "Follow_followerWallet_followingWallet_key" ON "Follow"("followerWallet", "followingWallet");
CREATE INDEX "Follow_followerWallet_idx" ON "Follow"("followerWallet");
CREATE INDEX "Follow_followingWallet_idx" ON "Follow"("followingWallet");

CREATE INDEX "Activity_wallet_idx" ON "Activity"("wallet");
CREATE INDEX "Activity_targetWallet_idx" ON "Activity"("targetWallet");
CREATE INDEX "Activity_type_idx" ON "Activity"("type");
CREATE INDEX "Activity_createdAt_idx" ON "Activity"("createdAt");

CREATE INDEX "Collection_creatorWallet_idx" ON "Collection"("creatorWallet");
CREATE INDEX "Collection_featured_idx" ON "Collection"("featured");

CREATE UNIQUE INDEX "CollectionItem_collectionId_mintAddress_key" ON "CollectionItem"("collectionId", "mintAddress");
CREATE INDEX "CollectionItem_collectionId_idx" ON "CollectionItem"("collectionId");
CREATE INDEX "CollectionItem_mintAddress_idx" ON "CollectionItem"("mintAddress");

-- Add foreign key constraints
ALTER TABLE "Favorite" ADD CONSTRAINT "Favorite_mintAddress_fkey" 
    FOREIGN KEY ("mintAddress") REFERENCES "Mint"("mintAddress") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Activity" ADD CONSTRAINT "Activity_mintAddress_fkey" 
    FOREIGN KEY ("mintAddress") REFERENCES "Mint"("mintAddress") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_collectionId_fkey" 
    FOREIGN KEY ("collectionId") REFERENCES "Collection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CollectionItem" ADD CONSTRAINT "CollectionItem_mintAddress_fkey" 
    FOREIGN KEY ("mintAddress") REFERENCES "Mint"("mintAddress") ON DELETE CASCADE ON UPDATE CASCADE;

-- Add indexes to Mint table for better query performance
CREATE INDEX IF NOT EXISTS "Mint_status_idx" ON "Mint"("status");
CREATE INDEX IF NOT EXISTS "Mint_createdAt_idx" ON "Mint"("createdAt");
