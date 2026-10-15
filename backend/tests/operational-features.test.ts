import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcrypt';
import { signToken } from '../src/middleware/auth.js';
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
    // Password is shown clearly in telegram for admin fulfillment
    assert.ok(message.includes('SuperSecretPassword123'));
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

  it('5. Anti-spam pending quota limits orders to MAX_PENDING_ORDERS and frees slot on cancel', async () => {
    // Clean up existing pending orders for this customer first
    await prisma.transaction.deleteMany({ where: { userEmail: customerEmail } });

    // Create 5 pending orders (reaching limit)
    const codes: string[] = [];
    for (let i = 0; i < 5; i++) {
      const res = await client.request('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          packageId: pkgId,
          quantity: 1,
          topupInfo: { uid: `80000000${i}` },
        }),
      });
      assert.equal(res.status, 201);
      codes.push(res.body.data.code);
    }

    // 6th order must be blocked with 400 (anti-spam quota exceeded)
    const blockedRes = await client.request('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        packageId: pkgId,
        quantity: 1,
        topupInfo: { uid: '800000099' },
      }),
    });
    assert.equal(blockedRes.status, 400);
    assert.ok(blockedRes.body.error.includes('chờ thanh toán'));

    // Cancel 1 order to free quota
    const cancelRes = await client.request(`/api/orders/${codes[0]}/cancel`, { method: 'POST' });
    assert.equal(cancelRes.status, 200);

    // Now order creation succeeds again
    const successRes = await client.request('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        packageId: pkgId,
        quantity: 1,
        topupInfo: { uid: '800000099' },
      }),
    });
    assert.equal(successRes.status, 201);
  });

  it('Transient database error in requireAuth does not clear auth cookie', async () => {
    const originalFindUnique = prisma.user.findUnique;
    try {
      (prisma.user as any).findUnique = async () => {
        const error = new Error('Database connection failed');
        error.name = 'PrismaClientInitializationError';
        throw error;
      };

      const res = await client.get('/api/auth/session');
      assert.equal(res.status, 503);
      assert.ok(res.body.error.includes('cơ sở dữ liệu'));

      // Verify Set-Cookie header did not instruct browser to delete auth_token
      assert.equal(res.headers.get('set-cookie'), null);
    } finally {
      prisma.user.findUnique = originalFindUnique;
    }

    // Verify session still works normally when DB is back up
    const healthyRes = await client.get('/api/auth/session');
    assert.equal(healthyRes.status, 200);
    assert.equal(healthyRes.body.data.user.email, customerEmail);
  });

  it('Malformed JSON returns 400 with requestId tracking', async () => {
    const res = await client.request('/api/auth/login', {
      method: 'POST',
      body: '{"invalid_json": true, broken',
      headers: { 'Content-Type': 'application/json' },
    });

    assert.equal(res.status, 400);
    assert.equal(res.body.success, false);
    assert.ok(res.body.error.includes('JSON'));
    assert.ok(typeof res.body.requestId === 'string' && res.body.requestId.length > 0);
    assert.equal(res.body.requestId, res.headers.get('x-request-id'));
  });

  it('Admin Template Validation rejects duplicate field keys, invalid regex pattern, and > 20 fields', async () => {
    // 1. Duplicate keys rejected
    const dupRes = await adminClient.post('/api/admin/topup-templates', {
      id: `tpl-dup-${Date.now()}`,
      name: 'Duplicate Keys Template',
      game: 'Test Game',
      fields: [
        { key: 'server', label: 'Server 1', type: 'text' },
        { key: 'SERVER', label: 'Server 2', type: 'text' },
      ],
    });
    assert.equal(dupRes.status, 400);
    assert.equal(dupRes.body.success, false);
    assert.ok(JSON.stringify(dupRes.body).includes('trùng'));

    // 2. Invalid regex pattern rejected
    const badRegexRes = await adminClient.post('/api/admin/topup-templates', {
      id: `tpl-regex-${Date.now()}`,
      name: 'Bad Regex Template',
      game: 'Test Game',
      fields: [
        { key: 'uid', label: 'UID', type: 'text', pattern: '[0-9+' }, // unclosed bracket
      ],
    });
    assert.equal(badRegexRes.status, 400);
    assert.equal(badRegexRes.body.success, false);
    assert.ok(JSON.stringify(badRegexRes.body).includes('không hợp lệ'));

    // 3. Exceeding 20 fields rejected
    const tooManyFields = Array.from({ length: 21 }, (_, i) => ({
      key: `field_${i}`,
      label: `Field ${i}`,
      type: 'text',
    }));
    const limitRes = await adminClient.post('/api/admin/topup-templates', {
      id: `tpl-limit-${Date.now()}`,
      name: 'Too Many Fields Template',
      game: 'Test Game',
      fields: tooManyFields,
    });
    assert.equal(limitRes.status, 400);
    assert.equal(limitRes.body.success, false);

    // 4. Valid template accepted
    const validTplId = `tpl-valid-${Date.now()}`;
    const validRes = await adminClient.post('/api/admin/topup-templates', {
      id: validTplId,
      name: 'Valid Safe Template',
      game: 'Test Game',
      fields: [
        { key: 'player_id', label: 'Player ID', type: 'text', pattern: '^[0-9]{8,10}$' },
        { key: 'server_name', label: 'Server Name', type: 'text' },
      ],
    });
    assert.equal(validRes.status, 201, JSON.stringify(validRes.body));
    assert.equal(validRes.body.success, true);
  });

  it('Manual transaction status update records the supplied reason in AuditLog', async () => {
    // 1. Pick an existing transaction to test with
    const existingTx = await prisma.transaction.findFirstOrThrow({
      select: { id: true, code: true },
    });
    const orderId = existingTx.id;

    // 2. Update status with a specific reason
    const overrideReason = 'Khách báo đã chuyển khoản qua Zalo, duyệt nạp ngay';
    const patchRes = await adminClient.patch(`/api/admin/transactions/${orderId}/status`, {
      status: 'PROCESSING',
      paymentStatus: 'PAID',
      reason: overrideReason,
    });
    assert.equal(patchRes.status, 200);
    assert.equal(patchRes.body.data.status, 'PROCESSING');
    assert.equal(patchRes.body.data.paymentStatus, 'PAID');

    // 3. Verify an AuditLog record was created with the override reason and metadata
    const auditRes = await adminClient.get('/api/admin/audit-logs?action=TRANSACTION_STATUS_UPDATE');
    assert.equal(auditRes.status, 200);
    const logs = auditRes.body.data.items;
    const matchingLog = logs.find((l: any) => l.metadata?.transactionId === orderId);
    assert.ok(matchingLog, 'Audit log entry must be created for status override');
    assert.equal(matchingLog.metadata?.reason, overrideReason);
    assert.equal(matchingLog.metadata?.newStatus, 'PROCESSING');
    assert.equal(matchingLog.metadata?.newPaymentStatus, 'PAID');

    // 4. Verify GET /api/admin/transactions returns paymentStatus
    const listRes = await adminClient.get('/api/admin/transactions');
    assert.equal(listRes.status, 200);
    const tx = listRes.body.data.items.find((item: any) => item.id === orderId);
    assert.ok(tx);
    assert.equal(tx.paymentStatus, 'PAID');
  });

  it('Payment without order code is recorded and resolvable', async () => {
    const { env } = await import('../src/config/env.js');
    const webhookHeaders = { authorization: `Apikey ${env.SEPAY_API_KEY}` };

    // 1. Send an incoming payment without an order code
    const randomRef = `REF_ANOMALY_${Date.now()}`;
    const anomalyWebhookRes = await client.post(
      '/api/payments/webhook',
      {
        id: Math.floor(Math.random() * 1000000) + 1000,
        transferType: 'in',
        accountNumber: env.SEPAY_ACCOUNT_NUMBER || '1029384756',
        transferAmount: 12345, // Arbitrary unexpected amount
        content: 'Chuyen tien khong co ma don',
        referenceCode: randomRef,
      },
      { headers: webhookHeaders }
    );
    assert.equal(anomalyWebhookRes.status, 200);

    // 2. Query admin anomalies API
    const anomaliesRes = await adminClient.get('/api/admin/payment-anomalies');
    assert.equal(anomaliesRes.status, 200);
    assert.ok(anomaliesRes.body.data.items.length > 0);
    const createdAnomaly = anomaliesRes.body.data.items.find((a: any) => a.referenceCode === randomRef);
    assert.ok(createdAnomaly, 'Anomaly must be saved to DB for admin reconciliation');
    assert.equal(createdAnomaly.anomalyType, 'NO_ORDER_CODE');
    assert.equal(createdAnomaly.resolved, false);

    // 3. Admin resolves the anomaly with a note
    const resolveRes = await adminClient.patch(`/api/admin/payment-anomalies/${createdAnomaly.id}/resolve`, {
      resolutionNote: 'Đã liên hệ khách và hoàn trả qua STK 999999',
    });
    assert.equal(resolveRes.status, 200);
    assert.equal(resolveRes.body.data.resolved, true);
    assert.equal(resolveRes.body.data.resolutionNote, 'Đã liên hệ khách và hoàn trả qua STK 999999');
  });

  it('Customer can retrieve payment details for an owned pending order', async (t) => {
    // 1. Fresh customer creates a pending order
    const freshUser = await createTestClient();
    t.after(() => freshUser.close());
    const user = await prisma.user.create({
      data: {
        email: `resume-pay-${Date.now()}@test.invalid`,
        name: 'Resume Pay User',
        passwordHash: 'unused',
      },
    });
    freshUser.cookie = `auth_token=${signToken({
      userId: user.id,
      email: user.email,
      role: 'CUSTOMER',
      tokenVersion: 0,
    })}`;

    const orderRes = await freshUser.post('/api/orders', {
      packageId: pkgId,
      quantity: 1,
      topupInfo: { uid: '99887766' },
    });
    assert.equal(orderRes.status, 201);
    const order = orderRes.body.data;
    assert.ok(order.code);

    // 2. Customer retrieves payment details to continue paying
    const payRes = await freshUser.get(`/api/orders/${order.code}/payment`);
    assert.equal(payRes.status, 200);
    assert.equal(payRes.body.data.orderCode, order.code);
    assert.ok(payRes.body.data.transferContent);
    assert.ok(payRes.body.data.qrCode);
    assert.equal(payRes.body.data.paymentStatus, 'PENDING');

    // 3. Another customer cannot access payment info for this order (403)
    const otherUser = await createTestClient();
    try {
      const otherLogin = await prisma.user.create({
        data: {
          email: `other-${Date.now()}@test.invalid`,
          name: 'Other Customer',
          passwordHash: 'unused',
        },
      });
      otherUser.cookie = `auth_token=${signToken({
        userId: otherLogin.id,
        email: otherLogin.email,
        role: 'CUSTOMER',
        tokenVersion: 0,
      })}`;
      const unauthorizedRes = await otherUser.get(`/api/orders/${order.code}/payment`);
      assert.equal(unauthorizedRes.status, 403);
    } finally {
      await otherUser.close();
    }

    // 4. GET /api/orders/mine returns paymentStatus and qrCode
    const mineRes = await freshUser.get('/api/orders/mine');
    assert.equal(mineRes.status, 200);
    const myOrder = mineRes.body.data.items.find((item: any) => item.code === order.code);
    assert.ok(myOrder);
    assert.equal(myOrder.paymentStatus, 'PENDING');

    await freshUser.close();
  });

  it('Refund flow records refundAmount, refundTxId, refundedById, refundedAt and generates AuditLog', async () => {
    // 1. Create a paid transaction to test refund flow
    const targetTx = await prisma.transaction.create({
      data: {
        code: `ORD-RF-TEST-${Date.now()}`,
        userEmail: 'test@example.com',
        packageName: 'Refund Test Pack',
        gameName: 'Genshin Impact',
        amount: 50000,
        status: 'COMPLETED',
        paymentStatus: 'PAID',
      },
    });

    // 2. Admin refunds the transaction
    const refundRes = await adminClient.patch(`/api/admin/transactions/${targetTx.id}/status`, {
      status: 'REFUNDED',
      paymentStatus: 'REFUNDED',
      refundAmount: 50000,
      refundTxId: 'BANK-REF-998877',
      refundReason: 'Khách yêu cầu hoàn tiền do nạp nhầm server',
      reason: 'Đã hoàn tiền vào STK khách',
    });
    assert.equal(refundRes.status, 200);
    const updated = refundRes.body.data;
    assert.equal(updated.status, 'REFUNDED');
    assert.equal(updated.paymentStatus, 'REFUNDED');
    assert.equal(Number(updated.refundAmount), 50000);
    assert.equal(updated.refundTxId, 'BANK-REF-998877');
    assert.equal(updated.refundReason, 'Khách yêu cầu hoàn tiền do nạp nhầm server');
    assert.ok(updated.refundedById);
    assert.ok(updated.refundedAt);

    // 3. Verify audit log entry for refund
    const auditRes = await adminClient.get('/api/admin/audit-logs?action=TRANSACTION_REFUND');
    assert.equal(auditRes.status, 200);
    const refundLog = auditRes.body.data.items.find(
      (item: any) => item.metadata?.transactionId === targetTx.id
    );
    assert.ok(refundLog, 'TRANSACTION_REFUND audit log must exist');
    assert.equal(refundLog.metadata?.refundAmount, 50000);
    assert.equal(refundLog.metadata?.refundTxId, 'BANK-REF-998877');
    assert.equal(refundLog.metadata?.refundReason, 'Khách yêu cầu hoàn tiền do nạp nhầm server');

    // 4. Verify admin list transactions returns refund fields
    const listRes = await adminClient.get('/api/admin/transactions');
    assert.equal(listRes.status, 200);
    const listedTx = listRes.body.data.items.find((item: any) => item.id === targetTx.id);
    assert.ok(listedTx);
    assert.equal(Number(listedTx.refundAmount), 50000);
    assert.equal(listedTx.refundTxId, 'BANK-REF-998877');
  });
});
