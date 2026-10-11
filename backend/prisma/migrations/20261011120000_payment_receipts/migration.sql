CREATE TABLE "payment_receipts" (
  "provider" TEXT NOT NULL,
  "externalId" TEXT NOT NULL,
  "paymentOrderCode" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("provider", "externalId")
);
CREATE INDEX "payment_receipts_paymentOrderCode_idx" ON "payment_receipts"("paymentOrderCode");
-- Preserve deduplication for already paid legacy orders with a SePay ID.
INSERT INTO "payment_receipts" ("provider", "externalId", "paymentOrderCode")
SELECT DISTINCT 'sepay', "paymentMetadata"->>'id', "paymentOrderCode"
FROM "transactions"
WHERE "paymentStatus" = 'PAID' AND "paymentOrderCode" IS NOT NULL
  AND ("paymentMetadata"->>'id') ~ '^[1-9][0-9]*$'
ON CONFLICT DO NOTHING;
