ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_bankTransactionId_key";
CREATE INDEX IF NOT EXISTS "transactions_bankTransactionId_idx" ON "transactions"("bankTransactionId");
