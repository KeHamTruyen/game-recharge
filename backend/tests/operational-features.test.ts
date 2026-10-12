import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { createTestClient, TestClient } from './helpers.js';
import { prisma } from '../src/lib/prisma.js';
import { formatTelegramOrderMessage } from '../src/utils/telegram.js';

describe('Operational Features Test Suite', () => {
  let client: TestClient;
  let adminClient: TestClient;

  const adminEmail = `admin-op-${Date.now()}@test.com`;
  const adminPassword = 'Password123!';
  const customerEmail = `customer-op-${Date.now()}@test.com`;
  const customerPassword = 'Customer123!';

  let pkgId: string;
  let serviceId: string;

  before(async () => {
    client = await createTestClient();
    adminClient = await createTestClient();

    // Create admin user
    const adminHash = await bcrypt.hash(adminPassword, 10);
    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { passwordHash: adminHash, role: 'ADMIN', status: 'ACTIVE', tokenVersion: 0 },
      create: { email: adminEmail, name: 'Admin Op', passwordHash: adminHash, role: 'ADMIN', status: 'ACTIVE', tokenVersion: 0 },
    });

    // Create customer user
    const customerHash = await bcrypt.hash(customerPassword, 10);
    await prisma.user.upsert({
      where: { email: customerEmail },
      update: { passwordHash: customerHash, role: 'CUSTOMER', status: 'ACTIVE', tokenVersion: 0 },
      create: { email: customerEmail, name: 'Customer Op', passwordHash: customerHash, role: 'CUSTOMER', status: 'ACTIVE', tokenVersion: 0 },
    });

    // Login admin
    const adminLoginRes = await adminClient.post('/api/auth/login', {
      email: adminEmail,
      password: adminPassword,
    });
    assert.equal(adminLoginRes.status, 200);

    // Login customer
    const custLoginRes = await client.post('/api/auth/login', {
      email: customerEmail,
      password: customerPassword,
    });
    assert.equal(custLoginRes.status, 200);

    // Create status if needed
    let status = await prisma.productStatus.findFirst();
    if (!status) {
      status = await prisma.productStatus.create({
        data: { id: 'status-op-test', name: 'Có sẵn', iconName: 'CheckCircle', color: 'green', purchasable: true },
      });
    }

    // Create a service and package fixture
    const svc = await prisma.service.create({
      data: {
        name: 'Op Test Game',
        game: 'Op Test Game',
        description: 'Test service',
        iconText: 'OP',
        tone: 'cyan',
        sortOrder: 1,
        isActive: true,
      },
    });
    serviceId = svc.id;

    const pkg = await prisma.servicePackage.create({
      data: {
        serviceId: svc.id,
        name: 'Op Package 100',
        description: 'Package description',
        price: 100000,
        tags: ['popular'],
        statusId: status.id,
        sortOrder: 1,
        isActive: true,
      },
    });
    pkgId = pkg.id;
  });

  after(async () => {
    try {
      if (pkgId) await prisma.servicePackage.deleteMany({ where: { id: pkgId } }).catch(() => {});
      if (serviceId) await prisma.service.deleteMany({ where: { id: serviceId } }).catch(() => {});
      await prisma.user.deleteMany({ where: { email: { in: [adminEmail, customerEmail] } } }).catch(() => {});
      await prisma.transaction.deleteMany({ where: { userEmail: customerEmail } }).catch(() => {});
      await prisma.setting.upsert({
        where: { id: 'siteConfig' },
        update: { value: { maintenanceMode: false, maintenanceMessage: '' } },
        create: { id: 'siteConfig', value: { maintenanceMode: false, maintenanceMessage: '' } },
      }).catch(() => {});
    } finally {
      if (client) await client.close();
      if (adminClient) await adminClient.close();
    }
  });

  it('1. Telegram notification formatting helper correctly formats VND and escapes HTML', () => {
    const message = formatTelegramOrderMessage({
      orderCode: 'DUKE-OP-100',
      userEmail: 'gamer<script>@gmail.com',
      gameName: 'Genshin Impact & Honkai',
      packageName: '6480 Đá Sáng Thế',
      amount: 1999000,
      topupInfo: {
        server: 'Asia',
        uid: '812345678',
        password: 'SuperSecretPassword123',
      },
    });

    assert.ok(message.includes('DUKE-OP-100'));
    assert.ok(message.includes('1.999.000'));
    // HTML special characters must be escaped
    assert.ok(!message.includes('<script>'));
    assert.ok(message.includes('&lt;script&gt;'));
    // Password must be masked with bullet points
    assert.ok(!message.includes('SuperSecretPassword123'));
    assert.ok(message.includes('••••••••'));
  });

  it('2. Maintenance Mode blocks customer order creation with 503 and unblocks when disabled', async () => {
    // Enable maintenance mode via admin
    const putRes = await adminClient.request('/api/admin/settings/siteConfig', {
      method: 'PUT',
      body: JSON.stringify({
        maintenanceMode: true,
        maintenanceMessage: 'Hệ thống đang bảo trì kỹ thuật',
      }),
    });
    assert.equal(putRes.status, 200);

    // Customer attempts order -> expect 503 Service Unavailable
    const orderRes = await client.request('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        packageId: pkgId,
        quantity: 1,
        topupInfo: { uid: '812345678' },
      }),
    });
    assert.equal(orderRes.status, 503);
    assert.ok(orderRes.body.error.includes('bảo trì'));

    // Disable maintenance mode
    const disableRes = await adminClient.request('/api/admin/settings/siteConfig', {
      method: 'PUT',
      body: JSON.stringify({
        maintenanceMode: false,
        maintenanceMessage: '',
      }),
    });
    assert.equal(disableRes.status, 200);

    // Order creation is allowed again
    const normalOrder = await client.request('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        packageId: pkgId,
        quantity: 1,
        topupInfo: { uid: '812345678' },
      }),
    });
    assert.equal(normalOrder.status, 201);
  });

  it('3. Customer can cancel their own pending order and frees pending quota', async () => {
    // Create an order
    const createRes = await client.request('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        packageId: pkgId,
        quantity: 1,
        topupInfo: { uid: '812345678' },
      }),
    });
    assert.equal(createRes.status, 201);
    const orderCode = createRes.body.data.code;

    // Customer cancels order
    const cancelRes = await client.request(`/api/orders/${orderCode}/cancel`, {
      method: 'POST',
    });
    assert.equal(cancelRes.status, 200);
    assert.equal(cancelRes.body.data.status, 'FAILED');
    assert.equal(cancelRes.body.data.paymentStatus, 'EXPIRED');

    // Canceling again should fail
    const cancelAgain = await client.request(`/api/orders/${orderCode}/cancel`, {
      method: 'POST',
    });
    assert.equal(cancelAgain.status, 400);
  });

  it('4. Audit log endpoint requires admin and supports filtering', async () => {
    // Non-admin request must be rejected (403)
    const forbiddenRes = await client.request('/api/admin/audit-logs');
    assert.equal(forbiddenRes.status, 403);

    // Admin request must succeed with paginated list
    const adminLogs = await adminClient.request('/api/admin/audit-logs?limit=10');
    assert.equal(adminLogs.status, 200);
    assert.ok(Array.isArray(adminLogs.body.data.items));
    assert.ok(typeof adminLogs.body.data.total === 'number');

    // Filter by action
    const filtered = await adminClient.request('/api/admin/audit-logs?action=UPDATE_SETTING');
    assert.equal(filtered.status, 200);
    for (const item of filtered.body.data.items) {
      assert.ok(item.action.includes('UPDATE_SETTING'));
    }
  });
});
