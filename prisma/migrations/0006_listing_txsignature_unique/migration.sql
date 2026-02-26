-- Prevent tx signature replay races across listings.
-- Multiple NULL values remain allowed in PostgreSQL unique indexes.
CREATE UNIQUE INDEX IF NOT EXISTS "Listing_txSignature_key" ON "Listing"("txSignature");
