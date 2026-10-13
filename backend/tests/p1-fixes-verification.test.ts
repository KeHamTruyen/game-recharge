import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTestClient, prisma, TestClient } from './helpers.js';
import { signToken } from '../src/middleware/auth.js';
import { env } from '../src/config/env.js';

describe('P1 Fixes Verification: A02 (Refund Rules), A03 (Payment Group), A04 (Numeric Secrets)', () => {
  let customer: TestClient;
  let admin: TestClient;
  let customerUser: { id: string; email: string };
  let adminUser: { id: string; email: string };
  let testServiceId: string;
  let testPackageId: string;

  before(async () => {
    [customer, admin] = await Promise.all([createTestClient(), createTestClient()]);

    customerUser = await prisma.user.create({
      data: {
        email: `cust-${randomUUID()}@test.invalid`,
        name: 'P1 Customer',
        passwordHash: 'unused',
        role: 'CUSTOMER',
        totalSpent: 0,
      },
    });
    customer.cookie = `auth_token=${signToken({
      userId: customerUser.id,
      email: customerUser.email,
      role: 'CUSTOMER',
      tokenVersion: 0,
    })}`;

    adminUser = await prisma.user.create({
      data: {
        email: `adm-${randomUUID()}@test.invalid`,
        name: 'P1 Admin',
        passwordHash: 'unused',
        role: 'ADMIN',
      },
    });
    admin.cookie = `auth_token=${signToken({
      userId: adminUser.id,
      email: adminUser.email,
      role: 'ADMIN',
      tokenVersion: 0,
    })}`;

    const service = await prisma.service.create({
      data: {
        name: `Service-${randomUUID().slice(0, 8)}`,
        game: 'Genshin Impact',
        isActive: true,
      },
    });
    testServiceId = service.id;

    const pkg = await prisma.servicePackage.create({
      data: {
        serviceId: testServiceId,
        name: 'Package 100K',
        price: 100000,
        isActive: true,
      },
    });
    testPackageId = pkg.id;
  });

  after(async () => {
    await Promise.all([customer.close(), admin.close()]);
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // A02 — Hoàn tiền bảo đảm điều kiện nghiệp vụ
  // ─────────────────────────────────────────────────────────────────────────────
  describe('A02: Refund business validation rules', () => {
    it('rejects refund when order is not paid (PENDING / UNPAID)', async () => {
      const order = await prisma.transaction.create({
        data: {
          code: `ORD-${randomUUID().slice(0, 8)}`,
          userId: customerUser.id,
          userEmail: customerUser.email,
          packageName: 'Pkg',
          gameName: 'Game',
          amount: 50000,
          status: 'PENDING',
          paymentStatus: 'PENDING',
        },
      });

      const res = await admin.patch(`/api/admin/transactions/${order.id}/status`, {
        status: 'REFUNDED',
        refundAmount: 50000,
        refundReason: 'Khách muốn hủy',
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /đã thanh toán thành công/i);
    });

    it('rejects refund with non-integer refundAmount (e.g. 20000.5)', async () => {
      const order = await prisma.transaction.create({
        data: {
          code: `ORD-${randomUUID().slice(0, 8)}`,
          userId: customerUser.id,
          userEmail: customerUser.email,
          packageName: 'Pkg',
          gameName: 'Game',
          amount: 50000,
          status: 'COMPLETED',
          paymentStatus: 'PAID',
        },
      });

      const res = await admin.patch(`/api/admin/transactions/${order.id}/status`, {
        status: 'REFUNDED',
        refundAmount: 20000.5,
        refundReason: 'Hoàn tiền lẻ',
      });
      assert.equal(res.status, 400);
      assert.match(JSON.stringify(res.body), /nguyên/i);
    });

    it('rejects refund with refundAmount exceeding order amount', async () => {
      const order = await prisma.transaction.create({
        data: {
          code: `ORD-${randomUUID().slice(0, 8)}`,
          userId: customerUser.id,
          userEmail: customerUser.email,
          packageName: 'Pkg',
          gameName: 'Game',
          amount: 50000,
          status: 'COMPLETED',
          paymentStatus: 'PAID',
        },
      });

      const res = await admin.patch(`/api/admin/transactions/${order.id}/status`, {
        status: 'REFUNDED',
        refundAmount: 60000,
        refundReason: 'Hoàn thừa tiền',
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /vượt quá/i);
    });

    it('rejects refund with empty or whitespace-only refundReason', async () => {
      const order = await prisma.transaction.create({
        data: {
          code: `ORD-${randomUUID().slice(0, 8)}`,
          userId: customerUser.id,
          userEmail: customerUser.email,
          packageName: 'Pkg',
          gameName: 'Game',
          amount: 50000,
          status: 'COMPLETED',
          paymentStatus: 'PAID',
        },
      });

      const res = await admin.patch(`/api/admin/transactions/${order.id}/status`, {
        status: 'REFUNDED',
        refundAmount: 50000,
        refundReason: '   ',
      });
      assert.equal(res.status, 400);
      assert.match(res.body.error, /lý do/i);
    });

    it('successfully processes valid refund on paid order and decrements user totalSpent', async () => {
      // First, simulate user having totalSpent = 100000 from this order
      await prisma.user.update({
        where: { id: customerUser.id },
        data: { totalSpent: 100000 },
      });

      const order = await prisma.transaction.create({
        data: {
          code: `ORD-${randomUUID().slice(0, 8)}`,
          userId: customerUser.id,
          userEmail: customerUser.email,
          packageName: 'Pkg',
          gameName: 'Game',
          amount: 100000,
          status: 'COMPLETED',
          paymentStatus: 'PAID',
        },
      });

      const res = await admin.patch(`/api/admin/transactions/${order.id}/status`, {
        status: 'REFUNDED',
        refundAmount: 100000,
        refundTxId: 'SEPAY-RF-123456',
        refundReason: 'Khách hàng yêu cầu hoàn tiền qua STK VCB',
      });
      assert.equal(res.status, 200);
      assert.equal(res.body.data.status, 'REFUNDED');
      assert.equal(res.body.data.paymentStatus, 'REFUNDED');
      assert.equal(Number(res.body.data.refundAmount), 100000);
      assert.equal(res.body.data.refundTxId, 'SEPAY-RF-123456');
      assert.equal(res.body.data.refundReason, 'Khách hàng yêu cầu hoàn tiền qua STK VCB');

      // Check totalSpent was decremented back to 0
      const updatedUser = await prisma.user.findUniqueOrThrow({ where: { id: customerUser.id } });
      assert.equal(Number(updatedUser.totalSpent), 0);

      // Check repeated refund is rejected
      const repeated = await admin.patch(`/api/admin/transactions/${order.id}/status`, {
        status: 'REFUNDED',
        refundAmount: 100000,
        refundReason: 'Hoàn lại lần nữa',
      });
      assert.equal(repeated.status, 400);
      assert.match(repeated.body.error, /đã được ghi nhận hoàn tiền/i);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // A03 — Mở lại thanh toán hiển thị đúng tổng tiền & chặn đơn hết hạn
  // ─────────────────────────────────────────────────────────────────────────────
  describe('A03: Resume Payment calculation and status checks', () => {
    it('returns total checkout group amount for multi-item checkout group', async () => {
      const paymentOrderCode = `DUKEGRP${randomUUID().slice(0, 8).toUpperCase()}`;
      const line1 = await prisma.transaction.create({
        data: {
          code: `ORD1-${randomUUID().slice(0, 8)}`,
          paymentOrderCode,
          userId: customerUser.id,
          userEmail: customerUser.email,
          packageName: 'Item 1',
          gameName: 'Game',
          amount: 10000,
          status: 'PENDING',
          paymentStatus: 'PENDING',
        },
      });
      await prisma.transaction.create({
        data: {
          code: `ORD2-${randomUUID().slice(0, 8)}`,
          paymentOrderCode,
          userId: customerUser.id,
          userEmail: customerUser.email,
          packageName: 'Item 2',
          gameName: 'Game',
          amount: 25000,
          status: 'PENDING',
          paymentStatus: 'PENDING',
        },
      });

      const res = await customer.get(`/api/orders/${line1.code}/payment`);
      assert.equal(res.status, 200);
      // Group total is 10,000 + 25,000 = 35,000
      assert.equal(res.body.data.amount, 35000);
      assert.equal(res.body.data.paymentOrderCode, paymentOrderCode);
      assert.match(res.body.data.qrCode, /amount=35000/);
      assert.match(res.body.data.qrCode, new RegExp(`des=${paymentOrderCode}`));
    });

    it('rejects resuming payment for cancelled or expired orders', async () => {
      const order = await prisma.transaction.create({
        data: {
          code: `ORD-EXP-${randomUUID().slice(0, 8)}`,
          userId: customerUser.id,
          userEmail: customerUser.email,
          packageName: 'Pkg',
          gameName: 'Game',
          amount: 20000,
          status: 'FAILED',
          paymentStatus: 'EXPIRED',
        },
      });

      const res = await customer.get(`/api/orders/${order.code}/payment`);
      assert.equal(res.status, 400);
      assert.match(res.body.error, /hủy hoặc hết hạn/i);
    });

    it('rejects resuming payment for refunded orders', async () => {
      const order = await prisma.transaction.create({
        data: {
          code: `ORD-RF-${randomUUID().slice(0, 8)}`,
          userId: customerUser.id,
          userEmail: customerUser.email,
          packageName: 'Pkg',
          gameName: 'Game',
          amount: 20000,
          status: 'REFUNDED',
          paymentStatus: 'REFUNDED',
        },
      });

      const res = await customer.get(`/api/orders/${order.code}/payment`);
      assert.equal(res.status, 400);
      assert.match(res.body.error, /hoàn tiền/i);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // A04 — Mật khẩu dạng số được mã hóa an toàn trong database
  // ─────────────────────────────────────────────────────────────────────────────
  describe('A04: Encryption of sensitive topup fields with numeric values', () => {
    it('encrypts numeric passwords in database and masks them for customers', async () => {
      const res = await customer.post('/api/orders', {
        packageId: testPackageId,
        quantity: 1,
        topupInfo: {
          uid: '987654321',
          password: 123456, // Numeric password
        },
      });
      assert.equal(res.status, 201);
      const orderCode = res.body.data.code;

      // Check database record directly
      const rawInDb = await prisma.transaction.findUniqueOrThrow({
        where: { code: orderCode },
      });
      const topup = rawInDb.topupInfo as Record<string, unknown>;
      assert.equal(typeof topup.password, 'string');
      assert.ok(
        String(topup.password).startsWith('enc:'),
        'Numeric password must be encrypted with enc: prefix in DB',
      );
      assert.notEqual(topup.password, 123456);
      assert.notEqual(topup.password, '123456');

      // Customer reads order -> masked
      const custView = await customer.get(`/api/orders/${orderCode}`);
      assert.equal(custView.status, 200);
      assert.equal(custView.body.data.topupInfo.password, '••••••••');

      // Admin reads order -> decrypted to original value
      const adminView = await admin.get(`/api/admin/transactions/${rawInDb.id}`);
      assert.equal(adminView.status, 200);
      assert.equal(adminView.body.data.topupInfo.password, '123456');
    });
  });
});

