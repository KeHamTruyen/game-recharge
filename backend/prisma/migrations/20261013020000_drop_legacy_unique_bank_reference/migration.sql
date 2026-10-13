-- One bank transfer can pay for several cart lines. The original migration
-- created a standalone unique index, which DROP CONSTRAINT did not remove.
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_bankTransactionId_key";
DROP INDEX IF EXISTS "transactions_bankTransactionId_key";
CREATE INDEX IF NOT EXISTS "transactions_bankTransactionId_idx" ON "transactions"("bankTransactionId");
