-- Offers & Auctions Migration

-- Offers table
CREATE TABLE "Offer" (
    "id" TEXT NOT NULL,
    "mintAddress" TEXT NOT NULL,
    "buyerWallet" TEXT NOT NULL,
    "sellerWallet" TEXT NOT NULL,
    "priceLamports" BIGINT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "txSignature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- Auctions table
CREATE TABLE "Auction" (
    "id" TEXT NOT NULL,
    "mintAddress" TEXT NOT NULL,
    "sellerWallet" TEXT NOT NULL,
    "startPriceLamports" BIGINT NOT NULL,
    "reservePriceLamports" BIGINT,
    "minBidIncrement" BIGINT NOT NULL DEFAULT 50000000,
    "type" TEXT NOT NULL,
    "startTime" TIMESTAMP(3) NOT NULL,
    "endTime" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "highestBid" BIGINT,
    "highestBidder" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Auction_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "Auction_mintAddress_key" UNIQUE ("mintAddress")
);

-- Bids table
CREATE TABLE "Bid" (
    "id" TEXT NOT NULL,
    "auctionId" TEXT NOT NULL,
    "bidder" TEXT NOT NULL,
    "amount" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bid_pkey" PRIMARY KEY ("id")
);

-- Indexes for Offers
CREATE INDEX "Offer_buyerWallet_idx" ON "Offer"("buyerWallet");
CREATE INDEX "Offer_sellerWallet_idx" ON "Offer"("sellerWallet");
CREATE INDEX "Offer_mintAddress_idx" ON "Offer"("mintAddress");
CREATE INDEX "Offer_status_idx" ON "Offer"("status");
CREATE INDEX "Offer_expiresAt_idx" ON "Offer"("expiresAt");

-- Indexes for Auctions
CREATE INDEX "Auction_sellerWallet_idx" ON "Auction"("sellerWallet");
CREATE INDEX "Auction_status_idx" ON "Auction"("status");
CREATE INDEX "Auction_endTime_idx" ON "Auction"("endTime");

-- Indexes for Bids
CREATE INDEX "Bid_auctionId_idx" ON "Bid"("auctionId");
CREATE INDEX "Bid_bidder_idx" ON "Bid"("bidder");
CREATE INDEX "Bid_createdAt_idx" ON "Bid"("createdAt");

-- Foreign keys
ALTER TABLE "Offer" ADD CONSTRAINT "Offer_mintAddress_fkey" 
    FOREIGN KEY ("mintAddress") REFERENCES "Mint"("mintAddress") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Auction" ADD CONSTRAINT "Auction_mintAddress_fkey" 
    FOREIGN KEY ("mintAddress") REFERENCES "Mint"("mintAddress") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Bid" ADD CONSTRAINT "Bid_auctionId_fkey" 
    FOREIGN KEY ("auctionId") REFERENCES "Auction"("id") ON DELETE CASCADE ON UPDATE CASCADE;
