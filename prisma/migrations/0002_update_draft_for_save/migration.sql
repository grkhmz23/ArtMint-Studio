-- AlterTable: Restructure Draft model for multi-type drafts
-- Drop old columns and add new ones

-- Drop old columns
ALTER TABLE "Draft" DROP COLUMN IF EXISTS "prompt";
ALTER TABLE "Draft" DROP COLUMN IF EXISTS "preset";
ALTER TABLE "Draft" DROP COLUMN IF EXISTS "templateId";
ALTER TABLE "Draft" DROP COLUMN IF EXISTS "variations";
ALTER TABLE "Draft" DROP COLUMN IF EXISTS "selectedIdx";

-- Add new columns
ALTER TABLE "Draft" ADD COLUMN "wallet" TEXT NOT NULL DEFAULT '';
ALTER TABLE "Draft" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'ai';
ALTER TABLE "Draft" ADD COLUMN "title" TEXT;
ALTER TABLE "Draft" ADD COLUMN "data" TEXT NOT NULL DEFAULT '{}';
ALTER TABLE "Draft" ADD COLUMN "imageUrl" TEXT;

-- Remove the default for wallet (it was just to allow migration of existing rows)
ALTER TABLE "Draft" ALTER COLUMN "wallet" DROP DEFAULT;
ALTER TABLE "Draft" ALTER COLUMN "data" DROP DEFAULT;

-- CreateIndex
CREATE INDEX "Draft_wallet_idx" ON "Draft"("wallet");
