ALTER TABLE "services"
  ADD COLUMN "image" TEXT,
  ADD COLUMN "imagePosition" TEXT;

ALTER TABLE "service_packages"
  ADD COLUMN "image" TEXT,
  ADD COLUMN "imagePosition" TEXT;

CREATE TABLE "catalog_tags" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "catalog_tags_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "catalog_tags_name_key" ON "catalog_tags"("name");
