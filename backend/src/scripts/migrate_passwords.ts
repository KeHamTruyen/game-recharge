import 'dotenv/config';
import { prisma } from '../lib/prisma.js';
import { isSensitiveFieldKey, encryptSensitive, maskCachedTopupInfo } from '../utils/crypto.js';

/**
 * Controlled migration script to encrypt any legacy unencrypted sensitive fields in topupInfo
 * and purge plain passwords from cached checkout responses.
 */
export async function migrateLegacyPasswords() {
  console.log('🔄 Checking for legacy unencrypted sensitive fields in transactions...');

  const templates = await prisma.topupTemplate.findMany();
  const templateMap = new Map(templates.map((t) => [t.id, t.fields]));

  const packages = await prisma.servicePackage.findMany({ select: { id: true, templateId: true } });
  const packageTemplateMap = new Map(packages.map((p) => [p.id, p.templateId]));

  const transactions = await prisma.transaction.findMany();
  let updatedTxCount = 0;

  for (const tx of transactions) {
    if (!tx.topupInfo || typeof tx.topupInfo !== 'object') continue;

    const templateId = tx.packageId ? packageTemplateMap.get(tx.packageId) : null;
    const fields = templateId && templateMap.has(templateId)
      ? (templateMap.get(templateId) as Array<Record<string, unknown>>)
      : undefined;

    const original = tx.topupInfo as Record<string, unknown>;
    const updated: Record<string, unknown> = {};
    let hasChanges = false;

    for (const [key, value] of Object.entries(original)) {
      if (
        isSensitiveFieldKey(key, fields) &&
        typeof value === 'string' &&
        value.length > 0 &&
        !value.startsWith('enc:')
      ) {
        updated[key] = encryptSensitive(value);
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
          const templateId = packageTemplateMap.get(item.packageId ?? item.package?.id);
          const fields = templateId ? templateMap.get(templateId) : undefined;
          const masked = maskCachedTopupInfo(item.topupInfo,
            Array.isArray(fields) ? fields as Array<Record<string, unknown>> : undefined);
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
}

if (require.main === module) {
  migrateLegacyPasswords().catch((err) => {
    console.error('❌ Migration failed:', err);
    process.exitCode = 1;
  }).finally(() => prisma.$disconnect());
}

