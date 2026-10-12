import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createTestClient, prisma, TestClient } from './helpers.js';
import { signToken } from '../src/middleware/auth.js';

describe('Template deletion preserves package requirements', () => {
  let admin: TestClient;
  let customer: TestClient;
  let serviceId: string;
  let statusId: string;
  before(async () => {
    admin = await createTestClient();
    customer = await createTestClient();
    for (const [client, role] of [[admin, 'ADMIN'], [customer, 'CUSTOMER']] as const) {
      const user = await prisma.user.create({ data: {
        email: `${randomUUID()}@test.invalid`, name: 'Template test', role, passwordHash: 'unused',
      } });
      client.cookie = `auth_token=${signToken({ userId: user.id, email: user.email, role, tokenVersion: 0 })}`;
    }
    serviceId = (await prisma.service.create({ data: { name: 'Template test', game: 'Test' } })).id;
    statusId = (await prisma.productStatus.create({ data: { id: randomUUID(), name: 'Available' } })).id;
  });
  after(async () => { await admin.close(); await customer.close(); });
  const template = () => prisma.topupTemplate.create({ data: {
    id: randomUUID(), name: 'UID required', game: 'Test',
    fields: [{ key: 'uid', label: 'UID', type: 'text', required: true }],
  } });
  const packageData = (templateId: string, isActive = true) => ({
    serviceId, statusId, name: 'Test package', price: 10000, templateId, isActive,
  });
  const checkout = (packageId: string, topupInfo = {}) => customer.post('/api/orders/checkout', {
    items: [{ packageId, quantity: 1 }], topupInfo,
  }, { headers: { 'Idempotency-Key': randomUUID() } });

  for (const isActive of [true, false]) {
    it(`rejects deletion referenced by an ${isActive ? 'active' : 'inactive'} package without changing either record`, async () => {
      const tpl = await template();
      const pkg = await prisma.servicePackage.create({ data: packageData(tpl.id, isActive) });
      const result = await admin.delete(`/api/admin/topup-templates/${tpl.id}`);
      assert.equal(result.status, 409);
      assert.deepEqual(await prisma.topupTemplate.findUniqueOrThrow({ where: { id: tpl.id } }), tpl);
      assert.deepEqual(await prisma.servicePackage.findUniqueOrThrow({ where: { id: pkg.id } }), pkg);
      if (isActive) {
        const count = await prisma.transaction.count();
        assert.equal((await checkout(pkg.id)).status, 400);
        assert.equal(await prisma.transaction.count(), count);
        assert.equal((await checkout(pkg.id, { uid: '123456789' })).status, 201);
      }
    });
  }

  it('deletes an unused template and returns 404 when it is already gone', async () => {
    const tpl = await template();
    assert.equal((await admin.delete(`/api/admin/topup-templates/${tpl.id}`)).status, 200);
    assert.equal(await prisma.topupTemplate.findUnique({ where: { id: tpl.id } }), null);
    assert.equal((await admin.delete(`/api/admin/topup-templates/${tpl.id}`)).status, 404);
  });

  it('allows deletion after reassignment without changing the existing order snapshot', async () => {
    const old = await template();
    const replacement = await template();
    const pkg = await prisma.servicePackage.create({ data: packageData(old.id) });
    const created = await checkout(pkg.id, { uid: '123456789' });
    assert.equal(created.status, 201);
    const order = await prisma.transaction.findUniqueOrThrow({ where: { id: created.body.data.transactions[0].id } });
    assert.equal((await admin.put(`/api/admin/packages/${pkg.id}`, { templateId: replacement.id })).status, 200);
    assert.equal((await admin.delete(`/api/admin/topup-templates/${old.id}`)).status, 200);
    assert.equal((await prisma.servicePackage.findUniqueOrThrow({ where: { id: pkg.id } })).templateId, replacement.id);
    assert.deepEqual(await prisma.transaction.findUniqueOrThrow({ where: { id: order.id } }), order);
    assert.equal((await checkout(pkg.id)).status, 400);
  });

  for (const operation of ['create', 'update']) {
    it(`serializes deletion with package ${operation} so successful assignment never points to a deleted template`, async () => {
      const tpl = await template();
      const pkg = operation === 'update'
        ? await prisma.servicePackage.create({ data: packageData('') }) : null;
      const [assigned, deleted] = await Promise.all([
        pkg ? admin.put(`/api/admin/packages/${pkg.id}`, { templateId: tpl.id })
          : admin.post('/api/admin/packages', packageData(tpl.id)),
        admin.delete(`/api/admin/topup-templates/${tpl.id}`),
      ]);
      if (assigned.status === (pkg ? 200 : 201)) {
        assert.equal(deleted.status, 409);
        assert.ok(await prisma.topupTemplate.findUnique({ where: { id: tpl.id } }));
        assert.equal((await prisma.servicePackage.findUniqueOrThrow({ where: { id: assigned.body.data.id } })).templateId, tpl.id);
      } else {
        assert.equal(assigned.status, 400);
        assert.equal(deleted.status, 200);
        assert.equal(await prisma.servicePackage.count({ where: { templateId: tpl.id } }), 0);
      }
    });
  }

  it('rejects orphaned nonempty template references on both order creation paths', async () => {
    const pkg = await prisma.servicePackage.create({ data: packageData(randomUUID()) });
    const count = await prisma.transaction.count();
    const caches = await prisma.checkoutRequest.count();
    assert.equal((await customer.post('/api/orders', { packageId: pkg.id, topupInfo: {} })).status, 400);
    assert.equal((await checkout(pkg.id)).status, 400);
    assert.equal(await prisma.transaction.count(), count);
    assert.equal(await prisma.checkoutRequest.count(), caches);
  });
});
