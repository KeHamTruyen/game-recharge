import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync, readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { parse as parseEnv } from 'dotenv';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTestClient, prisma, TestClient } from './helpers.js';
import { signToken } from '../src/middleware/auth.js';
import { env } from '../src/config/env.js';

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

  it('GET /api/payments/status/:orderCode returns PENDING for partially paid groups and only PAID when all lines are paid', async () => {
    const paymentOrderCode = `DUKE${randomUUID().replaceAll('-', '')}`;
    const paidLine = await order({ paymentOrderCode, paymentStatus: 'PAID', amount: 10000 });
    const pendingLine = await order({ paymentOrderCode, paymentStatus: 'PENDING', amount: 20000 });

    // Polling by paymentOrderCode or by line code must NOT report group as PAID while 1 line is PENDING
    const byGroup = await admin.get(`/api/payments/status/${paymentOrderCode}`);
    assert.equal(byGroup.status, 200);
    assert.equal(byGroup.body.data.paymentStatus, 'PENDING');

    const byLine = await admin.get(`/api/payments/status/${paidLine.code}`);
    assert.equal(byLine.status, 200);
    assert.equal(byLine.body.data.paymentStatus, 'PENDING');

    // Once all lines are PAID, group status becomes PAID
    await prisma.transaction.update({ where: { id: pendingLine.id }, data: { paymentStatus: 'PAID', paidAt: new Date() } });
    const fullyPaid = await admin.get(`/api/payments/status/${paymentOrderCode}`);
    assert.equal(fullyPaid.status, 200);
    assert.equal(fullyPaid.body.data.paymentStatus, 'PAID');
    assert.equal(fullyPaid.body.data.status, 'PROCESSING');
    assert.ok(fullyPaid.body.data.paidAt);
  });

  it('GET /api/payments/status/:orderCode reports FAILED status when late payment is recorded on cancelled order', async () => {
    const paymentOrderCode = `DUKE${randomUUID().replaceAll('-', '')}`;
    const cancelledOrder = await order({
      paymentOrderCode,
      paymentStatus: 'PAID',
      status: 'FAILED',
      paidAt: new Date(),
    });

    const res = await admin.get(`/api/payments/status/${paymentOrderCode}`);
    assert.equal(res.status, 200);
    assert.equal(res.body.data.paymentStatus, 'PAID');
    assert.equal(res.body.data.status, 'FAILED');
    assert.ok(res.body.data.paidAt);

    const byLine = await admin.get(`/api/payments/status/${cancelledOrder.code}`);
    assert.equal(byLine.status, 200);
    assert.equal(byLine.body.data.paymentStatus, 'PAID');
    assert.equal(byLine.body.data.status, 'FAILED');
  });

  it('requires complete payment configuration for new orders, retries, recovery and resume', async () => {
    const service = await prisma.service.create({ data: { name: 'Payment readiness', game: 'Test' } });
    const pkg = await prisma.servicePackage.create({ data: { serviceId: service.id, name: 'Test', price: 10000 } });
    const headers = { 'Idempotency-Key': randomUUID() };
    const body = { items: [{ packageId: pkg.id, quantity: 1 }] };
    const checkout = await admin.post('/api/orders/checkout', body, { headers });
    assert.equal(checkout.status, 201);
    const code = checkout.body.data.transactions[0].code;
    const before = await prisma.transaction.count({ where: { userId: user.id } });
    for (const key of ['SEPAY_API_KEY', 'SEPAY_BANK_CODE', 'SEPAY_ACCOUNT_NUMBER', 'SEPAY_ACCOUNT_NAME'] as const) {
      const original = env[key];
      try {
        for (const missing of ['', '   ']) {
          env[key] = missing;
          assert.equal((await admin.post('/api/orders', { packageId: pkg.id })).status, 503, key);
          assert.equal((await admin.post('/api/orders/checkout', body, { headers })).status, 503, key);
          assert.equal((await admin.post('/api/orders/checkout', body, { headers: { 'Idempotency-Key': randomUUID() } })).status, 503, key);
          assert.equal((await admin.get('/api/orders/checkout', { headers })).status, 503, key);
          assert.equal((await admin.get(`/api/orders/${code}/payment`)).status, 503, key);
        }
      } finally { env[key] = original; }
    }
    assert.equal(await prisma.transaction.count({ where: { userId: user.id } }), before);
    assert.equal((await admin.get(`/api/orders/${code}/payment`)).status, 200);
  });

  it('accepts the development env example but still rejects empty/short encryption keys in production', () => {
    const example = parseEnv(readFileSync('.env.example'));
    const probe = (overrides: Record<string, string>) => spawnSync(process.execPath, [
      '--import', 'tsx', '--input-type=module', '-e', "await import('./src/config/env.ts')",
    ], { env: { ...process.env, ...example, ...overrides }, encoding: 'utf8' });
    assert.equal(probe({}).status, 0);
    for (const key of ['', 'short', 'x'.repeat(20)]) {
      const result = probe({ NODE_ENV: 'production', CORS_ORIGIN: 'https://test.example',
        JWT_SECRET: 'test-only-random-characters-1234567890'.repeat(2), DATA_ENCRYPTION_KEY: key });
      assert.notEqual(result.status, 0);
      assert.match(result.stderr, /DATA_ENCRYPTION_KEY/);
    }
  });

  for (const compressed of [false, true]) {
    it(`${compressed ? 'Gzip SQL' : 'SQL'} restore rolls back on errors, commits valid SQL and cleans temporary files`, async (context) => {
      if (spawnSync('psql', ['--version']).status !== 0) {
        context.skip('Requires PostgreSQL psql client');
        return;
      }
      const schema = process.env.TEST_SCHEMA!; // helpers enforces isolated test schema.
      const table = `restore_${randomUUID().replaceAll('-', '')}`;
      const directory = mkdtempSync(join(tmpdir(), 'restore-review-'));
      const file = join(directory, compressed ? 'probe.sql.gz' : 'probe.sql');
      const sql = `CREATE TABLE "${schema}"."${table}" (id integer); INSERT INTO "${schema}"."${table}" VALUES (1);`;
      const restore = () => spawnSync(process.execPath, ['scripts/restore.mjs', file], {
        encoding: 'utf8', env: { ...process.env, TEMP: directory, TMP: directory, TMPDIR: directory },
      });
      try {
        if (compressed) {
          const corrupt = gzipSync(sql);
          corrupt[corrupt.length - 1] ^= 0xff;
          for (const invalid of [corrupt, gzipSync('')]) {
            writeFileSync(file, invalid);
            assert.notEqual(restore().status, 0);
          }
          const [row] = await prisma.$queryRawUnsafe<Array<{ present: string | null }>>(
            `SELECT to_regclass('"${schema}"."${table}"')::text AS present`,
          );
          assert.equal(row.present, null, 'Corrupt gzip must not execute even valid SQL');
        }
        const invalidSql = `${sql}\nSELECT missing_function_${table}();`;
        writeFileSync(file, compressed ? gzipSync(invalidSql) : invalidSql);
        const failed = restore();
        assert.ifError(failed.error);
        assert.notEqual(failed.status, 0);
        const [row] = await prisma.$queryRawUnsafe<Array<{ present: string | null }>>(
          `SELECT to_regclass('"${schema}"."${table}"')::text AS present`,
        );
        assert.equal(row.present, null);
        writeFileSync(file, compressed ? gzipSync(sql) : sql);
        const restored = restore();
        assert.equal(restored.status, 0, restored.stderr);
        assert.deepEqual(await prisma.$queryRawUnsafe(`SELECT id FROM "${schema}"."${table}"`), [{ id: 1 }]);
        assert.deepEqual(readdirSync(directory), [compressed ? 'probe.sql.gz' : 'probe.sql']);
      } finally {
        await prisma.$executeRawUnsafe(`DROP TABLE IF EXISTS "${schema}"."${table}"`);
        unlinkSync(file);
        rmdirSync(directory);
      }
    });
  }
});
