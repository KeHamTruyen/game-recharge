CREATE TABLE "wiki_entries" (
  "key" TEXT PRIMARY KEY,
  "kind" TEXT NOT NULL,
  "authorId" TEXT,
  "data" JSONB NOT NULL,
  "deleted" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "wiki_entries_kind_createdAt_idx" ON "wiki_entries"("kind", "createdAt");
CREATE TABLE "wiki_votes" (
  "entryKey" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "value" TEXT NOT NULL,
  PRIMARY KEY ("entryKey", "userId")
);
