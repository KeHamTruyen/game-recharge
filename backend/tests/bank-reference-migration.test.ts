import { it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { prisma } from './helpers.js';

const migration = readFileSync('prisma/migrations/20261013020000_drop_legacy_unique_bank_reference/migration.sql', 'utf8');

it('refund revenue migration recovers completion from audit history, not from payment alone', async () => {
  const schema = `test_${randomUUID().replaceAll('-', '')}`;
  const sql = readFileSync('prisma/migrations/20261017120000_refund_revenue_origin/migration.sql', 'utf8');
  await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
    await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
    await tx.$executeRawUnsafe('CREATE TABLE transactions (id TEXT PRIMARY KEY, status TEXT)');
    await tx.$executeRawUnsafe('CREATE TABLE audit_logs (action TEXT, metadata JSONB)');
    await tx.$executeRaw`INSERT INTO transactions VALUES ('completed', 'REFUNDED'), ('unfinished', 'REFUNDED'), ('missing-audit', 'REFUNDED')`;
    await tx.$executeRaw`INSERT INTO audit_logs VALUES
      ('TRANSACTION_REFUND', '{"transactionId":"completed","oldStatus":"COMPLETED"}'),
      ('TRANSACTION_REFUND', '{"transactionId":"unfinished","oldStatus":"PROCESSING"}')`;
    for (const statement of sql.split(';').filter((part) => part.trim())) await tx.$executeRawUnsafe(statement);
    assert.deepEqual(await tx.$queryRaw`SELECT id, "refundFromCompleted" FROM transactions ORDER BY id`, [
      { id: 'completed', refundFromCompleted: true }, { id: 'missing-audit', refundFromCompleted: false },
      { id: 'unfinished', refundFromCompleted: false },
    ]);
    await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  });
});

for (const legacy of ['index', 'constraint', 'already-fixed']) {
  it(`bank reference migration preserves paid data (${legacy}) and can run twice`, async () => {
    // DDL and fixtures live in a disposable schema; failure rolls back its creation.
    const schema = `test_${randomUUID().replaceAll('-', '')}`;
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
      await tx.$executeRawUnsafe(`SET LOCAL search_path TO "${schema}"`);
      await tx.$executeRawUnsafe('CREATE TABLE "transactions" (id TEXT PRIMARY KEY, "bankTransactionId" TEXT, amount INTEGER, "paymentStatus" TEXT)');
      if (legacy === 'index') {
        await tx.$executeRawUnsafe('CREATE UNIQUE INDEX "transactions_bankTransactionId_key" ON "transactions"("bankTransactionId")');
      } else if (legacy === 'constraint') {
        await tx.$executeRawUnsafe('ALTER TABLE "transactions" ADD CONSTRAINT "transactions_bankTransactionId_key" UNIQUE ("bankTransactionId")');
      } else {
        await tx.$executeRawUnsafe('CREATE INDEX "transactions_bankTransactionId_idx" ON "transactions"("bankTransactionId")');
      }
      await tx.$executeRawUnsafe(`INSERT INTO "transactions" VALUES ('old', 'REF-OLD', 4000, 'PAID')`);
      for (let run = 0; run < 2; run += 1) {
        for (const sql of migration.split(';').filter((statement) => statement.trim())) {
          await tx.$executeRawUnsafe(sql);
        }
      }
      assert.deepEqual(await tx.$queryRaw`SELECT * FROM "transactions"`, [
        { id: 'old', bankTransactionId: 'REF-OLD', amount: 4000, paymentStatus: 'PAID' },
      ]);
      await tx.$executeRawUnsafe(`INSERT INTO "transactions" VALUES ('second-line', 'REF-OLD', 6000, 'PAID')`);
      const indexes = await tx.$queryRaw<Array<{ indexname: string; indexdef: string }>>`
        SELECT indexname, indexdef FROM pg_indexes WHERE schemaname = ${schema} AND tablename = 'transactions'
      `;
      assert.ok(!indexes.some((index) => index.indexname === 'transactions_bankTransactionId_key'));
      const lookup = indexes.find((index) => index.indexname === 'transactions_bankTransactionId_idx');
      assert.ok(lookup && !lookup.indexdef.includes('UNIQUE'));
      await tx.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
    });
  });
}
