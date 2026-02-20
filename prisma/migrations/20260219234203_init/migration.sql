-- CreateTable
CREATE TABLE "Draft" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "prompt" TEXT NOT NULL,
    "preset" TEXT,
    "templateId" TEXT,
    "variations" TEXT NOT NULL,
    "selectedIdx" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Mint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mintAddress" TEXT NOT NULL,
    "inputJson" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "animationUrl" TEXT NOT NULL,
    "metadataUrl" TEXT NOT NULL,
    "title" TEXT,
    "wallet" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Listing" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mintAddress" TEXT NOT NULL,
    "priceLamports" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "txSignature" TEXT,
    "saleStateKey" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Listing_mintAddress_fkey" FOREIGN KEY ("mintAddress") REFERENCES "Mint" ("mintAddress") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Mint_mintAddress_key" ON "Mint"("mintAddress");

-- CreateIndex
CREATE UNIQUE INDEX "Listing_mintAddress_key" ON "Listing"("mintAddress");
