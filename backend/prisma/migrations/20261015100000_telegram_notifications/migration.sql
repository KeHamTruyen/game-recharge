CREATE TABLE "telegram_notifications" (
    "id" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    CONSTRAINT "telegram_notifications_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "telegram_notifications_sentAt_nextAttemptAt_idx"
ON "telegram_notifications"("sentAt", "nextAttemptAt");
