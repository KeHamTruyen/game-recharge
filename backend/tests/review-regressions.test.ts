import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTestClient, prisma, TestClient } from './helpers.js';
import { signToken } from '../src/middleware/auth.js';

describe('Review regressions: refunds, payment groups and SQL restore', () => {
  let admin: TestClient;
  let user: { id: string; email: string };
  before(async () => {
    admin = await createTestClient();
    user = await prisma.user.create({ data: {
      email: `${randomUUID()}@test.invalid`, name: 'Review', passwordHash: 'unused', role: 'ADMIN',
    } });
    admin.cookie = `auth_token=${signToken({ userId: user.id, email: user.email, role: 'ADMIN', tokenVersion: 0 })}`;
  });
  after(async () => { await admin.close(); });

  function order(extra: Record<string, unknown> = {}) {
    return prisma.transaction.create({ data: {
      code: `DUKE${randomUUID().replaceAll('-', '').toUpperCase()}`,
      userId: user.id, userEmail: user.email, packageName: 'Review', gameName: 'Review',
      amount: 10000, paymentStatus: 'PAID', ...extra,
    } });
  }

  it('preserves a partial refund receipt on repeats and rejects reopening the order', async () => {
    const row = await order();
    const path = `/api/admin/transactions/${row.id}/status`;
    assert.equal((await admin.patch(path, {
      status: 'REFUNDED', refundAmount: 4000, refundTxId: 'REF-PROOF', refundReason: 'Customer request',
    })).status, 200);
    const original = await prisma.transaction.findUniqueOrThrow({ where: { id: row.id } });
    for (const body of [{ status: 'REFUNDED' }, { paymentStatus: 'REFUNDED' }, { status: 'COMPLETED', paymentStatus: 'PAID' }]) {
      assert.equal((await admin.patch(path, body)).status, 400);
      assert.deepEqual(await prisma.transaction.findUniqueOrThrow({ where: { id: row.id } }), original);
    }
  });

  it('requires paid money and a reason, and accepts only one concurrent refund', async () => {
    const unpaid = await order({ status: 'COMPLETED', paymentStatus: 'UNPAID' });
    assert.equal((await admin.patch(`/api/admin/transactions/${unpaid.id}/status`, {
      status: 'REFUNDED', refundReason: 'Request',
    })).status, 400);
    const paid = await order();
    const path = `/api/admin/transactions/${paid.id}/status`;
    assert.equal((await admin.patch(path, { status: 'REFUNDED' })).status, 400);
    const results = await Promise.all([1, 2].map(() => admin.patch(path, {
      status: 'REFUNDED', refundReason: 'Request',
    })));
    assert.deepEqual(results.map((res) => res.status).sort(), [200, 400]);
  });

  it('blocks payment for a whole group when a sibling is paid, refunded or unpayable', async () => {
    for (const paymentStatus of ['PAID', 'REFUNDED', 'EXPIRED', 'FAILED'] as const) {
      const paymentOrderCode = `DUKE${randomUUID().replaceAll('-', '')}`;
      const pending = await order({ paymentOrderCode, paymentStatus: 'PENDING' });
      await order({ paymentOrderCode, paymentStatus });
      const response = await admin.get(`/api/orders/${pending.code}/payment`);
      assert.equal(response.status, 409, paymentStatus);
      assert.equal(response.body.data, undefined);
    }
  });

  it('regenerates an unpaid group QR from its total and suppresses a fully paid QR', async () => {
    const paymentOrderCode = `DUKE${randomUUID().replaceAll('-', '')}`;
    const first = await order({ paymentOrderCode, paymentStatus: 'PENDING', qrCode: 'https://qr.sepay.vn/img?amount=10000' });
    await order({ paymentOrderCode, paymentStatus: 'PENDING', amount: 20000 });
    const pending = await admin.get(`/api/orders/${first.code}/payment`);
    assert.equal(pending.status, 200);
    assert.equal(pending.body.data.amount, 30000);
    assert.equal(new URL(pending.body.data.qrCode).searchParams.get('amount'), '30000');
    await prisma.transaction.updateMany({ where: { paymentOrderCode }, data: { paymentStatus: 'PAID' } });
    const paid = await admin.get(`/api/orders/${first.code}/payment`);
    assert.equal(paid.status, 200);
    assert.equal(paid.body.data.paymentStatus, 'PAID');
    assert.equal(paid.body.data.qrCode, '');
  });

  it('SQL restore exits nonzero and rolls back on SQL errors; valid SQL commits', async (context) => {
    if (spawnSync('psql', ['--version']).status !== 0) {
      context.skip('Requires PostgreSQL psql client');
      return;
    }
    const schema = process.env.TEST_SCHEMA!; // helpers enforces isolated test schema.
    const table = `restore_${randomUUID().replaceAll('-', '')}`;
    const directory = mkdtempSync(join(tmpdir(), 'restore-review-'));
    const file = join(directory, 'probe.sql');
    const sql = `CREATE TABLE "${schema}"."${table}" (id integer); INSERT INTO "${schema}"."${table}" VALUES (1);`;
    try {
      writeFileSync(file, `${sql}\nSELECT missing_function_${table}();`);
      const failed = spawnSync(process.execPath, ['scripts/restore.mjs', file], { encoding: 'utf8' });
      assert.ifError(failed.error);
      assert.notEqual(failed.status, 0);
      const [row] = await prisma.$queryRawUnsafe<Array<{ present: string | null }>>(
        `SELECT to_regclass('"${schema}"."${table}"')::text AS present`,
      );
      assert.equal(row.present, null);
      writeFileSync(file, sql);
      const restored = spawnSync(process.execPath, ['scripts/restore.mjs', file], { encoding: 'utf8' });
      assert.equal(restored.status, 0, restored.stderr);
      assert.deepEqual(await prisma.$queryRawUnsafe(`SELECT id FROM "${schema}"."${table}"`), [{ id: 1 }]);
    } finally {
      await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${schema}"."${table}"`);
      unlinkSync(file);
      rmdirSync(directory);
    }
  });
});
