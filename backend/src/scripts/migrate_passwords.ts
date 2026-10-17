import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { isPrivateTopupField, encryptSensitive, maskCachedTopupInfo } from '../utils/crypto.js';

/**
 * Controlled migration script to encrypt any legacy unencrypted sensitive fields in topupInfo
 * and purge plain passwords from cached checkout responses.
 */
export async function migrateLegacyPasswords() {
  console.log('🔄 Checking for legacy unencrypted sensitive fields in transactions...');

  const transactions = await prisma.transaction.findMany();
  let updatedTxCount = 0;

  for (const tx of transactions) {
    if (!tx.topupInfo || typeof tx.topupInfo !== 'object') continue;

    const original = tx.topupInfo as Record<string, unknown>;
    const updated: Record<string, unknown> = {};
    let hasChanges = false;

    for (const [key, value] of Object.entries(original)) {
      if (
        isPrivateTopupField(key, tx.topupFields) &&
        ['string', 'number', 'boolean'].includes(typeof value) &&
        String(value).length > 0 &&
        !(typeof value === 'string' && value.startsWith('enc:'))
      ) {
        updated[key] = encryptSensitive(String(value));
        hasChanges = true;
      } else {
        updated[key] = value;
      }
    }

    if (hasChanges) {
      await prisma.transaction.update({
        where: { id: tx.id },
        data: { topupInfo: updated as any },
      });
      updatedTxCount += 1;
    }
  }

  console.log(`✅ Transaction migration complete: Encrypted sensitive fields for ${updatedTxCount} legacy transaction(s).`);

  // ─── Purge Plaintext Passwords From Cached Checkout Responses ─────────────────
  console.log('🔄 Checking for plain passwords in cached checkout responses (CheckoutRequest)...');
  const checkoutRequests = await prisma.checkoutRequest.findMany();
  let updatedCheckoutCount = 0;

  for (const req of checkoutRequests) {
    if (!req.response || typeof req.response !== 'object') continue;

    const resp = JSON.parse(JSON.stringify(req.response)) as Record<string, any>;
    let changed = false;

    if (Array.isArray(resp.transactions)) {
      for (const item of resp.transactions) {
        if (item && item.topupInfo && typeof item.topupInfo === 'object') {
          const masked = maskCachedTopupInfo(item.topupInfo, item.topupFields);
          if (JSON.stringify(masked) !== JSON.stringify(item.topupInfo)) {
            item.topupInfo = masked;
            changed = true;
          }
        }
      }
    }

    if (changed) {
      await prisma.checkoutRequest.update({
        where: { id: req.id },
        data: { response: resp },
      });
      updatedCheckoutCount += 1;
    }
  }

  console.log(`✅ Checkout cache migration complete: Purged plain passwords from ${updatedCheckoutCount} cached checkout request(s).`);

  // Protect legacy queue contents, including jobs scheduled for a later retry.
  while (true) {
    const jobs = await prisma.telegramNotification.findMany({
      where: { message: { not: '' }, NOT: { message: { startsWith: 'enc:' } } },
      take: 100,
    });
    if (!jobs.length) break;
    for (const job of jobs) {
      await prisma.telegramNotification.updateMany({
        where: { id: job.id, message: job.message },
        data: { message: job.sentAt ? '' : encryptSensitive(job.message) },
      });
    }
  }
}

if (require.main === module) {
  migrateLegacyPasswords().catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exitCode = 1;
  }).finally(() => prisma.$disconnect());
}

