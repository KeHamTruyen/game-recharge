import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTestClient, prisma, TestClient } from './helpers.js';
import { signToken } from '../src/middleware/auth.js';
import { env } from '../src/config/env.js';

describe('VND prices and checkout totals', () => {
  let admin: TestClient;
  let customer: TestClient;
  let serviceId: string;
  let statusId: string;
  let packageId: string;
  const maxAmount = 9_999_999_999;
  before(async () => {
    admin = await createTestClient();
    customer = await createTestClient();
    for (const [client, role] of [[admin, 'ADMIN'], [customer, 'CUSTOMER']] as const) {
      const user = await prisma.user.create({ data: {
        email: `${randomUUID()}@test.invalid`, name: 'Money test', role, passwordHash: 'unused',
      } });
      client.cookie = `auth_token=${signToken({ userId: user.id, email: user.email, role, tokenVersion: 0 })}`;
    }
    serviceId = (await prisma.service.create({ data: { name: 'Money test', game: 'Money test' } })).id;
    statusId = (await prisma.productStatus.create({ data: { id: randomUUID(), name: 'Available' } })).id;
    packageId = (await prisma.servicePackage.create({ data: {
      serviceId, statusId, name: 'Valid package', price: 10000,
    } })).id;
  });
  after(async () => { await admin.close(); await customer.close(); });

  const checkout = (items: Array<{ packageId: string; quantity: number }>) => customer.post('/api/orders/checkout', {
    items, topupInfo: {},
  }, { headers: { 'Idempotency-Key': randomUUID() } });

  it('admin create and update reject fractional, nonpositive, oversized and nonnumeric prices', async () => {
    const count = await prisma.servicePackage.count();
    for (const field of ['price', 'oldPrice']) {
      for (const value of [10000.5, 0, -1, maxAmount + 1, true, '10000']) {
        const created = await admin.post('/api/admin/packages', {
          serviceId, statusId, name: 'Invalid price', price: 10000, [field]: value,
        });
        assert.equal(created.status, 400, `create ${field}=${value}`);
        const updated = await admin.put(`/api/admin/packages/${packageId}`, { [field]: value });
        assert.equal(updated.status, 400, `update ${field}=${value}`);
      }
    }
    assert.equal(await prisma.servicePackage.count(), count);
    const pkg = await prisma.servicePackage.findUniqueOrThrow({ where: { id: packageId } });
    assert.equal(Number(pkg.price), 10000);
    assert.equal(pkg.oldPrice, null);
  });

  it('admin accepts integer boundaries and can clear the optional old price', async () => {
    for (const price of [1, maxAmount]) {
      const created = await admin.post('/api/admin/packages', {
        serviceId, statusId, name: 'Boundary price', price, oldPrice: maxAmount,
      });
      assert.equal(created.status, 201);
      assert.equal(Number(created.body.data.price), price);
      const updated = await admin.put(`/api/admin/packages/${created.body.data.id}`, { oldPrice: null });
      assert.equal(updated.status, 200);
      assert.equal(updated.body.data.oldPrice, null);
    }
  });

  it('legacy fractional prices are blocked on both creation paths even when quantity makes an integer total', async () => {
    const legacy = await prisma.servicePackage.create({ data: { serviceId, statusId, name: 'Legacy', price: 10000.5 } });
    const rows = await prisma.transaction.count();
    const caches = await prisma.checkoutRequest.count();
    const single = await customer.post('/api/orders', { packageId: legacy.id, quantity: 2, topupInfo: {} });
    assert.equal(single.status, 400);
    const multi = await checkout([{ packageId, quantity: 1 }, { packageId: legacy.id, quantity: 2 }]);
    assert.equal(multi.status, 400);
    assert.equal(await prisma.transaction.count(), rows);
    assert.equal(await prisma.checkoutRequest.count(), caches);
  });

  it('line amount overflow is rejected without database errors or partial orders', async () => {
    const pkg = await prisma.servicePackage.create({ data: { serviceId, statusId, name: 'Large', price: maxAmount } });
    const rows = await prisma.transaction.count();
    const caches = await prisma.checkoutRequest.count();
    assert.equal((await customer.post('/api/orders', { packageId: pkg.id, quantity: 2 })).status, 400);
    assert.equal((await checkout([{ packageId, quantity: 1 }, { packageId: pkg.id, quantity: 2 }])).status, 400);
    assert.equal(await prisma.transaction.count(), rows);
    assert.equal(await prisma.checkoutRequest.count(), caches);
  });

  it('combined checkout total above the limit rolls back all lines and cache', async () => {
    const pkg = await prisma.servicePackage.create({ data: { serviceId, statusId, name: 'Half limit', price: 5_000_000_000 } });
    const rows = await prisma.transaction.count();
    const caches = await prisma.checkoutRequest.count();
    assert.equal((await checkout([{ packageId: pkg.id, quantity: 1 }, { packageId: pkg.id, quantity: 1 }])).status, 400);
    assert.equal(await prisma.transaction.count(), rows);
    assert.equal(await prisma.checkoutRequest.count(), caches);
  });

  it('integer totals at both boundaries produce exact QR amounts and settle via webhook', async () => {
    for (const amount of [1, maxAmount]) {
      const pkg = await prisma.servicePackage.create({ data: { serviceId, statusId, name: 'Boundary', price: amount } });
      const created = await checkout([{ packageId: pkg.id, quantity: 1 }]);
      assert.equal(created.status, 201);
      const payment = created.body.data.payment;
      assert.equal(payment.amount, amount);
      assert.equal(new URL(payment.qrCode).searchParams.get('amount'), String(amount));
      const paid = await customer.post('/api/payments/webhook', {
        id: amount + 7000, accountNumber: env.SEPAY_ACCOUNT_NUMBER, transferType: 'in',
        transferAmount: amount, content: payment.orderCode,
      }, { headers: { authorization: `Apikey ${env.SEPAY_API_KEY}` } });
      assert.equal(paid.status, 200);
      const tx = await prisma.transaction.findFirstOrThrow({ where: { paymentOrderCode: payment.orderCode } });
      assert.equal(tx.paymentStatus, 'PAID');
      assert.equal(Number(tx.amount), amount);
    }
  });
});
