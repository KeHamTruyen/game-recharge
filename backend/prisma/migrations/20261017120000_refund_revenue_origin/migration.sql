ALTER TABLE "transactions" ADD COLUMN "refundFromCompleted" BOOLEAN NOT NULL DEFAULT false;

-- Recover the original completion state from the transactional refund audit.
UPDATE "transactions" AS t
SET "refundFromCompleted" = true
WHERE t.status = 'REFUNDED'
  AND EXISTS (
    SELECT 1 FROM "audit_logs" AS a
    WHERE a.action = 'TRANSACTION_REFUND'
      AND a.metadata->>'transactionId' = t.id
      AND a.metadata->>'oldStatus' = 'COMPLETED'
  );
