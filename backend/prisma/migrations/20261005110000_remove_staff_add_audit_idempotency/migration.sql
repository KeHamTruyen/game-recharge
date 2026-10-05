-- Preserve existing staff access as admin before removing the enum value.
UPDATE "users" SET "role" = 'ADMIN' WHERE "role" = 'STAFF';

-- PostgreSQL enum values cannot be removed in place.
ALTER TYPE "Role" RENAME TO "Role_old";
CREATE TYPE "Role" AS ENUM ('CUSTOMER', 'ADMIN');
ALTER TABLE "users"
  ALTER COLUMN "role" DROP DEFAULT,
  ALTER COLUMN "role" TYPE "Role"
  USING ("role"::text::"Role");
DROP TYPE "Role_old";
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'CUSTOMER';

CREATE TABLE "checkout_requests" (
  "id" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "paymentOrderCode" TEXT,
  "response" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "checkout_requests_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "checkout_requests_idempotencyKey_key"
  ON "checkout_requests"("idempotencyKey");
CREATE INDEX "checkout_requests_createdAt_idx" ON "checkout_requests"("createdAt");

CREATE TABLE "audit_logs" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "action" TEXT NOT NULL,
  "method" TEXT NOT NULL,
  "path" TEXT NOT NULL,
  "statusCode" INTEGER NOT NULL,
  "ipAddress" TEXT,
  "requestId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "audit_logs_userId_idx" ON "audit_logs"("userId");
CREATE INDEX "audit_logs_action_idx" ON "audit_logs"("action");
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

ALTER TABLE "transactions" ADD COLUMN "bankTransactionId" TEXT;
CREATE UNIQUE INDEX "transactions_bankTransactionId_key"
  ON "transactions"("bankTransactionId");
