-- AlterTable
ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "refundAmount" DECIMAL(12,2),
ADD COLUMN IF NOT EXISTS "refundTxId" TEXT,
ADD COLUMN IF NOT EXISTS "refundReason" TEXT,
ADD COLUMN IF NOT EXISTS "refundedById" TEXT,
ADD COLUMN IF NOT EXISTS "refundedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE IF NOT EXISTS "payment_anomalies" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'sepay',
    "gatewayId" TEXT,
    "referenceCode" TEXT,
    "orderCode" TEXT,
    "accountNumber" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "expectedAmount" DECIMAL(12,2),
    "content" TEXT NOT NULL,
    "anomalyType" TEXT NOT NULL,
    "rawPayload" JSONB,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_anomalies_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "payment_anomalies_orderCode_idx" ON "payment_anomalies"("orderCode");
CREATE INDEX IF NOT EXISTS "payment_anomalies_referenceCode_idx" ON "payment_anomalies"("referenceCode");
CREATE INDEX IF NOT EXISTS "payment_anomalies_anomalyType_idx" ON "payment_anomalies"("anomalyType");
CREATE INDEX IF NOT EXISTS "payment_anomalies_resolved_idx" ON "payment_anomalies"("resolved");
CREATE INDEX IF NOT EXISTS "payment_anomalies_createdAt_idx" ON "payment_anomalies"("createdAt");

