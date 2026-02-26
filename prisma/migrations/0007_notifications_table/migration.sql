-- Notifications table (schema drift fix)
-- Added after production health checks revealed Notification model existed
-- in schema but was missing from historical migrations.

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "recipientWallet" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "data" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "mintAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Notification_recipientWallet_idx" ON "Notification"("recipientWallet");
CREATE INDEX "Notification_recipientWallet_read_idx" ON "Notification"("recipientWallet", "read");
CREATE INDEX "Notification_type_idx" ON "Notification"("type");
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_mintAddress_fkey"
    FOREIGN KEY ("mintAddress") REFERENCES "Mint"("mintAddress") ON DELETE SET NULL ON UPDATE CASCADE;
