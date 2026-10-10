import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import bcrypt from 'bcrypt';
import { createTestClient, TestClient, prisma } from './helpers.js';

describe('Wiki API (Teams, Giftcodes, Aniimos, Voting & RBAC)', () => {
  let guestClient: TestClient;
  let authorClient: TestClient;
  let otherClient: TestClient;
  let adminClient: TestClient;

  const authorEmail = 'wiki-author@test.com';
  const otherEmail = 'wiki-other@test.com';
  const adminEmail = 'wiki-admin@test.com';
  const password = 'Password123!';

  let authorId: string;
  let otherId: string;
  let createdTeamId: number;

  before(async () => {
    guestClient = await createTestClient();
    authorClient = await createTestClient();
    otherClient = await createTestClient();
    adminClient = await createTestClient();

    const passwordHash = await bcrypt.hash(password, 10);

    const authorUser = await prisma.user.upsert({
      where: { email: authorEmail },
      update: { passwordHash, role: 'CUSTOMER', status: 'ACTIVE', tokenVersion: 0 },
      create: { email: authorEmail, name: 'Wiki Author', passwordHash, role: 'CUSTOMER', status: 'ACTIVE', tokenVersion: 0 },
    });
    authorId = authorUser.id;

    const otherUser = await prisma.user.upsert({
      where: { email: otherEmail },
      update: { passwordHash, role: 'CUSTOMER', status: 'ACTIVE', tokenVersion: 0 },
      create: { email: otherEmail, name: 'Other User', passwordHash, role: 'CUSTOMER', status: 'ACTIVE', tokenVersion: 0 },
    });
    otherId = otherUser.id;

    await prisma.user.upsert({
      where: { email: adminEmail },
      update: { passwordHash, role: 'ADMIN', status: 'ACTIVE', tokenVersion: 0 },
      create: { email: adminEmail, name: 'Admin Wiki', passwordHash, role: 'ADMIN', status: 'ACTIVE', tokenVersion: 0 },
    });

    // Login users to set session cookies
    await authorClient.post('/api/auth/login', { email: authorEmail, password });
    await otherClient.post('/api/auth/login', { email: otherEmail, password });
    await adminClient.post('/api/auth/login', { email: adminEmail, password });
  });

  after(async () => {
    // Cleanup wiki entries created during test
    await prisma.wikiVote.deleteMany({
      where: { entryKey: { startsWith: 'giftcode:test-code' } },
    });
    await prisma.wikiEntry.deleteMany({
      where: {
        OR: [
          { key: { startsWith: 'team:' } },
          { key: { startsWith: 'giftcode:test-code' } },
          { key: 'aniimo:999' },
        ],
      },
    });
    await prisma.user.deleteMany({
      where: { email: { in: [authorEmail, otherEmail, adminEmail] } },
    });

    await guestClient.close();
    await authorClient.close();
    await otherClient.close();
    await adminClient.close();
  });

  it('GET /api/wiki: public access returns entries and next cursor', async () => {
    const res = await guestClient.get('/api/wiki');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.ok(Array.isArray(res.body.data.entries));
    assert.strictEqual(typeof res.body.data.next === 'string' || res.body.data.next === null, true);
  });

  it('POST /api/wiki/teams: guest request rejected with 401', async () => {
    const res = await guestClient.post('/api/wiki/teams', {
      title: 'Guest Team',
      description: 'Test',
      aniimo_ids: [1, 2, 3, 4],
      build_data: [
        { aniimo_id: 1 },
        { aniimo_id: 2 },
        { aniimo_id: 3 },
        { aniimo_id: 4 },
      ],
    });
    assert.strictEqual(res.status, 401);
  });

  it('POST /api/wiki/teams: validation requires exactly 4 distinct Aniimos', async () => {
    const resDuplicateIds = await authorClient.post('/api/wiki/teams', {
      title: 'Invalid Team',
      description: 'Duplicate ids test',
      aniimo_ids: [1, 1, 3, 4],
      build_data: [
        { aniimo_id: 1 },
        { aniimo_id: 1 },
        { aniimo_id: 3 },
        { aniimo_id: 4 },
      ],
    });
    assert.strictEqual(resDuplicateIds.status, 400);

    const resFewIds = await authorClient.post('/api/wiki/teams', {
      title: 'Too Few Team',
      description: '3 ids test',
      aniimo_ids: [1, 2, 3],
      build_data: [{ aniimo_id: 1 }, { aniimo_id: 2 }, { aniimo_id: 3 }],
    });
    assert.strictEqual(resFewIds.status, 400);
  });

  it('POST /api/wiki/teams: customer successfully publishes a valid team', async () => {
    const res = await authorClient.post('/api/wiki/teams', {
      title: 'Đội Hình Chiến Thần Lôi Hỏa',
      description: 'Đội hình tối ưu sát thương sốc nguyên tố Lôi kết hợp Hỏa',
      aniimo_ids: [10, 20, 30, 40],
      build_data: [
        { aniimo_id: 10, s1_name: 'Sấm Chớp' },
        { aniimo_id: 20, s1_name: 'Cầu Lửa' },
        { aniimo_id: 30, s1_name: 'Khiên Đất' },
        { aniimo_id: 40, s1_name: 'Hồi Máu' },
      ],
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.ok(res.body.data.data.id > 0);
    assert.strictEqual(res.body.data.data.nickname, 'Wiki Author');
    createdTeamId = res.body.data.data.id;

    // Verify persisted in PostgreSQL wiki_entries
    const entry = await prisma.wikiEntry.findUnique({
      where: { key: `team:${createdTeamId}` },
    });
    assert.ok(entry);
    assert.strictEqual(entry.kind, 'team');
    assert.strictEqual(entry.authorId, authorId);
  });

  it('POST /api/wiki/teams: anti-duplicate checks reject duplicate team signature', async () => {
    // Attempting same 4 Aniimos in different order
    const res = await otherClient.post('/api/wiki/teams', {
      title: 'Đội Hình Tiêu Đề Khác Nhau',
      description: 'Cùng 4 con thú cưng',
      aniimo_ids: [40, 30, 20, 10], // same set as [10, 20, 30, 40]
      build_data: [
        { aniimo_id: 40 },
        { aniimo_id: 30 },
        { aniimo_id: 20 },
        { aniimo_id: 10 },
      ],
    });
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.error, 'Team or title already exists');
  });

  it('PUT /api/wiki/teams/:id: another user cannot update author team (403)', async () => {
    const res = await otherClient.put(`/api/wiki/teams/${createdTeamId}`, {
      title: 'Hacked Title',
      description: 'Attempt to override',
      aniimo_ids: [10, 20, 30, 40],
      build_data: [
        { aniimo_id: 10 },
        { aniimo_id: 20 },
        { aniimo_id: 30 },
        { aniimo_id: 40 },
      ],
    });
    assert.strictEqual(res.status, 403);
  });

  it('PUT /api/wiki/teams/:id: author can update their own team', async () => {
    const res = await authorClient.put(`/api/wiki/teams/${createdTeamId}`, {
      title: 'Đội Hình Chiến Thần Lôi Hỏa V2',
      description: 'Đã cập nhật kỹ năng chiêu 2',
      aniimo_ids: [10, 20, 30, 40],
      build_data: [
        { aniimo_id: 10, s2_name: 'Bão Điện Siêu Cấp' },
        { aniimo_id: 20 },
        { aniimo_id: 30 },
        { aniimo_id: 40 },
      ],
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.data.title, 'Đội Hình Chiến Thần Lôi Hỏa V2');
  });

  it('DELETE /api/wiki/teams/:id: other user cannot delete team (403)', async () => {
    const res = await otherClient.delete(`/api/wiki/teams/${createdTeamId}`);
    assert.strictEqual(res.status, 403);
  });

  it('DELETE /api/wiki/teams/:id: author can delete their own team (soft-delete)', async () => {
    const res = await authorClient.delete(`/api/wiki/teams/${createdTeamId}`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    const entry = await prisma.wikiEntry.findUnique({
      where: { key: `team:${createdTeamId}` },
    });
    assert.ok(entry);
    assert.strictEqual(entry.deleted, true);
  });

  let createdGiftcodeId: string;

  it('Giftcodes: creation, admin update/delete RBAC & voting', async () => {
    const testCode = `TEST-GC-${Date.now()}`;
    const giftPayload = {
      code: testCode,
      reward: '500 Tinh Thể, 1 Trứng Cổ Đại',
    };

    // Guest rejected
    const resGuest = await guestClient.post('/api/wiki/giftcodes', giftPayload);
    assert.strictEqual(resGuest.status, 401);

    // Admin creates giftcode
    const resAdmin = await adminClient.post('/api/wiki/giftcodes', giftPayload);
    assert.strictEqual(resAdmin.status, 201);
    assert.strictEqual(resAdmin.body.success, true);
    createdGiftcodeId = resAdmin.body.data.data.id;
    assert.strictEqual(resAdmin.body.data.data.code, testCode);

    // Customer attempts to update giftcode -> 403
    const resCustPut = await authorClient.put(`/api/wiki/giftcodes/${createdGiftcodeId}`, {
      code: testCode,
      reward: 'Updated Reward',
    });
    assert.strictEqual(resCustPut.status, 403);

    // Admin updates giftcode -> 200
    const resAdminPut = await adminClient.put(`/api/wiki/giftcodes/${createdGiftcodeId}`, {
      code: testCode,
      reward: '1000 Tinh Thể',
    });
    assert.strictEqual(resAdminPut.status, 200);
    assert.strictEqual(resAdminPut.body.success, true);

    // Guest cannot vote -> 401
    const resGuestVote = await guestClient.post(`/api/wiki/giftcodes/${createdGiftcodeId}/vote`, { type: 'up' });
    assert.strictEqual(resGuestVote.status, 401);

    // Customer upvotes -> 200
    const resUp = await authorClient.post(`/api/wiki/giftcodes/${createdGiftcodeId}/vote`, { type: 'up' });
    assert.strictEqual(resUp.status, 200);

    // Other user reports -> 200
    const resReport = await otherClient.post(`/api/wiki/giftcodes/${createdGiftcodeId}/vote`, { type: 'report' });
    assert.strictEqual(resReport.status, 200);

    const beforeEdit = await prisma.wikiEntry.findUniqueOrThrow({ where: { key: `giftcode:${createdGiftcodeId}` } });
    const edit = await adminClient.put(`/api/wiki/giftcodes/${createdGiftcodeId}`, { code: 'UPDATEDCODE', reward: 'Updated reward' });
    assert.strictEqual(edit.status, 200);
    assert.strictEqual(edit.body.data.authorId, beforeEdit.authorId);
    assert.strictEqual(edit.body.data.data.upvotes, 1);
    assert.strictEqual(edit.body.data.data.reports, 1);
    assert.strictEqual(edit.body.data.data.author, (beforeEdit.data as { author?: string }).author);

    // Customer attempts to delete giftcode -> 403
    const resCustDel = await authorClient.delete(`/api/wiki/giftcodes/${createdGiftcodeId}`);
    assert.strictEqual(resCustDel.status, 403);

    // Admin deletes giftcode -> 200
    const resAdminDel = await adminClient.delete(`/api/wiki/giftcodes/${createdGiftcodeId}`);
    assert.strictEqual(resAdminDel.status, 200);
  });

  it('PUT /api/wiki/aniimos/:id: customer forbidden (403), admin allowed (200)', async () => {
    const aniimoPayload = {
      title: 'Rồng Thời Gian Cổ Đại',
      stats: { hp: 2500, atk: 680, break: 120, pdef: 450, mdef: 420, regen: 85 },
      forms_and_maps: {
        form_1: { form: 'Giai đoạn 1', map: 'Hang Động Vực Sâu' },
      },
    };

    // Customer attempt
    const resCustomer = await authorClient.put('/api/wiki/aniimos/999', aniimoPayload);
    assert.strictEqual(resCustomer.status, 403);

    // Admin attempt
    const resAdmin = await adminClient.put('/api/wiki/aniimos/999', aniimoPayload);
    assert.strictEqual(resAdmin.status, 200);
    assert.strictEqual(resAdmin.body.success, true);

    const entry = await prisma.wikiEntry.findUnique({
      where: { key: 'aniimo:999' },
    });
    assert.ok(entry);
    assert.strictEqual((entry.data as any).title, 'Rồng Thời Gian Cổ Đại');
  });
});
