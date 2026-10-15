import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import bcrypt from 'bcrypt';
import { createTestClient, prisma, TestClient } from './helpers.js';
import { signToken } from '../src/middleware/auth.js';
import { env } from '../src/config/env.js';
import { migrateLegacyPasswords } from '../src/scripts/migrate_passwords.js';
import { decryptSensitive } from '../src/utils/crypto.js';

describe('P1 security and payment regressions', () => {
  let api: TestClient;
  let admin: TestClient;
  before(async () => {
    api = await createTestClient();
    admin = await createTestClient();
    const user = await prisma.user.create({ data: {
      email: `${randomUUID()}@test.invalid`, name: 'Audit Admin', role: 'ADMIN', passwordHash: 'unused',
    } });
    admin.cookie = `auth_token=${signToken({ userId: user.id, email: user.email, role: user.role, tokenVersion: 0 })}`;
  });
  after(async () => { await api.close(); await admin.close(); });

  async function customer() {
    return prisma.user.create({ data: {
      email: `${randomUUID()}@test.invalid`, name: 'Audit Customer', passwordHash: 'unused',
    } });
  }
  async function otp(email: string, purpose = 'reset', extra = {}) {
    return prisma.emailVerification.create({ data: {
      email, purpose, codeHash: createHash('sha256').update('123456').digest('hex'),
      expiresAt: new Date(Date.now() + 600_000), ...extra,
    } });
  }
  async function orders(amounts = [10000]) {
    const owner = await customer();
    const code = `DUKE${randomUUID().replaceAll('-', '').toUpperCase()}`;
    const rows = await Promise.all(amounts.map((amount) => prisma.transaction.create({ data: {
      code: randomUUID(), userId: owner.id, userEmail: owner.email, packageName: 'Audit',
      gameName: 'Audit', amount, paymentOrderCode: code, paymentStatus: 'PENDING',
    } })));
    return { owner, code, rows };
  }
  function webhook(code: string, id: unknown, extra = {}) {
    return api.post('/api/payments/webhook', {
      id, accountNumber: env.SEPAY_ACCOUNT_NUMBER, transferType: 'in', transferAmount: 10000,
      content: code, referenceCode: '', ...extra,
    }, { headers: { authorization: `Apikey ${env.SEPAY_API_KEY}` } });
  }

  it('one OTP permits exactly one concurrent password reset', async () => {
    const user = await customer();
    await otp(user.email);
    const responses = await Promise.all(Array.from({ length: 4 }, (_, index) => api.post('/api/auth/reset-password', {
      email: user.email, code: '123456', password: `AuditResetPassword${index}!`,
    })));
    assert.equal(responses.filter((r) => r.status === 200).length, 1);
    assert.equal(responses.filter((r) => r.status === 400).length, 3);
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(updated.tokenVersion, 1);
    const winner = responses.findIndex((r) => r.status === 200);
    assert.ok(await bcrypt.compare(`AuditResetPassword${winner}!`, updated.passwordHash));
  });

  it('failed account updates roll back OTP consumption', async () => {
    const email = `${randomUUID()}@test.invalid`;
    const code = await otp(email);
    const response = await api.post('/api/auth/reset-password', { email, code: '123456', password: 'AuditRollback123!' });
    assert.equal(response.status, 404);
    assert.equal((await prisma.emailVerification.findUniqueOrThrow({ where: { id: code.id } })).consumedAt, null);
  });

  it('concurrent wrong codes commit attempts and stop at five', async () => {
    const user = await customer();
    const code = await otp(user.email);
    const responses = await Promise.all(Array.from({ length: 7 }, () => api.post('/api/auth/reset-password', {
      email: user.email, code: '000000', password: 'AuditWrongCode123!',
    })));
    assert.ok(responses.every((r) => r.status === 400));
    assert.equal((await prisma.emailVerification.findUniqueOrThrow({ where: { id: code.id } })).attempts, 5);
    assert.equal((await api.post('/api/auth/reset-password', {
      email: user.email, code: '123456', password: 'AuditWrongCode123!',
    })).status, 400);
  });

  it('registration consumes its OTP only once and rolls back on duplicate user', async () => {
    const email = `${randomUUID()}@test.invalid`;
    const passwordHash = await bcrypt.hash('AuditRegister123!', 4);
    await otp(email, 'register', { name: 'Audit', passwordHash });
    const responses = await Promise.all(Array.from({ length: 4 }, () => api.post('/api/auth/register/verify', { email, code: '123456' })));
    assert.equal(responses.filter((r) => r.status === 201).length, 1);
    assert.equal(responses.filter((r) => r.status === 400).length, 3);
    const code = await otp(email, 'register', { name: 'Duplicate', passwordHash });
    assert.equal((await api.post('/api/auth/register/verify', { email, code: '123456' })).status, 409);
    assert.equal((await prisma.emailVerification.findUniqueOrThrow({ where: { id: code.id } })).consumedAt, null);
  });

  it('webhooks require a real safe integer ID even when referenceCode exists', async () => {
    const order = await orders();
    for (const id of [undefined, null, true, '123', 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
      assert.equal((await webhook(order.code, id, { referenceCode: 'some-reference' })).status, 400);
    }
    assert.equal((await prisma.transaction.findUniqueOrThrow({ where: { id: order.rows[0].id } })).paymentStatus, 'PENDING');
    assert.equal(await prisma.paymentReceipt.count({ where: { paymentOrderCode: order.code } }), 0);
  });

  it('one ID settles a multi-item order once, including simultaneous replays to another order', async () => {
    const first = await orders([4000, 6000]);
    const second = await orders();
    const responses = await Promise.all([webhook(first.code, 90001), webhook(second.code, 90001), webhook(first.code, 90001)]);
    assert.ok(responses.every((r) => r.status === 200));
    const receipt = await prisma.paymentReceipt.findUniqueOrThrow({ where: { provider_externalId: { provider: 'sepay', externalId: '90001' } } });
    for (const order of [first, second]) {
      const rows = await prisma.transaction.findMany({ where: { paymentOrderCode: order.code } });
      assert.ok(rows.every((row) => row.paymentStatus === (order.code === receipt.paymentOrderCode ? 'PAID' : 'PENDING')));
    }
    assert.equal((await webhook(receipt.paymentOrderCode, 90001)).status, 200);
    assert.equal(await prisma.paymentReceipt.count({ where: { provider: 'sepay', externalId: '90001' } }), 1);
  });

  it('one bank reference settles every cart line atomically and survives concurrent retries', async () => {
    const order = await orders([4000, 6000]);
    const referenceCode = `REF-${randomUUID()}`;
    const responses = await Promise.all(Array.from({ length: 3 }, () =>
      webhook(order.code, 90002, { referenceCode }),
    ));
    assert.ok(responses.every((response) => response.status === 200), JSON.stringify(responses.map((r) => r.status)));
    const rows = await prisma.transaction.findMany({ where: { paymentOrderCode: order.code } });
    assert.equal(rows.length, 2);
    assert.ok(rows.every((row) => row.paymentStatus === 'PAID' && row.status === 'PROCESSING'));
    assert.ok(rows.every((row) => row.bankTransactionId === referenceCode && row.paidAt));
    assert.equal(await prisma.paymentReceipt.count({ where: { paymentOrderCode: order.code } }), 1);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: order.owner.id } })).totalSpent.toNumber(), 0);
  });

  it('late webhooks preserve terminal status and never double-count spending', async () => {
    for (const [index, status] of (['COMPLETED', 'FAILED', 'REFUNDED'] as const).entries()) {
      const order = await orders();
      if (status === 'REFUNDED' || status === 'COMPLETED') {
        await prisma.transaction.update({
          where: { id: order.rows[0].id },
          data: { paymentStatus: 'PAID' },
        });
      }
      const endpoint = `/api/admin/transactions/${order.rows[0].id}/status`;
      assert.equal((await admin.patch(endpoint, {
        status, ...(status === 'REFUNDED' ? { refundReason: 'Verified refund before late webhook' } : {}),
      })).status, 200);
      assert.equal((await webhook(order.code, 90100 + index)).status, 200);
      assert.equal((await prisma.transaction.findUniqueOrThrow({ where: { id: order.rows[0].id } })).status, status);
      assert.equal((await admin.patch(endpoint, { status })).status, status === 'REFUNDED' ? 400 : 200);
      const owner = await prisma.user.findUniqueOrThrow({ where: { id: order.owner.id } });
      assert.equal(Number(owner.totalSpent), status === 'COMPLETED' ? 10000 : 0);
    }
  });

  it('admin completion concurrent with payment preserves final status and spending', async () => {
    const order = await orders();
    const responses = await Promise.all([
      admin.patch(`/api/admin/transactions/${order.rows[0].id}/status`, { status: 'COMPLETED' }),
      webhook(order.code, 90200),
    ]);
    assert.equal(responses[1].status, 200);
    assert.ok([200, 400].includes(responses[0].status));
    if (responses[0].status === 400) {
      assert.equal(Number((await prisma.user.findUniqueOrThrow({ where: { id: order.owner.id } })).totalSpent), 0);
      assert.equal((await admin.patch(`/api/admin/transactions/${order.rows[0].id}/status`, {
        status: 'COMPLETED',
      })).status, 200);
    }
    const row = await prisma.transaction.findUniqueOrThrow({ where: { id: order.rows[0].id } });
    assert.equal(row.status, 'COMPLETED');
    assert.equal(row.paymentStatus, 'PAID');
    assert.equal(Number((await prisma.user.findUniqueOrThrow({ where: { id: order.owner.id } })).totalSpent), 10000);
  });

  it('orphan legacy fields stay private, migrate reversibly and remain readable for fulfillment', async () => {
    const order = await orders();
    const row = await prisma.transaction.update({ where: { id: order.rows[0].id }, data: {
      topupInfo: { credential: ' legacy password ', uid: '800123456' },
    } });
    const customerApi = await createTestClient();
    customerApi.cookie = `auth_token=${signToken({ userId: order.owner.id, email: order.owner.email, role: 'CUSTOMER', tokenVersion: 0 })}`;
    try {
      const before = await customerApi.get(`/api/orders/${row.code}`);
      assert.equal(before.status, 200);
      assert.ok(!JSON.stringify(before.body).includes(' legacy password '));
      await migrateLegacyPasswords();
      const migrated = await prisma.transaction.findUniqueOrThrow({ where: { id: row.id } });
      const data = migrated.topupInfo as Record<string, string>;
      assert.ok(data.credential.startsWith('enc:'));
      assert.equal(decryptSensitive(data.credential), ' legacy password ');
      const detail = await admin.get(`/api/admin/transactions/${row.id}`);
      assert.equal(detail.body.data.topupInfo.credential, ' legacy password ');
      assert.equal(detail.body.data.topupInfo.uid, '800123456');
      const closed = await admin.patch(`/api/admin/transactions/${row.id}/status`, {
        status: 'COMPLETED', paymentStatus: 'PAID', reason: 'Verified transfer',
      });
      assert.equal(closed.status, 200);
      assert.ok(!JSON.stringify(closed.body).includes(data.credential));
      assert.ok(!JSON.stringify(closed.body).includes(' legacy password '));
      await migrateLegacyPasswords();
      assert.deepEqual((await prisma.transaction.findUniqueOrThrow({ where: { id: row.id } })).topupInfo, migrated.topupInfo);
      const after = await customerApi.get(`/api/orders/${row.code}`);
      assert.ok(!JSON.stringify(after.body).includes(' legacy password '));
    } finally { await customerApi.close(); }
  });
});
