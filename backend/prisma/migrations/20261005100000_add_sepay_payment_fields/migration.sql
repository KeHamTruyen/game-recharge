-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PENDING', 'PAID', 'FAILED', 'REFUNDED', 'EXPIRED');

-- AlterTable
ALTER TABLE "transactions"
ADD COLUMN "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
ADD COLUMN "paymentOrderCode" TEXT,
ADD COLUMN "paymentLinkId" TEXT,
ADD COLUMN "checkoutUrl" TEXT,
ADD COLUMN "qrCode" TEXT,
ADD COLUMN "paidAt" TIMESTAMP(3),
ADD COLUMN "paymentMetadata" JSONB;

-- CreateIndex
CREATE INDEX "transactions_paymentOrderCode_idx" ON "transactions"("paymentOrderCode");
CREATE INDEX "transactions_paymentStatus_idx" ON "transactions"("paymentStatus");
