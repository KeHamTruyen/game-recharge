import 'dotenv/config';
import { prisma } from '../src/index.js';
import { isSensitiveFieldKey, encryptSensitive } from '../src/utils/crypto.js';

/**
 * Controlled migration script to encrypt any legacy unencrypted sensitive fields in topupInfo.
 */
async function migrateLegacyPasswords() {
  console.log('🔄 Checking for legacy unencrypted sensitive fields in transactions...');

  const templates = await prisma.topupTemplate.findMany();
  const templateMap = new Map(templates.map((t) => [t.id, t.fields]));

  const packages = await prisma.servicePackage.findMany({ select: { id: true, templateId: true } });
  const packageTemplateMap = new Map(packages.map((p) => [p.id, p.templateId]));

  const transactions = await prisma.transaction.findMany();
  let updatedCount = 0;

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
      updatedCount += 1;
    }
  }

  console.log(`✅ Migration complete. Encrypted sensitive fields for ${updatedCount} legacy transaction(s).`);
  await prisma.$disconnect();
}

migrateLegacyPasswords().catch((err) => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
