import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { createTestClient, TestClient, prisma } from './helpers.js';

describe('Orders & Checkout Logic (Atomic & Idempotent)', () => {
  let customerClient: TestClient;
  let otherClient: TestClient;
  let guestClient: TestClient;

  const customerEmail = 'order-test-user@test.com';
  const otherCustomerEmail = 'order-other-user@test.com';
  const password = 'Password123!';

  let templateId: string;
  let service1Id: string;
  let service2Id: string;
  let package1Id: string;
  let package2Id: string;
  let packageService2Id: string;

  before(async () => {
    customerClient = await createTestClient();
    otherClient = await createTestClient();
    guestClient = await createTestClient();

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.upsert({
      where: { email: customerEmail },
      update: { passwordHash, role: 'CUSTOMER', status: 'ACTIVE', tokenVersion: 0 },
      create: { email: customerEmail, name: 'Order Customer', passwordHash, role: 'CUSTOMER', status: 'ACTIVE', tokenVersion: 0 },
    });
    await prisma.user.upsert({
      where: { email: otherCustomerEmail },
      update: { passwordHash, role: 'CUSTOMER', status: 'ACTIVE', tokenVersion: 0 },
      create: { email: otherCustomerEmail, name: 'Other Customer', passwordHash, role: 'CUSTOMER', status: 'ACTIVE', tokenVersion: 0 },
    });

    let status = await prisma.productStatus.findFirst({ where: { purchasable: true } });
    if (!status) {
      status = await prisma.productStatus.create({
        data: { id: 'status-order-test', name: 'Có sẵn', iconName: 'CheckCircle', color: 'green', purchasable: true },
      });
    }

    // Topup template with required UID and Server
    templateId = `tpl-test-${Date.now()}`;
    await prisma.topupTemplate.create({
      data: {
        id: templateId,
        name: 'Order Test Template',
        game: 'Order Game 1',
        fields: [
          {
            key: 'uid',
            label: 'Game UID',
            type: 'text',
            required: true,
            pattern: '^\\d{9,10}$',
          },
          {
            key: 'server',
            label: 'Server',
            type: 'select',
            required: true,
            options: ['asia', 'america', 'europe'],
          },
        ],
      },
    });

    // Game 1
    const s1 = await prisma.service.create({
      data: {
        name: 'Order Game 1',
        game: 'Order Game 1',
        isActive: true,
      },
    });
    service1Id = s1.id;

    // Game 2 (for cross-game validation)
    const s2 = await prisma.service.create({
      data: {
        name: 'Order Game 2',
        game: 'Order Game 2',
        isActive: true,
      },
    });
    service2Id = s2.id;

    // Packages
    const p1 = await prisma.servicePackage.create({
      data: {
        serviceId: service1Id,
        name: 'Package 1 - 100 Gems',
        price: 50000,
        statusId: status.id,
        templateId,
        isActive: true,
      },
    });
    package1Id = p1.id;

    const p2 = await prisma.servicePackage.create({
      data: {
        serviceId: service1Id,
        name: 'Package 2 - 300 Gems',
        price: 150000,
        statusId: status.id,
        templateId,
        isActive: true,
      },
    });
    package2Id = p2.id;

    const p3 = await prisma.servicePackage.create({
      data: {
        serviceId: service2Id,
        name: 'Game 2 Package - 50 Gold',
        price: 30000,
        statusId: status.id,
        isActive: true,
      },
    });
    packageService2Id = p3.id;

    // Login clients
    await customerClient.post('/api/auth/login', { email: customerEmail, password });
    await otherClient.post('/api/auth/login', { email: otherCustomerEmail, password });
  });

  after(async () => {
    await prisma.checkoutRequest.deleteMany({}).catch(() => {});
    await prisma.transaction.deleteMany({
      where: { userEmail: { in: [customerEmail, otherCustomerEmail] } },
    }).catch(() => {});
    await prisma.servicePackage.deleteMany({
      where: { id: { in: [package1Id, package2Id, packageService2Id] } },
    }).catch(() => {});
    await prisma.service.deleteMany({
      where: { id: { in: [service1Id, service2Id] } },
    }).catch(() => {});
    await prisma.topupTemplate.deleteMany({ where: { id: templateId } }).catch(() => {});
    await prisma.user.deleteMany({
      where: { email: { in: [customerEmail, otherCustomerEmail] } },
    }).catch(() => {});

    await customerClient.close();
    await otherClient.close();
    await guestClient.close();
  });

  it('Unauthenticated checkout should return 401', async () => {
    const res = await guestClient.post('/api/orders/checkout', {
      items: [{ packageId: package1Id, quantity: 1 }],
      topupInfo: { uid: '800123456', server: 'asia' },
    });
    assert.strictEqual(res.status, 401);
  });

  it('Checkout requires a valid Idempotency-Key header (>= 16 chars)', async () => {
    // Missing key
    const resMissing = await customerClient.post('/api/orders/checkout', {
      items: [{ packageId: package1Id, quantity: 1 }],
      topupInfo: { uid: '800123456', server: 'asia' },
    });
    assert.strictEqual(resMissing.status, 400);

    // Key too short
    const resShort = await customerClient.post(
      '/api/orders/checkout',
      {
        items: [{ packageId: package1Id, quantity: 1 }],
        topupInfo: { uid: '800123456', server: 'asia' },
      },
      { headers: { 'Idempotency-Key': 'short-key' } }
    );
    assert.strictEqual(resShort.status, 400);
  });

  it('Topup validation: Rejects missing required template field', async () => {
    const idempotencyKey = crypto.randomUUID();
    const res = await customerClient.post(
      '/api/orders/checkout',
      {
        items: [{ packageId: package1Id, quantity: 1 }],
        topupInfo: { server: 'asia' }, // missing uid
      },
      { headers: { 'Idempotency-Key': idempotencyKey } }
    );
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  it('Topup validation: Rejects pattern mismatch (UID must be 9-10 digits)', async () => {
    const idempotencyKey = crypto.randomUUID();
    const res = await customerClient.post(
      '/api/orders/checkout',
      {
        items: [{ packageId: package1Id, quantity: 1 }],
        topupInfo: { uid: 'abc123', server: 'asia' },
      },
      { headers: { 'Idempotency-Key': idempotencyKey } }
    );
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  it('Topup validation: Rejects invalid select option', async () => {
    const idempotencyKey = crypto.randomUUID();
    const res = await customerClient.post(
      '/api/orders/checkout',
      {
        items: [{ packageId: package1Id, quantity: 1 }],
        topupInfo: { uid: '800123456', server: 'invalid-server' },
      },
      { headers: { 'Idempotency-Key': idempotencyKey } }
    );
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  it('Topup validation: Rejects unknown fields', async () => {
    const idempotencyKey = crypto.randomUUID();
    const res = await customerClient.post(
      '/api/orders/checkout',
      {
        items: [{ packageId: package1Id, quantity: 1 }],
        topupInfo: { uid: '800123456', server: 'asia', hackerField: 'injection' },
      },
      { headers: { 'Idempotency-Key': idempotencyKey } }
    );
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  it('Cross-game checkout rejection: Cannot mix items from different games', async () => {
    const idempotencyKey = crypto.randomUUID();
    const res = await customerClient.post(
      '/api/orders/checkout',
      {
        items: [
          { packageId: package1Id, quantity: 1 },
          { packageService2Id: packageService2Id, quantity: 1 },
        ],
        topupInfo: { uid: '800123456', server: 'asia' },
      },
      { headers: { 'Idempotency-Key': idempotencyKey } }
    );
    assert.strictEqual(res.status, 400);
  });

  it('CHECKOUT-001 & CHECKOUT-003: Single package checkout and Idempotency verification', async () => {
    const idempotencyKey = crypto.randomUUID();
    const payload = {
      items: [{ packageId: package1Id, quantity: 2 }],
      topupInfo: { uid: '800123456', server: 'asia' },
    };

    // First checkout call
    const res1 = await customerClient.post('/api/orders/checkout', payload, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    assert.strictEqual(res1.status, 201);
    assert.strictEqual(res1.body.success, true);
    assert.ok(res1.body.data.payment.orderCode);
    assert.strictEqual(res1.body.data.payment.amount, 100000); // 50000 * 2
    assert.strictEqual(res1.body.data.transactions.length, 1);

    const paymentOrderCode = res1.body.data.payment.orderCode;

    // Verify exactly 1 transaction created in DB
    const txCount1 = await prisma.transaction.count({
      where: { paymentOrderCode },
    });
    assert.strictEqual(txCount1, 1);

    // Replay with identical idempotency key
    const res2 = await customerClient.post('/api/orders/checkout', payload, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    assert.strictEqual(res2.status, 201);
    assert.strictEqual(res2.body.data.payment.orderCode, paymentOrderCode);
    assert.strictEqual(res2.body.data.payment.amount, 100000);

    // Verify still exactly 1 transaction in DB (no duplicates created!)
    const txCount2 = await prisma.transaction.count({
      where: { paymentOrderCode },
    });
    assert.strictEqual(txCount2, 1);

    // Replay with DIFFERENT payload should return 409 Conflict
    const resDifferentPayload = await customerClient.post('/api/orders/checkout', {
      ...payload,
      topupInfo: { uid: '999888777', server: 'europe' },
    }, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    assert.strictEqual(resDifferentPayload.status, 409);
    assert.strictEqual(resDifferentPayload.body.error, 'Checkout key was already used for another request');
  });

  it('CHECKOUT-002: Multi-package atomic checkout for same game', async () => {
    const idempotencyKey = crypto.randomUUID();
    const payload = {
      items: [
        { packageId: package1Id, quantity: 1 }, // 50000
        { packageId: package2Id, quantity: 2 }, // 150000 * 2 = 300000
      ],
      topupInfo: { uid: '800123456', server: 'asia' },
    };

    const res = await customerClient.post('/api/orders/checkout', payload, {
      headers: { 'Idempotency-Key': idempotencyKey },
    });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.payment.amount, 350000); // 50000 + 300000
    assert.strictEqual(res.body.data.transactions.length, 2);

    const paymentOrderCode = res.body.data.payment.orderCode;
    const txs = await prisma.transaction.findMany({
      where: { paymentOrderCode },
    });
    assert.strictEqual(txs.length, 2);
    assert.strictEqual(txs.every((t) => t.status === 'PENDING'), true);
    assert.strictEqual(txs.every((t) => t.paymentStatus === 'PENDING'), true);
  });

  it('GET /api/orders/mine returns only current customer orders', async () => {
    const resMine = await customerClient.get('/api/orders/mine');
    assert.strictEqual(resMine.status, 200);
    assert.strictEqual(resMine.body.success, true);
    assert.ok(Array.isArray(resMine.body.data.items));
    assert.ok(resMine.body.data.items.length > 0);

    // Other customer has no orders yet
    const resOther = await otherClient.get('/api/orders/mine');
    assert.strictEqual(resOther.status, 200);
    assert.strictEqual(resOther.body.data.items.length, 0);
  });
});
