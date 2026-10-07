import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import bcrypt from 'bcrypt';
import { createTestClient, TestClient, prisma } from './helpers.js';
import { env } from '../src/config/env.js';

describe('Payment Status & SePay Webhook Processing', () => {
  let webhookClient: TestClient;
  let customerClient: TestClient;
  let otherCustomerClient: TestClient;
  let adminClient: TestClient;

  const customerEmail = 'payment-cust@test.com';
  const otherCustomerEmail = 'payment-other@test.com';
  const adminEmail = 'payment-admin@test.com';
  const password = 'Password123!';

  const paymentOrderCode = `NEXATEST${Date.now()}`;
  const transferAmount = 100000;
  let transactionId: string;
  let customerUserId: string;

  before(async () => {
    webhookClient = await createTestClient();
    customerClient = await createTestClient();
    otherCustomerClient = await createTestClient();
    adminClient = await createTestClient();

    const passwordHash = await bcrypt.hash(password, 10);
    const customer = await prisma.user.upsert({
      where: { email: customerEmail },
      update: { passwordHash, role: 'CUSTOMER', status: 'ACTIVE', tokenVersion: 0 },
      create: { email: customerEmail, name: 'Pay Customer', passwordHash, role: 'CUSTOMER', status: 'ACTIVE', tokenVersion: 0 },
    });
    customerUserId = customer.id;

    await prisma.user.upsert({
      where: { email: otherCustomerEmail },
      update: { passwordHash, role: 'CUSTOMER', status: 'ACTIVE', tokenVersion: 0 },
      create: { email: otherCustomerEmail, name: 'Pay Other', passwordHash, role: 'CUSTOMER', status: 'ACTIVE', tokenVersion: 0 },
    });

    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { passwordHash, role: 'ADMIN', status: 'ACTIVE', tokenVersion: 0 },
      create: { email: adminEmail, name: 'Pay Admin', passwordHash, role: 'ADMIN', status: 'ACTIVE', tokenVersion: 0 },
    });

    // Create a pending transaction
    const tx = await prisma.transaction.create({
      data: {
        code: `TXPAY${Date.now()}`,
        userId: customerUserId,
        userEmail: customerEmail,
        packageName: '100 Gems',
        gameName: 'Pay Game',
        amount: transferAmount,
        quantity: 1,
        status: 'PENDING',
        paymentStatus: 'PENDING',
        paymentOrderCode,
      },
    });
    transactionId = tx.id;

    // Login clients
    await customerClient.post('/api/auth/login', { email: customerEmail, password });
    await otherCustomerClient.post('/api/auth/login', { email: otherCustomerEmail, password });
    await adminClient.post('/api/auth/login', { email: adminEmail, password });
  });

  after(async () => {
    await prisma.transaction.deleteMany({ where: { paymentOrderCode } }).catch(() => {});
    await prisma.user.deleteMany({
      where: { email: { in: [customerEmail, otherCustomerEmail, adminEmail] } },
    }).catch(() => {});

    await webhookClient.close();
    await customerClient.close();
    await otherCustomerClient.close();
    await adminClient.close();
  });

  it('POST /api/payments/webhook rejects missing or invalid credentials with 401', async () => {
    // Missing credentials
    const resNoAuth = await webhookClient.post('/api/payments/webhook', {
      transferType: 'in',
      transferAmount,
      content: `Thanh toan don ${paymentOrderCode}`,
    });
    assert.strictEqual(resNoAuth.status, 401);
    assert.strictEqual(resNoAuth.body.success, false);

    // Wrong credentials
    const resWrongAuth = await webhookClient.post(
      '/api/payments/webhook',
      {
        transferType: 'in',
        transferAmount,
        content: `Thanh toan don ${paymentOrderCode}`,
      },
      { headers: { authorization: 'Apikey invalid_api_key' } }
    );
    assert.strictEqual(resWrongAuth.status, 401);
  });

  it('POST /api/payments/webhook ignores transferType = out without updating status', async () => {
    const res = await webhookClient.post(
      '/api/payments/webhook',
      {
        transferType: 'out',
        transferAmount,
        content: `Thanh toan don ${paymentOrderCode}`,
      },
      { headers: { authorization: `Apikey ${env.SEPAY_API_KEY}` } }
    );
    assert.strictEqual(res.status, 200);

    const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
    assert.strictEqual(tx?.paymentStatus, 'PENDING');
  });

  it('POST /api/payments/webhook ignores mismatched transfer amount', async () => {
    const res = await webhookClient.post(
      '/api/payments/webhook',
      {
        transferType: 'in',
        transferAmount: transferAmount / 2, // Only sent half the amount
        content: `Thanh toan ${paymentOrderCode}`,
      },
      { headers: { authorization: `Apikey ${env.SEPAY_API_KEY}` } }
    );
    assert.strictEqual(res.status, 200);

    const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
    assert.strictEqual(tx?.paymentStatus, 'PENDING');
  });

  it('POST /api/payments/webhook successfully marks transaction PAID and PROCESSING on valid payment', async () => {
    const refCode = `REF${Date.now()}`;
    const res = await webhookClient.post(
      '/api/payments/webhook',
      {
        transferType: 'in',
        transferAmount,
        content: `Chuyen khoan don hang ${paymentOrderCode} thanh cong`,
        referenceCode: refCode,
        transactionDate: new Date().toISOString(),
      },
      { headers: { authorization: `Apikey ${env.SEPAY_API_KEY}` } }
    );
    assert.strictEqual(res.status, 200);

    const tx = await prisma.transaction.findUnique({ where: { id: transactionId } });
    assert.strictEqual(tx?.paymentStatus, 'PAID');
    assert.strictEqual(tx?.status, 'PROCESSING');
    assert.strictEqual(tx?.bankTransactionId, refCode);
    assert.ok(tx?.paidAt);
  });

  it('POST /api/payments/webhook duplicate referenceCode does not re-process', async () => {
    const txBefore = await prisma.transaction.findUnique({ where: { id: transactionId } });
    const paidAtBefore = txBefore?.paidAt;

    const res = await webhookClient.post(
      '/api/payments/webhook',
      {
        transferType: 'in',
        transferAmount,
        content: `Chuyen khoan don hang ${paymentOrderCode} thanh cong`,
        referenceCode: txBefore?.bankTransactionId,
        transactionDate: new Date().toISOString(),
      },
      { headers: { authorization: `Apikey ${env.SEPAY_API_KEY}` } }
    );
    assert.strictEqual(res.status, 200);

    const txAfter = await prisma.transaction.findUnique({ where: { id: transactionId } });
    assert.strictEqual(txAfter?.paidAt?.getTime(), paidAtBefore?.getTime());
  });

  it('GET /api/payments/status/:orderCode verifies ownership and access control', async () => {
    // Unauthenticated -> 401
    const unauthClient = await createTestClient();
    const unauthRes = await unauthClient.get(`/api/payments/status/${paymentOrderCode}`);
    assert.strictEqual(unauthRes.status, 401);
    await unauthClient.close();

    // Owner customer -> 200 with status
    const ownerRes = await customerClient.get(`/api/payments/status/${paymentOrderCode}`);
    assert.strictEqual(ownerRes.status, 200);
    assert.strictEqual(ownerRes.body.data.paymentStatus, 'PAID');
    assert.strictEqual(ownerRes.body.data.status, 'PROCESSING');

    // Other customer -> 404 (isolated)
    const otherRes = await otherCustomerClient.get(`/api/payments/status/${paymentOrderCode}`);
    assert.strictEqual(otherRes.status, 404);

    // Admin -> 200
    const adminRes = await adminClient.get(`/api/payments/status/${paymentOrderCode}`);
    assert.strictEqual(adminRes.status, 200);
    assert.strictEqual(adminRes.body.data.paymentStatus, 'PAID');
  });
});
