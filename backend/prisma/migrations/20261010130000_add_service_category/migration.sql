-- AlterTable
ALTER TABLE "services" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'topup';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "services_category_idx" ON "services"("category");

