import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTestClient, prisma, TestClient } from './helpers.js';
import { signToken } from '../src/middleware/auth.js';
import { safeRegexTest } from '../src/utils/regex.js';

describe('P2 Fixes Verification: A08 (Template Validation & ReDoS Protection), A09 (Pending Order Quota)', () => {
  let customer: TestClient;
  let admin: TestClient;
  let customerUser: { id: string; email: string };
  let adminUser: { id: string; email: string };
  let testServiceId: string;
  let testPackageId: string;
  let safeTemplateId: string;

  before(async () => {
    [customer, admin] = await Promise.all([createTestClient(), createTestClient()]);

    customerUser = await prisma.user.create({
      data: {
        email: `cust-p2-${randomUUID()}@test.invalid`,
        name: 'P2 Customer',
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
        email: `adm-p2-${randomUUID()}@test.invalid`,
        name: 'P2 Admin',
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
        name: `Service-P2-${randomUUID().slice(0, 8)}`,
        game: 'Genshin Impact',
        isActive: true,
      },
    });
    testServiceId = service.id;

    // Create safe template with a pattern
    safeTemplateId = `tmpl-safe-${randomUUID().slice(0, 8)}`;
    await prisma.topupTemplate.create({
      data: {
        id: safeTemplateId,
        name: 'Safe Template 9-digit UID',
        game: 'Genshin Impact',
        fields: [
          {
            key: 'uid',
            label: 'UID',
            type: 'text',
            required: true,
            pattern: '^[0-9]{9}$',
          },
        ],
      },
    });

    const pkg = await prisma.servicePackage.create({
      data: {
        serviceId: testServiceId,
        name: 'Package 50K',
        price: 50000,
        isActive: true,
        templateId: safeTemplateId,
      },
    });
    testPackageId = pkg.id;
  });

  after(async () => {
    await prisma.checkoutRequest.deleteMany({ where: { userId: customerUser.id } }).catch(() => {});
    await prisma.transaction.deleteMany({ where: { userId: customerUser.id } }).catch(() => {});
    await prisma.servicePackage.deleteMany({ where: { serviceId: testServiceId } }).catch(() => {});
    await prisma.service.deleteMany({ where: { id: testServiceId } }).catch(() => {});
    await prisma.topupTemplate.deleteMany({ where: { id: safeTemplateId } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: [customerUser.id, adminUser.id] } } }).catch(() => {});
    await Promise.all([customer.close(), admin.close()]);
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // A08: TEMPLATE VALIDATION & REDOS PROTECTION
  // ══════════════════════════════════════════════════════════════════════════════
  describe('A08: Template validation synchronization and ReDoS safety', () => {
    it('1. Rejects template field key longer than 50 characters', async () => {
      const longKey = 'a'.repeat(51); // 51 chars exceeds max 50
      const res = await admin.request('/api/admin/topup-templates', {
        method: 'POST',
        body: JSON.stringify({
          id: `tmpl-${randomUUID().slice(0, 8)}`,
          name: 'Invalid Long Key Template',
          game: 'Test Game',
          fields: [
            {
              key: longKey,
              label: 'Long Key Field',
              type: 'text',
              required: true,
            },
          ],
        }),
      });

      assert.equal(res.status, 400);
      assert.ok(res.body.error);
    });

    it('2. Accepts template field key with exactly 50 characters', async () => {
      const valid50Key = 'k'.repeat(50);
      const templateId = `tmpl-${randomUUID().slice(0, 8)}`;
      const res = await admin.request('/api/admin/topup-templates', {
        method: 'POST',
        body: JSON.stringify({
          id: templateId,
          name: 'Valid 50 Key Template',
          game: 'Test Game',
          fields: [
            {
              key: valid50Key,
              label: 'Exact 50 Key Field',
              type: 'text',
              required: true,
            },
          ],
        }),
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      await prisma.topupTemplate.delete({ where: { id: templateId } }).catch(() => {});
    });

    it('3. Rejects invalid field type', async () => {
      const res = await admin.request('/api/admin/topup-templates', {
        method: 'POST',
        body: JSON.stringify({
          id: `tmpl-${randomUUID().slice(0, 8)}`,
          name: 'Invalid Type Template',
          game: 'Test Game',
          fields: [
            {
              key: 'role',
              label: 'Role',
              type: 'unsupported_type_xyz',
              required: true,
            },
          ],
        }),
      });

      assert.equal(res.status, 400);
    });

    it('4. Rejects select field with empty options array', async () => {
      const res = await admin.request('/api/admin/topup-templates', {
        method: 'POST',
        body: JSON.stringify({
          id: `tmpl-${randomUUID().slice(0, 8)}`,
          name: 'Select With No Options Template',
          game: 'Test Game',
          fields: [
            {
              key: 'server',
              label: 'Server',
              type: 'select',
              options: [],
              required: true,
            },
          ],
        }),
      });

      assert.equal(res.status, 400);
      const errStr4 = JSON.stringify(res.body);
      assert.ok(errStr4.includes('select') || errStr4.includes('options'));
    });

    it('5. Rejects catastrophic ReDoS regex pattern (^(a+)+$)', async () => {
      const res = await admin.request('/api/admin/topup-templates', {
        method: 'POST',
        body: JSON.stringify({
          id: `tmpl-${randomUUID().slice(0, 8)}`,
          name: 'Evil ReDoS Template',
          game: 'Test Game',
          fields: [
            {
              key: 'evil',
              label: 'Evil',
              type: 'text',
              pattern: '^(a+)+$',
              required: true,
            },
          ],
        }),
      });

      assert.equal(res.status, 400);
      const errStr5 = JSON.stringify(res.body);
      assert.ok(errStr5.includes('ReDoS') || errStr5.includes('nguy cơ'));
    });

    it('6. Rejects nested wildcard repetition (.*.*)', async () => {
      const res = await admin.request('/api/admin/topup-templates', {
        method: 'POST',
        body: JSON.stringify({
          id: `tmpl-${randomUUID().slice(0, 8)}`,
          name: 'Wildcard ReDoS Template',
          game: 'Test Game',
          fields: [
            {
              key: 'wild',
              label: 'Wild',
              type: 'text',
              pattern: '.*.*',
              required: true,
            },
          ],
        }),
      });

      assert.equal(res.status, 400);
      const errStr6 = JSON.stringify(res.body);
      assert.ok(errStr6.includes('ReDoS') || errStr6.includes('nguy cơ'));
    });

    it('7. Accepts valid standard patterns (^[0-9]{9}$ and ^.+#.+)', async () => {
      const templateId = `tmpl-${randomUUID().slice(0, 8)}`;
      const res = await admin.request('/api/admin/topup-templates', {
        method: 'POST',
        body: JSON.stringify({
          id: templateId,
          name: 'Valid Safe Patterns Template',
          game: 'Test Game',
          fields: [
            {
              key: 'uid',
              label: 'UID',
              type: 'text',
              pattern: '^[0-9]{9}$',
              required: true,
            },
            {
              key: 'riotId',
              label: 'Riot ID',
              type: 'text',
              pattern: '^.+#.+$',
              required: true,
            },
          ],
        }),
      });

      assert.equal(res.status, 201);
      assert.equal(res.body.success, true);
      await prisma.topupTemplate.delete({ where: { id: templateId } }).catch(() => {});
    });

    it('8. Evaluates pattern safely in order creation and handles adversarial inputs without hanging', async () => {
      // Valid input matching pattern '^[0-9]{9}$'
      const validRes = await customer.request('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          packageId: testPackageId,
          quantity: 1,
          topupInfo: { uid: '812345678' },
        }),
      });
      assert.equal(validRes.status, 201);

      // Invalid input not matching pattern
      const invalidRes = await customer.request('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          packageId: testPackageId,
          quantity: 1,
          topupInfo: { uid: 'not_a_valid_uid' },
        }),
      });
      assert.equal(invalidRes.status, 400);
      assert.ok(invalidRes.body.error.includes('Invalid value'));

      // Test safeRegexTest directly with adversarial string on evil pattern
      const startTime = Date.now();
      const matchResult = safeRegexTest('^(a+)+$', 'a'.repeat(30) + '!');
      const duration = Date.now() - startTime;

      assert.equal(matchResult, false);
      assert.ok(duration < 200, `Execution should finish within 200ms, took ${duration}ms`);
    });
  });

  // ══════════════════════════════════════════════════════════════════════════════
  // A09: PENDING ORDER QUOTA ENFORCEMENT
  // ══════════════════════════════════════════════════════════════════════════════
  describe('A09: Multi-line checkout and concurrency pending order quota', () => {
    let quotaUser: { id: string; email: string };
    let quotaClient: TestClient;

    before(async () => {
      quotaClient = await createTestClient();
      quotaUser = await prisma.user.create({
        data: {
          email: `quota-${randomUUID()}@test.invalid`,
          name: 'Quota Customer',
          passwordHash: 'unused',
          role: 'CUSTOMER',
          totalSpent: 0,
        },
      });
      quotaClient.cookie = `auth_token=${signToken({
        userId: quotaUser.id,
        email: quotaUser.email,
        role: 'CUSTOMER',
        tokenVersion: 0,
      })}`;
    });

    after(async () => {
      await prisma.checkoutRequest.deleteMany({ where: { userId: quotaUser.id } }).catch(() => {});
      await prisma.transaction.deleteMany({ where: { userId: quotaUser.id } }).catch(() => {});
      await prisma.user.deleteMany({ where: { id: quotaUser.id } }).catch(() => {});
      await quotaClient.close();
    });

    it('1. Blocks single checkout request whose line count exceeds MAX_PENDING_ORDERS (e.g. 6 items when quota is 5)', async () => {
      // 6 items in one checkout when default quota is 5
      const items = Array.from({ length: 6 }, () => ({
        packageId: testPackageId,
        quantity: 1,
      }));

      const res = await quotaClient.request('/api/orders/checkout', {
        method: 'POST',
        headers: { 'Idempotency-Key': randomUUID() },
        body: JSON.stringify({
          items,
          topupInfo: { uid: '800000001' },
        }),
      });

      assert.equal(res.status, 400);
      assert.ok(res.body.error.includes('chờ thanh toán'));

      // Verify no pending orders were created in database
      const count = await prisma.transaction.count({
        where: { userId: quotaUser.id, status: 'PENDING' },
      });
      assert.equal(count, 0);
    });

    it('2. Blocks checkout when existing pending orders + incoming items exceed quota (3 existing + 3 incoming = 6 > 5)', async () => {
      // Create 3 pending orders first
      for (let i = 0; i < 3; i++) {
        const singleRes = await quotaClient.request('/api/orders', {
          method: 'POST',
          body: JSON.stringify({
            packageId: testPackageId,
            quantity: 1,
            topupInfo: { uid: `80000000${i}` },
          }),
        });
        assert.equal(singleRes.status, 201);
      }

      const existingCount = await prisma.transaction.count({
        where: { userId: quotaUser.id, status: 'PENDING' },
      });
      assert.equal(existingCount, 3);

      // Try checking out 3 more items: 3 + 3 = 6 > 5
      const res = await quotaClient.request('/api/orders/checkout', {
        method: 'POST',
        headers: { 'Idempotency-Key': randomUUID() },
        body: JSON.stringify({
          items: Array.from({ length: 3 }, () => ({ packageId: testPackageId, quantity: 1 })),
          topupInfo: { uid: '800000001' },
        }),
      });

      assert.equal(res.status, 400);
      assert.ok(res.body.error.includes('chờ thanh toán'));

      // Total pending orders remains 3
      const countAfter = await prisma.transaction.count({
        where: { userId: quotaUser.id, status: 'PENDING' },
      });
      assert.equal(countAfter, 3);
    });

    it('3. Serializes concurrent checkouts with different idempotency keys so total never breaches quota', async () => {
      // Currently has 3 pending orders.
      // Launch 2 concurrent single order requests simultaneously.
      // Only 2 slots remain (3 + 2 = 5). One request should succeed, the other should fail when 5 is reached.
      const [res1, res2, res3] = await Promise.all([
        quotaClient.request('/api/orders', {
          method: 'POST',
          body: JSON.stringify({ packageId: testPackageId, quantity: 1, topupInfo: { uid: '800000011' } }),
        }),
        quotaClient.request('/api/orders', {
          method: 'POST',
          body: JSON.stringify({ packageId: testPackageId, quantity: 1, topupInfo: { uid: '800000012' } }),
        }),
        quotaClient.request('/api/orders', {
          method: 'POST',
          body: JSON.stringify({ packageId: testPackageId, quantity: 1, topupInfo: { uid: '800000013' } }),
        }),
      ]);

      const statuses = [res1.status, res2.status, res3.status];
      const successCount = statuses.filter((s) => s === 201).length;
      const blockedCount = statuses.filter((s) => s === 400).length;

      // Exactly 2 succeeded (reaching cap 5) and 1 blocked (exceeding cap 5)
      assert.equal(successCount, 2);
      assert.equal(blockedCount, 1);

      const totalPending = await prisma.transaction.count({
        where: { userId: quotaUser.id, status: 'PENDING' },
      });
      assert.equal(totalPending, 5);
    });

    it('4. Cancelling a pending order releases quota slot allowing new order', async () => {
      // Find one of the pending orders
      const orderToCancel = await prisma.transaction.findFirst({
        where: { userId: quotaUser.id, status: 'PENDING' },
        select: { code: true },
      });
      assert.ok(orderToCancel);

      // Cancel the order
      const cancelRes = await quotaClient.request(`/api/orders/${orderToCancel.code}/cancel`, {
        method: 'POST',
      });
      assert.equal(cancelRes.status, 200);

      // Pending count is now 4
      const countAfterCancel = await prisma.transaction.count({
        where: { userId: quotaUser.id, status: 'PENDING', paymentStatus: { in: ['UNPAID', 'PENDING'] } },
      });
      assert.equal(countAfterCancel, 4);

      // Now creating 1 new order succeeds
      const newOrderRes = await quotaClient.request('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          packageId: testPackageId,
          quantity: 1,
          topupInfo: { uid: '800000099' },
        }),
      });
      assert.equal(newOrderRes.status, 201);
    });
  });

  describe('A11: Backup & Restore Script Validation', () => {
    it('1. Rejects BACKUP_KEEP_DAYS < 1 (0 or negative) before starting backup', async () => {
      const { spawnSync } = await import('node:child_process');
      const res = spawnSync(process.execPath, ['scripts/backup.mjs'], {
        env: { ...process.env, BACKUP_KEEP_DAYS: '0' },
        encoding: 'utf-8',
      });
      assert.equal(res.status, 1);
      assert.ok(res.stderr.includes('BACKUP_KEEP_DAYS không hợp lệ') || res.stdout.includes('BACKUP_KEEP_DAYS không hợp lệ'));
    });

    it('2. Rejects BACKUP_KEEP_DAYS non-integer string before starting backup', async () => {
      const { spawnSync } = await import('node:child_process');
      const res = spawnSync(process.execPath, ['scripts/backup.mjs'], {
        env: { ...process.env, BACKUP_KEEP_DAYS: 'invalid-days' },
        encoding: 'utf-8',
      });
      assert.equal(res.status, 1);
      assert.ok(res.stderr.includes('BACKUP_KEEP_DAYS không hợp lệ') || res.stdout.includes('BACKUP_KEEP_DAYS không hợp lệ'));
    });

    it('3. Rejects restore of non-existent backup file', async () => {
      const { spawnSync } = await import('node:child_process');
      const res = spawnSync(process.execPath, ['scripts/restore.mjs', 'non_existent_file.dump'], {
        env: { ...process.env },
        encoding: 'utf-8',
      });
      assert.equal(res.status, 1);
      assert.ok(res.stderr.includes('không tồn tại') || res.stdout.includes('không tồn tại'));
    });

    it('4. Rejects restore of empty (0-byte) backup file', async () => {
      const { spawnSync } = await import('node:child_process');
      const { writeFileSync, unlinkSync } = await import('node:fs');
      const emptyFile = 'temp_empty_backup.dump';
      writeFileSync(emptyFile, '');
      try {
        const res = spawnSync(process.execPath, ['scripts/restore.mjs', emptyFile], {
          env: { ...process.env },
          encoding: 'utf-8',
        });
        assert.equal(res.status, 1);
        assert.ok(res.stderr.includes('bị rỗng') || res.stdout.includes('bị rỗng'));
      } finally {
        unlinkSync(emptyFile);
      }
    });
  });

  describe('A12: Wiki Tombstone Public Data Sanitization', () => {
    let teamKey: string;

    before(async () => {
      // Create a team entry then soft-delete it
      const id = 888777;
      teamKey = `team:${id}`;
      await prisma.wikiEntry.upsert({
        where: { key: teamKey },
        create: {
          key: teamKey,
          kind: 'team',
          authorId: customerUser.id,
          deleted: true,
          data: {
            title: 'Sensitive Leaked Team Title',
            description: 'Private community description that must not leak',
            aniimo_ids: [1, 2, 3, 4],
          },
        },
        update: {
          deleted: true,
          data: {
            title: 'Sensitive Leaked Team Title',
            description: 'Private community description that must not leak',
          },
        },
      });
    });

    after(async () => {
      await prisma.wikiEntry.deleteMany({ where: { key: teamKey } });
    });

    it('1. GET /api/wiki strips deleted community payload and authorId', async () => {
      const res = await customer.request('/api/wiki');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      const tombstone = res.body.data.entries.find((e: any) => e.key === teamKey);
      assert.ok(tombstone, 'Tombstone entry should be returned');
      assert.equal(tombstone.deleted, true);
      assert.equal(tombstone.authorId, null);
      assert.deepEqual(tombstone.data, {});
      assert.equal(JSON.stringify(tombstone).includes('Sensitive Leaked Team Title'), false);
    });
  });

  describe('A13: Admin Transactions & Users Server-side Pagination & Aggregates', () => {
    it('1. GET /api/admin/transactions returns paginated slice and DB aggregate stats', async () => {
      const res = await admin.request('/api/admin/transactions?page=1&limit=2');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.items));
      assert.ok(res.body.data.items.length <= 2);
      assert.equal(res.body.data.page, 1);
      assert.equal(res.body.data.limit, 2);
      assert.ok(typeof res.body.data.total === 'number');
      assert.ok(res.body.data.stats, 'Response should include database aggregate stats');
      assert.ok(typeof res.body.data.stats.totalRevenue === 'number');
      assert.ok(typeof res.body.data.stats.totalCompleted === 'number');
    });

    it('2. GET /api/admin/users returns paginated slice without fetching all pages', async () => {
      const res = await admin.request('/api/admin/users?page=1&limit=2');
      assert.equal(res.status, 200);
      assert.equal(res.body.success, true);
      assert.ok(Array.isArray(res.body.data.items));
      assert.ok(res.body.data.items.length <= 2);
      assert.equal(res.body.data.page, 1);
      assert.equal(res.body.data.limit, 2);
      assert.ok(typeof res.body.data.total === 'number');
    });
  });
});

