import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import bcrypt from 'bcrypt';
import { createTestClient, TestClient, prisma } from './helpers.js';

describe('Admin Panel Operations & Audit Logging', () => {
  let adminClient: TestClient;
  const adminEmail = 'admin-crud@test.com';
  const password = 'Password123!';

  let createdServiceId: string;
  let createdPackageId: string;
  let createdTagId: string;
  let testTransactionId: string;

  before(async () => {
    adminClient = await createTestClient();

    const passwordHash = await bcrypt.hash(password, 10);
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { passwordHash, role: 'ADMIN', status: 'ACTIVE', tokenVersion: 0 },
      create: { email: adminEmail, name: 'Admin CRUD', passwordHash, role: 'ADMIN', status: 'ACTIVE', tokenVersion: 0 },
    });

    // Ensure status exists
    let status = await prisma.productStatus.findFirst();
    if (!status) {
      status = await prisma.productStatus.create({
        data: { id: 'status-admin-test', name: 'Có sẵn', iconName: 'CheckCircle', color: 'green', purchasable: true },
      });
    }

    // Create a transaction fixture for status updates
    const tx = await prisma.transaction.create({
      data: {
        code: `NXTEST${Date.now()}`,
        userEmail: 'customer@test.com',
        packageName: 'Admin Test Item',
        gameName: 'Admin Test Game',
        amount: 50000,
        quantity: 1,
        status: 'PENDING',
        paymentStatus: 'UNPAID',
      },
    });
    testTransactionId = tx.id;

    // Login as admin
    const loginRes = await adminClient.post('/api/auth/login', { email: adminEmail, password });
    assert.strictEqual(loginRes.status, 200);
  });

  after(async () => {
    if (createdPackageId) {
      await prisma.servicePackage.deleteMany({ where: { id: createdPackageId } }).catch(() => {});
    }
    if (createdServiceId) {
      await prisma.service.deleteMany({ where: { id: createdServiceId } }).catch(() => {});
    }
    if (createdTagId) {
      await prisma.catalogTag.deleteMany({ where: { id: createdTagId } }).catch(() => {});
    }
    if (testTransactionId) {
      await prisma.transaction.deleteMany({ where: { id: testTransactionId } }).catch(() => {});
    }
    await prisma.auditLog.deleteMany({ where: { path: { in: ['/services', '/packages', '/tags', '/settings/siteConfig'] } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: adminEmail } }).catch(() => {});
    await adminClient.close();
  });

  it('POST /api/admin/services creates a service with audit log and X-Request-Id', async () => {
    const res = await adminClient.post('/api/admin/services', {
      name: 'Admin Test Service',
      game: 'Admin Test Game',
      description: 'Created during admin tests',
      iconText: 'AT',
      tone: 'emerald',
      isActive: true,
      sortOrder: 10,
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.id);
    assert.ok(res.headers.get('x-request-id'), 'Response must have X-Request-Id header');

    createdServiceId = res.body.data.id;

    // Check audit log created in database
    const audit = await prisma.auditLog.findFirst({
      where: {
        method: 'POST',
        path: '/services',
        statusCode: 201,
      },
      orderBy: { createdAt: 'desc' },
    });
    assert.ok(audit, 'Audit log entry should exist');
  });

  it('POST /api/admin/services rejects invalid payload (empty name)', async () => {
    const res = await adminClient.post('/api/admin/services', {
      name: '',
      game: 'Valid Game',
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  it('PUT /api/admin/services/:id updates service', async () => {
    const res = await adminClient.put(`/api/admin/services/${createdServiceId}`, {
      description: 'Updated description for test service',
      sortOrder: 20,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.description, 'Updated description for test service');
    assert.strictEqual(res.body.data.sortOrder, 20);
  });

  it('POST /api/admin/packages creates a service package', async () => {
    const status = await prisma.productStatus.findFirst();
    const res = await adminClient.post('/api/admin/packages', {
      serviceId: createdServiceId,
      name: 'Admin Test Gem Pack',
      price: 99000,
      oldPrice: 120000,
      statusId: status?.id ?? 'status-admin-test',
      tags: ['special', 'deal'],
      isActive: true,
      sortOrder: 1,
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.id);
    assert.deepStrictEqual(res.body.data.tags, ['special', 'deal']);

    createdPackageId = res.body.data.id;
  });

  it('POST /api/admin/packages rejects negative price', async () => {
    const res = await adminClient.post('/api/admin/packages', {
      serviceId: createdServiceId,
      name: 'Negative Price Pack',
      price: -5000,
    });
    assert.strictEqual(res.status, 400);
  });

  it('PUT /api/admin/packages/:id updates package', async () => {
    const res = await adminClient.put(`/api/admin/packages/${createdPackageId}`, {
      price: 89000,
      name: 'Updated Gem Pack',
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.price, '89000');
    assert.strictEqual(res.body.data.name, 'Updated Gem Pack');
  });

  it('POST /api/admin/tags and DELETE /api/admin/tags/:id', async () => {
    const tagRes = await adminClient.post('/api/admin/tags', {
      name: `test-tag-${Date.now()}`,
    });
    assert.strictEqual(tagRes.status, 201);
    createdTagId = tagRes.body.data.id;

    const delRes = await adminClient.delete(`/api/admin/tags/${createdTagId}`);
    assert.strictEqual(delRes.status, 200);
    assert.strictEqual(delRes.body.success, true);
    createdTagId = '';
  });

  it('PATCH /api/admin/transactions/:id/status updates transaction status', async () => {
    const res = await adminClient.patch(`/api/admin/transactions/${testTransactionId}/status`, {
      status: 'PROCESSING',
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.status, 'PROCESSING');

    // Verify DB
    const tx = await prisma.transaction.findUnique({ where: { id: testTransactionId } });
    assert.strictEqual(tx?.status, 'PROCESSING');
  });

  it('PUT /api/admin/settings/:key updates site settings', async () => {
    const res = await adminClient.put('/api/admin/settings/siteConfig', {
      siteName: 'NEXA TOPUP',
      maintenanceMode: false,
    });

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });

  it('DELETE /api/admin/packages/:id deletes package', async () => {
    const res = await adminClient.delete(`/api/admin/packages/${createdPackageId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    createdPackageId = '';
  });

  it('DELETE /api/admin/services/:id deletes service', async () => {
    const res = await adminClient.delete(`/api/admin/services/${createdServiceId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    createdServiceId = '';
  });

  it('Concurrent completion updates count customer spending only once', async () => {
    const customer = await prisma.user.create({ data: {
      email: 'concurrent-completion@test.invalid', name: 'Concurrency test',
      passwordHash: await bcrypt.hash(password, 10),
    } });
    const order = await prisma.transaction.create({ data: {
      code: `CONCURRENT${Date.now()}`, userId: customer.id, userEmail: customer.email,
      packageName: 'Test package', gameName: 'Test game', amount: 1000, quantity: 1,
      status: 'PROCESSING', paymentStatus: 'PAID',
    } });
    try {
      const responses = await Promise.all(Array.from({ length: 4 }, () =>
        adminClient.patch(`/api/admin/transactions/${order.id}/status`, { status: 'COMPLETED' })));
      assert.ok(responses.every((response) => response.status === 200));
      const updated = await prisma.user.findUniqueOrThrow({ where: { id: customer.id } });
      assert.strictEqual(Number(updated.totalSpent), 1000);
    } finally {
      await prisma.transaction.delete({ where: { id: order.id } });
      await prisma.user.delete({ where: { id: customer.id } });
    }
  });

  it('DELETE /api/admin/product-statuses/:id rejects fallbackId === id or invalid fallbackId', async () => {
    const testStatus = await prisma.productStatus.create({
      data: { id: 'status-delete-test', name: 'Test Delete', iconName: 'AlertCircle', color: 'red', purchasable: true },
    });

    try {
      // Trying fallbackId === id must return 400
      const resSelf = await adminClient.delete(`/api/admin/product-statuses/${testStatus.id}?fallbackId=${testStatus.id}`);
      assert.strictEqual(resSelf.status, 400);

      // Trying non-existent fallbackId must return 400
      const resInvalid = await adminClient.delete(`/api/admin/product-statuses/${testStatus.id}?fallbackId=nonexistent-status-xyz`);
      assert.strictEqual(resInvalid.status, 400);
    } finally {
      await prisma.productStatus.delete({ where: { id: testStatus.id } }).catch(() => {});
    }
  });

  it('GET /api/admin/transactions/:id decrypts sensitive fields and preserves legacy passwords for admin', async () => {
    // 1. Transaction with encrypted custom field name (e.g. 'credential' via enc:...)
    const { encryptSensitive } = await import('../src/utils/crypto.js');
    const secretText = 'superSecretPassword123';
    const encryptedText = encryptSensitive(secretText);

    const tx1 = await prisma.transaction.create({
      data: {
        code: `ENC_TEST_${Date.now()}`,
        userEmail: 'customer@test.invalid',
        packageName: 'Encrypted Package',
        gameName: 'Enc Game',
        amount: 50000,
        quantity: 1,
        status: 'PENDING',
        topupInfo: { credential: encryptedText, uid: '123456' },
      },
    });

    // 2. Legacy transaction with plaintext password
    const legacyPassword = 'plainTextPasswordOld';
    const tx2 = await prisma.transaction.create({
      data: {
        code: `LEGACY_TEST_${Date.now()}`,
        userEmail: 'customer@test.invalid',
        packageName: 'Legacy Package',
        gameName: 'Legacy Game',
        amount: 50000,
        quantity: 1,
        status: 'PROCESSING',
        topupInfo: { password: legacyPassword, uid: '654321' },
      },
    });

    try {
      const res1 = await adminClient.get(`/api/admin/transactions/${tx1.id}`);
      assert.strictEqual(res1.status, 200);
      assert.strictEqual(res1.body.data.topupInfo.credential, secretText);

      const res2 = await adminClient.get(`/api/admin/transactions/${tx2.id}`);
      assert.strictEqual(res2.status, 200);
      assert.strictEqual(res2.body.data.topupInfo.password, legacyPassword);
    } finally {
      await prisma.transaction.deleteMany({ where: { id: { in: [tx1.id, tx2.id] } } }).catch(() => {});
    }
  });
});

