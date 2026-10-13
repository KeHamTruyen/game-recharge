import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTestClient, prisma, TestClient } from './helpers.js';
import { env } from '../src/config/env.js';
import { signToken } from '../src/middleware/auth.js';

describe('Payment reconciliation', () => {
  let client: TestClient;
  let admin: TestClient;
  let customer: TestClient;
  let eventId = 7000000;
  before(async () => {
    client = await createTestClient();
    admin = await createTestClient();
    customer = await createTestClient();
    for (const [api, role] of [[admin, 'ADMIN'], [customer, 'CUSTOMER']] as const) {
      const user = await prisma.user.create({ data: {
        email: `${randomUUID()}@test.invalid`, name: 'Reconciliation', role, passwordHash: 'unused',
      } });
      api.cookie = `auth_token=${signToken({ userId: user.id, email: user.email, role, tokenVersion: 0 })}`;
    }
  });
  after(async () => { await Promise.all([client.close(), admin.close(), customer.close()]); });

  async function order() {
    const code = `DUKE${randomUUID().replaceAll('-', '').toUpperCase()}`;
    return prisma.transaction.create({ data: {
      code, paymentOrderCode: code, userEmail: 'fake@test.invalid', packageName: 'Test',
      gameName: 'Test', amount: 10000, paymentStatus: 'PENDING',
    } });
  }
  function payload(code: string, extra = {}) {
    return { id: ++eventId, accountNumber: env.SEPAY_ACCOUNT_NUMBER, transferType: 'in',
      content: code, transferAmount: 10000, referenceCode: randomUUID(), ...extra };
  }
  const send = (body: object) => client.post('/api/payments/webhook', body, {
    headers: { authorization: `Apikey ${env.SEPAY_API_KEY}` },
  });

  it('ignores repeated events and bank references without false duplicate alerts', async () => {
    const row = await order();
    const body = payload(row.code);
    assert.equal((await send(body)).status, 200);
    const paid = await prisma.transaction.findUniqueOrThrow({ where: { id: row.id } });
    const responses = await Promise.all([
      send(body), send(body), send({ ...body, id: ++eventId }),
      send({ ...body, referenceCode: null }),
    ]);
    assert.ok(responses.every((res) => res.status === 200));
    assert.equal(await prisma.paymentAnomaly.count({ where: { orderCode: row.code } }), 0);
    assert.equal(await prisma.paymentReceipt.count({ where: { paymentOrderCode: row.code } }), 1);
    assert.deepEqual(await prisma.transaction.findUniqueOrThrow({ where: { id: row.id } }), paid);
  });

  for (const referenceCode of [undefined, 'present']) {
    it(`records a second incoming payment once, including races (reference=${referenceCode})`, async () => {
      const row = await order();
      const first = payload(row.code, { referenceCode: referenceCode ? randomUUID() : null });
      const second = payload(row.code, { referenceCode: referenceCode ? randomUUID() : null });
      const responses = await Promise.all([send(first), send(second), send(first), send(second)]);
      assert.ok(responses.every((res) => res.status === 200));
      const records = await prisma.paymentAnomaly.findMany({ where: { orderCode: row.code } });
      assert.equal(records.length, 1);
      assert.equal(records[0].anomalyType, 'DUPLICATE_PAYMENT');
      assert.equal(Number(records[0].amount), 10000);
      assert.equal(await prisma.paymentReceipt.count({ where: { paymentOrderCode: row.code } }), 1);
      const paid = await prisma.transaction.findUniqueOrThrow({ where: { id: row.id } });
      assert.equal(paid.paymentStatus, 'PAID');
      const receipt = await prisma.paymentReceipt.findFirstOrThrow({ where: { paymentOrderCode: row.code } });
      assert.notEqual(receipt.externalId, records[0].gatewayId);
    });
  }

  for (const kind of ['NO_ORDER_CODE', 'ORDER_NOT_FOUND', 'AMOUNT_MISMATCH', 'MISMATCHED_ACCOUNT']) {
    it(`records ${kind} once; resolving and replaying it never silently settles an order`, async () => {
      const row = await order();
      const body = payload(row.code, {
        ...(kind === 'NO_ORDER_CODE' ? { content: 'no order supplied' } : {}),
        ...(kind === 'ORDER_NOT_FOUND' ? { content: `DUKE${randomUUID().replaceAll('-', '')}` } : {}),
        ...(kind === 'AMOUNT_MISMATCH' ? { transferAmount: 9000 } : {}),
        ...(kind === 'MISMATCHED_ACCOUNT' ? { accountNumber: 'wrong-account' } : {}),
      });
      const responses = await Promise.all([send(body), send(body), send(body)]);
      assert.ok(responses.every((res) => res.status === 200));
      const records = await prisma.paymentAnomaly.findMany({ where: { gatewayId: String(body.id) } });
      assert.equal(records.length, 1);
      const anomaly = records[0];
      assert.equal(anomaly.anomalyType, kind);
      const path = `/api/admin/payment-anomalies/${anomaly.id}/resolve`;
      assert.equal((await customer.patch(path, { resolutionNote: 'Unauthorized' })).status, 403);
      assert.equal((await admin.patch(path, { resolutionNote: '   ' })).status, 400);
      assert.equal((await admin.patch(path, { resolutionNote: 'Reconciled manually' })).status, 200);
      assert.equal((await send(body)).status, 200);
      assert.equal((await send({ ...body, id: ++eventId })).status, 200);
      assert.equal(await prisma.paymentAnomaly.count({ where: { referenceCode: body.referenceCode } }), 1);
      assert.equal((await prisma.paymentAnomaly.findUniqueOrThrow({ where: { id: anomaly.id } })).resolved, true);
      assert.equal((await prisma.transaction.findUniqueOrThrow({ where: { id: row.id } })).paymentStatus, 'PENDING');
      assert.equal(await prisma.paymentReceipt.count({ where: { externalId: String(body.id) } }), 0);
    });
  }

  it('records overpayment and payments to refunded or failed payments without overwriting them', async () => {
    for (const state of ['PENDING', 'REFUNDED', 'FAILED'] as const) {
      const row = await order();
      await prisma.transaction.update({ where: { id: row.id }, data: { paymentStatus: state } });
      const body = payload(row.code, { transferAmount: 20000 });
      assert.equal((await send(body)).status, 200);
      const anomaly = await prisma.paymentAnomaly.findFirstOrThrow({ where: { gatewayId: String(body.id) } });
      assert.equal(anomaly.anomalyType, state === 'PENDING' ? 'AMOUNT_MISMATCH' : state === 'REFUNDED' ? 'DUPLICATE_PAYMENT' : 'PAYMENT_NOT_PAYABLE');
      assert.equal(Number(anomaly.expectedAmount), 10000);
      assert.equal((await prisma.transaction.findUniqueOrThrow({ where: { id: row.id } })).paymentStatus, state);
    }
  });

  it('checks the full checkout amount even when bank content names one cart line', async () => {
    const first = await order();
    const second = await order();
    await prisma.transaction.update({ where: { id: second.id }, data: { paymentOrderCode: first.code } });
    assert.equal((await send(payload(second.code))).status, 200);
    assert.equal((await prisma.transaction.findUniqueOrThrow({ where: { id: first.id } })).paymentStatus, 'PENDING');
    assert.equal((await send(payload(second.code, { transferAmount: 20000 }))).status, 200);
    const rows = await prisma.transaction.findMany({ where: { paymentOrderCode: first.code } });
    assert.ok(rows.every((row) => row.paymentStatus === 'PAID'));
  });

  it('rolls back settlement and receipt together so a failed delivery can be retried', async () => {
    const row = await order();
    const body = payload(row.code);
    // Force the final update to fail without changing payment-handler implementation.
    await prisma.$executeRawUnsafe(`ALTER TABLE transactions ADD CONSTRAINT reconciliation_test_failure CHECK (code <> '${row.code}' OR "paymentStatus" <> 'PAID')`);
    try {
      assert.equal((await send(body)).status, 500);
      assert.equal(await prisma.paymentReceipt.count({ where: { externalId: String(body.id) } }), 0);
      assert.equal((await prisma.transaction.findUniqueOrThrow({ where: { id: row.id } })).status, 'PENDING');
    } finally {
      await prisma.$executeRawUnsafe('ALTER TABLE transactions DROP CONSTRAINT reconciliation_test_failure');
    }
    assert.equal((await send(body)).status, 200);
    assert.equal((await prisma.transaction.findUniqueOrThrow({ where: { id: row.id } })).paymentStatus, 'PAID');
  });
});
