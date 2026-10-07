import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { createTestClient, TestClient, prisma } from './helpers.js';

describe('Public Catalog Endpoints', () => {
  let client: TestClient;
  let activeServiceId: string;
  let inactiveServiceId: string;
  let activePackageId: string;
  let inactivePackageId: string;

  before(async () => {
    client = await createTestClient();

    let status = await prisma.productStatus.findFirst({ where: { purchasable: true } });
    if (!status) {
      status = await prisma.productStatus.create({
        data: { id: 'status-catalog-test', name: 'Có sẵn', iconName: 'CheckCircle', color: 'green', purchasable: true },
      });
    }

    // Create an active service with active and inactive packages
    const activeService = await prisma.service.create({
      data: {
        name: 'Catalog Test Active Game',
        game: 'Catalog Test Active Game',
        description: 'Active game for catalog test',
        sortOrder: 1,
        isActive: true,
      },
    });
    activeServiceId = activeService.id;

    // Create an inactive service
    const inactiveService = await prisma.service.create({
      data: {
        name: 'Catalog Test Inactive Game',
        game: 'Catalog Test Inactive Game',
        description: 'Inactive game should not show in public',
        sortOrder: 2,
        isActive: false,
      },
    });
    inactiveServiceId = inactiveService.id;

    // Create an active package
    const activePkg = await prisma.servicePackage.create({
      data: {
        serviceId: activeServiceId,
        name: '60 Genesis Crystals',
        price: 22000,
        oldPrice: 25000,
        tags: ['hot', 'deal'],
        statusId: status.id,
        sortOrder: 1,
        isActive: true,
      },
    });
    activePackageId = activePkg.id;

    // Create an inactive package
    const inactivePkg = await prisma.servicePackage.create({
      data: {
        serviceId: activeServiceId,
        name: 'Secret Inactive Package',
        price: 100000,
        statusId: status.id,
        sortOrder: 2,
        isActive: false,
      },
    });
    inactivePackageId = inactivePkg.id;
    // Create a tag fixture
    await prisma.catalogTag.upsert({
      where: { name: 'hot-deal' },
      update: {},
      create: { name: 'hot-deal' },
    });
  });

  after(async () => {
    await prisma.catalogTag.deleteMany({ where: { name: 'hot-deal' } }).catch(() => {});
    await prisma.servicePackage.deleteMany({
      where: { id: { in: [activePackageId, inactivePackageId] } },
    }).catch(() => {});
    await prisma.service.deleteMany({
      where: { id: { in: [activeServiceId, inactiveServiceId] } },
    }).catch(() => {});
    await client.close();
  });

  it('GET /api/catalog/services returns only active services with package counts', async () => {
    const res = await client.get('/api/catalog/services');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));

    const foundActive = res.body.data.find((s: any) => s.id === activeServiceId);
    assert.ok(foundActive, 'Active service must be listed in public catalog');
    assert.strictEqual(foundActive.packageCount, 1, 'Only active packages counted');

    const foundInactive = res.body.data.find((s: any) => s.id === inactiveServiceId);
    assert.strictEqual(foundInactive, undefined, 'Inactive service must NOT be listed');
  });

  it('GET /api/catalog/services/:id returns service detail with only active packages', async () => {
    const res = await client.get(`/api/catalog/services/${activeServiceId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.id, activeServiceId);

    const pkgs = res.body.data.packages;
    assert.ok(Array.isArray(pkgs));
    assert.ok(pkgs.some((p: any) => p.id === activePackageId));
    assert.ok(!pkgs.some((p: any) => p.id === inactivePackageId), 'Inactive package must be hidden');
  });

  it('GET /api/catalog/services/:id for inactive service returns 404', async () => {
    const res = await client.get(`/api/catalog/services/${inactiveServiceId}`);
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
  });

  it('GET /api/catalog/services/:id/packages returns only active packages', async () => {
    const res = await client.get(`/api/catalog/services/${activeServiceId}/packages`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.items.some((p: any) => p.id === activePackageId));
    assert.ok(!res.body.data.items.some((p: any) => p.id === inactivePackageId));
  });

  it('GET /api/catalog/packages/:id returns active package detail', async () => {
    const res = await client.get(`/api/catalog/packages/${activePackageId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.name, '60 Genesis Crystals');
    assert.deepStrictEqual(res.body.data.tags, ['hot', 'deal']);
  });

  it('GET /api/catalog/packages/:id for inactive package returns 404', async () => {
    const res = await client.get(`/api/catalog/packages/${inactivePackageId}`);
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
  });

  it('GET /api/catalog/tags returns list of distinct tags', async () => {
    const res = await client.get('/api/catalog/tags');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
    assert.ok(res.body.data.some((t: any) => t.name === 'hot-deal'));
  });

  it('GET /api/catalog/topup-templates returns template definitions', async () => {
    const res = await client.get('/api/catalog/topup-templates');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data));
  });

  it('GET /api/catalog/settings/contactInfo returns public settings', async () => {
    const res = await client.get('/api/catalog/settings/contactInfo');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
  });

  it('GET /api/catalog/settings/nonPublicSetting returns 404', async () => {
    const res = await client.get('/api/catalog/settings/nonPublicSetting');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
  });
});
