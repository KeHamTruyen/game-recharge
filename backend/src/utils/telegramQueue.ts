import { prisma } from '../lib/prisma.js';
import { env } from '../config/env.js';
import { sendTelegramMessage } from './telegram.js';

let running: Promise<void> | undefined;
let stopping = false;

async function deliverDue(): Promise<void> {
  const jobs = await prisma.telegramNotification.findMany({
    where: { sentAt: null, nextAttemptAt: { lte: new Date() } },
    orderBy: { nextAttemptAt: 'asc' }, take: 10,
  });
  for (const job of jobs) {
    if (stopping) break;
    // A lease survives crashes and prevents multiple API replicas sending the same job concurrently.
    const claimed = await prisma.telegramNotification.updateMany({
      where: { id: job.id, attempts: job.attempts, sentAt: null, nextAttemptAt: { lte: new Date() } },
      data: { attempts: { increment: 1 }, nextAttemptAt: new Date(Date.now() + 60_000) },
    });
    if (!claimed.count) continue;
    const sent = await sendTelegramMessage(job.message);
    await prisma.telegramNotification.updateMany({
      where: { id: job.id, attempts: job.attempts + 1, sentAt: null },
      data: sent
        ? { sentAt: new Date(), message: '' }
        : { nextAttemptAt: new Date(Date.now() + Math.min(3600, 30 * 2 ** Math.min(job.attempts, 7)) * 1000) },
    });
  }
}

export function flushTelegramNotifications(): Promise<void> {
  if (stopping || !env.TELEGRAM_BOT_TOKEN?.trim() || !env.TELEGRAM_CHAT_ID?.trim()) return Promise.resolve();
  if (!running) {
    running = deliverDue().catch(() => {
      console.error('[TELEGRAM] Không thể xử lý hàng đợi; sẽ thử lại.');
    }).finally(() => { running = undefined; });
  }
  return running;
}

export async function stopTelegramNotifications(): Promise<void> {
  stopping = true;
  await running;
}
