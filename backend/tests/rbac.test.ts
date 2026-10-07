import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import bcrypt from 'bcrypt';
import { createTestClient, TestClient, prisma } from './helpers.js';

describe('Role-Based Access Control (RBAC) & Data Isolation', () => {
  let guestClient: TestClient;
  let customerClient: TestClient;
  let anotherCustomerClient: TestClient;
  let adminClient: TestClient;

  const adminEmail = 'admin-rbac@test.com';
  const customerEmail = 'customer-rbac@test.com';
  const anotherCustomerEmail = 'customer-rbac-2@test.com';
  const password = 'Password123!';

  let testServiceId: string;
  let testPackageId: string;
  let customerOrderCode: string;

  before(async () => {
    guestClient = await createTestClient();
    customerClient = await createTestClient();
    anotherCustomerClient = await createTestClient();
    adminClient = await createTestClient();

    const passwordHash = await bcrypt.hash(password, 10);

    // Setup Admin user
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { passwordHash, role: 'ADMIN', status: 'ACTIVE', tokenVersion: 0 },
      create: { email: adminEmail, name: 'Admin RBAC', passwordHash, role: 'ADMIN', status: 'ACTIVE', tokenVersion: 0 },
    });

    // Setup Customer 1
    const customer = await prisma.user.upsert({
      where: { email: customerEmail },
      update: { passwordHash, role: 'CUSTOMER', status: 'ACTIVE', tokenVersion: 0 },
      create: { email: customerEmail, name: 'Customer RBAC 1', passwordHash, role: 'CUSTOMER', status: 'ACTIVE', tokenVersion: 0 },
    });

    // Setup Customer 2
    await prisma.user.upsert({
      where: { email: anotherCustomerEmail },
      update: { passwordHash, role: 'CUSTOMER', status: 'ACTIVE', tokenVersion: 0 },
      create: { email: anotherCustomerEmail, name: 'Customer RBAC 2', passwordHash, role: 'CUSTOMER', status: 'ACTIVE', tokenVersion: 0 },
    });

    // Ensure at least one active product status and service package exists
    let status = await prisma.productStatus.findFirst({ where: { purchasable: true } });
    if (!status) {
      status = await prisma.productStatus.create({
        data: { id: 'status-test-purchasable', name: 'Có sẵn', iconName: 'CheckCircle', color: 'green', purchasable: true },
      });
    }

    const service = await prisma.service.create({
      data: {
        name: 'RBAC Test Game',
        game: 'RBAC Test Game',
        description: 'Testing RBAC',
        iconText: 'RB',
        tone: 'cyan',
        isActive: true,
      },
    });
    testServiceId = service.id;

    const pkg = await prisma.servicePackage.create({
      data: {
        serviceId: testServiceId,
        name: 'RBAC 100 Gems',
        price: 50000,
        statusId: status.id,
        isActive: true,
      },
    });
    testPackageId = pkg.id;

    // Login users
    await adminClient.post('/api/auth/login', { email: adminEmail, password });
    await customerClient.post('/api/auth/login', { email: customerEmail, password });
    await anotherCustomerClient.post('/api/auth/login', { email: anotherCustomerEmail, password });

    // Customer 1 creates an order
    const orderRes = await customerClient.post('/api/orders', {
      packageId: testPackageId,
      quantity: 1,
      topupInfo: {},
    });
    assert.strictEqual(orderRes.status, 201);
    customerOrderCode = orderRes.body.data.code;
  });

  after(async () => {
    // Cleanup created test records
    await prisma.transaction.deleteMany({ where: { code: customerOrderCode } }).catch(() => {});
    if (testPackageId) {
      await prisma.servicePackage.deleteMany({ where: { id: testPackageId } }).catch(() => {});
    }
    if (testServiceId) {
      await prisma.service.deleteMany({ where: { id: testServiceId } }).catch(() => {});
    }
    await prisma.user.deleteMany({
      where: { email: { in: [adminEmail, customerEmail, anotherCustomerEmail] } },
    }).catch(() => {});

    await guestClient.close();
    await customerClient.close();
    await anotherCustomerClient.close();
    await adminClient.close();
  });

  it('Unauthenticated requests to admin routes should return 401', async () => {
    const endpoints = [
      '/api/admin/services',
      '/api/admin/transactions',
      '/api/admin/users',
      '/api/admin/settings/siteConfig',
    ];

    for (const ep of endpoints) {
      const res = await guestClient.get(ep);
      assert.strictEqual(res.status, 401, `Expected 401 for ${ep}`);
      assert.strictEqual(res.body.success, false);
    }
  });

  it('Unauthenticated requests to order creation should return 401', async () => {
    const resCreate = await guestClient.post('/api/orders', {
      packageId: testPackageId,
      quantity: 1,
    });
    assert.strictEqual(resCreate.status, 401);

    const resCheckout = await guestClient.post('/api/orders/checkout', {
      items: [{ packageId: testPackageId, quantity: 1 }],
    });
    assert.strictEqual(resCheckout.status, 401);
  });

  it('Customer requests to admin endpoints must return 403 Forbidden', async () => {
    const endpoints = [
      '/api/admin/services',
      '/api/admin/transactions',
      '/api/admin/users',
      '/api/admin/settings/siteConfig',
    ];

    for (const ep of endpoints) {
      const res = await customerClient.get(ep);
      assert.strictEqual(res.status, 403, `Customer should be forbidden (403) from ${ep}`);
      assert.strictEqual(res.body.success, false);
    }
  });

  it('Customer attempting admin mutations must return 403 and make no changes', async () => {
    const postRes = await customerClient.post('/api/admin/services', {
      name: 'Hacked Service',
      game: 'Hacked Service',
    });
    assert.strictEqual(postRes.status, 403);

    const patchRes = await customerClient.patch(`/api/admin/transactions/${customerOrderCode}/status`, {
      status: 'COMPLETED',
    });
    assert.strictEqual(patchRes.status, 403);
  });

  it('Admin requests to admin endpoints should return 200', async () => {
    const endpoints = [
      '/api/admin/services',
      '/api/admin/transactions',
      '/api/admin/users',
      '/api/admin/settings/siteConfig',
    ];

    for (const ep of endpoints) {
      const res = await adminClient.get(ep);
      assert.strictEqual(res.status, 200, `Admin should have access (200) to ${ep}`);
      assert.strictEqual(res.body.success, true);
    }
  });

  it('Data isolation: Customer cannot view another customer order by code', async () => {
    // Another customer attempts to view Customer 1's order
    const resForbidden = await anotherCustomerClient.get(`/api/orders/${customerOrderCode}`);
    assert.strictEqual(resForbidden.status, 403);
    assert.strictEqual(resForbidden.body.success, false);

    // Customer 1 can view their own order
    const resOwner = await customerClient.get(`/api/orders/${customerOrderCode}`);
    assert.strictEqual(resOwner.status, 200);
    assert.strictEqual(resOwner.body.data.code, customerOrderCode);

    // Admin can view Customer 1's order
    const resAdmin = await adminClient.get(`/api/orders/${customerOrderCode}`);
    assert.strictEqual(resAdmin.status, 200);
    assert.strictEqual(resAdmin.body.data.code, customerOrderCode);
  });
});
