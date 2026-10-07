import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { createTestClient, TestClient, prisma } from './helpers.js';

describe('Authentication & Session Management', () => {
  let client: TestClient;
  const testCustomerEmail = 'customer@test.com';
  const initialPassword = 'Password123!';
  const newPassword = 'NewPassword123!';

  before(async () => {
    client = await createTestClient();
    // Ensure test customer exists with initialPassword and ACTIVE status
    const hash = await bcrypt.hash(initialPassword, 10);
    await prisma.user.upsert({
      where: { email: testCustomerEmail },
      update: {
        passwordHash: hash,
        status: 'ACTIVE',
        role: 'CUSTOMER',
        tokenVersion: 0,
      },
      create: {
        email: testCustomerEmail,
        name: 'Test Customer',
        passwordHash: hash,
        role: 'CUSTOMER',
        status: 'ACTIVE',
        tokenVersion: 0,
      },
    });
  });

  after(async () => {
    // Reset test customer password and close client
    const hash = await bcrypt.hash(initialPassword, 10);
    await prisma.user.update({
      where: { email: testCustomerEmail },
      data: {
        passwordHash: hash,
        tokenVersion: 0,
        name: 'Test Customer',
        status: 'ACTIVE',
      },
    }).catch(() => {});
    await client.close();
  });

  it('POST /api/auth/login with invalid credentials should return 401', async () => {
    const res = await client.post('/api/auth/login', {
      email: testCustomerEmail,
      password: 'WrongPassword999!',
    });
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
    assert.strictEqual(client.cookie, undefined);
  });

  it('GET /api/auth/session without cookie should return 401', async () => {
    const res = await client.get('/api/auth/session');
    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.success, false);
  });

  it('POST /api/auth/login with valid credentials should return 200 and set auth cookie', async () => {
    const res = await client.post('/api/auth/login', {
      email: testCustomerEmail,
      password: initialPassword,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.user.email, testCustomerEmail);
    assert.strictEqual(res.body.data.user.role, 'CUSTOMER');
    assert.ok(client.cookie, 'Expected auth cookie to be saved in test client');
  });

  it('GET /api/auth/session with valid cookie should return current user', async () => {
    const res = await client.get('/api/auth/session');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.user.email, testCustomerEmail);
    assert.strictEqual(res.body.data.user.role, 'CUSTOMER');
  });

  it('PUT /api/auth/profile should update user name and reflect in session', async () => {
    const updatedName = 'Updated Customer Name';
    const res = await client.put('/api/auth/profile', { name: updatedName });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.user.name, updatedName);

    // Verify session
    const sessionRes = await client.get('/api/auth/session');
    assert.strictEqual(sessionRes.body.data.user.name, updatedName);
  });

  it('PUT /api/auth/profile should reject invalid names', async () => {
    const resShort = await client.put('/api/auth/profile', { name: 'A' });
    assert.strictEqual(resShort.status, 400);

    const resLong = await client.put('/api/auth/profile', { name: 'A'.repeat(61) });
    assert.strictEqual(resLong.status, 400);
  });

  it('POST /api/auth/change-password should reject incorrect current password', async () => {
    const res = await client.post('/api/auth/change-password', {
      currentPassword: 'WrongPassword!',
      newPassword,
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.success, false);
  });

  it('POST /api/auth/change-password should update password and revoke existing sessions via tokenVersion', async () => {
    const oldCookie = client.cookie;
    assert.ok(oldCookie);

    const res = await client.post('/api/auth/change-password', {
      currentPassword: initialPassword,
      newPassword,
    });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);

    // The old cookie carries previous tokenVersion and must now be rejected
    const testWithOldCookie = await client.get('/api/auth/session', {
      headers: { Cookie: oldCookie },
      cookie: oldCookie,
    });
    assert.strictEqual(testWithOldCookie.status, 401);

    // Can log in with new password
    const loginRes = await client.post('/api/auth/login', {
      email: testCustomerEmail,
      password: newPassword,
    });
    assert.strictEqual(loginRes.status, 200);
    assert.ok(client.cookie);

    // Revert password back to initialPassword
    const revertRes = await client.post('/api/auth/change-password', {
      currentPassword: newPassword,
      newPassword: initialPassword,
    });
    assert.strictEqual(revertRes.status, 200);
  });

  it('POST /api/auth/logout should clear session cookie and reject subsequent requests', async () => {
    // Log in first
    await client.post('/api/auth/login', {
      email: testCustomerEmail,
      password: initialPassword,
    });
    assert.ok(client.cookie);

    // Logout
    const logoutRes = await client.post('/api/auth/logout');
    assert.strictEqual(logoutRes.status, 200);
    assert.strictEqual(client.cookie, undefined);

    // Subsequent session call fails
    const sessionRes = await client.get('/api/auth/session');
    assert.strictEqual(sessionRes.status, 401);
  });

  it('POST /api/auth/register input validation rejects malformed requests', async () => {
    // Empty name
    const res1 = await client.post('/api/auth/register', {
      name: '',
      email: 'valid@example.com',
      password: 'Password123!',
    });
    assert.strictEqual(res1.status, 400);

    // Invalid email
    const res2 = await client.post('/api/auth/register', {
      name: 'Valid Name',
      email: 'not-an-email',
      password: 'Password123!',
    });
    assert.strictEqual(res2.status, 400);

    // Short password (<6 chars)
    const res3 = await client.post('/api/auth/register', {
      name: 'Valid Name',
      email: 'valid@example.com',
      password: '12345',
    });
    assert.strictEqual(res3.status, 400);

    // Password exceeding 72 chars
    const res4 = await client.post('/api/auth/register', {
      name: 'Valid Name',
      email: 'valid@example.com',
      password: 'A'.repeat(73),
    });
    assert.strictEqual(res4.status, 400);
  });

  it('OTP Verification lifecycle for registration', async () => {
    const otpEmail = 'otp-test-user@example.com';
    const otpCode = '123456';
    const otpPasswordHash = await bcrypt.hash('OtpPass123!', 10);
    const codeHash = crypto.createHash('sha256').update(otpCode).digest('hex');

    // Clean up any existing records
    await prisma.user.deleteMany({ where: { email: otpEmail } });
    await prisma.emailVerification.deleteMany({ where: { email: otpEmail } });

    // Seed emailVerification fixture
    await prisma.emailVerification.create({
      data: {
        email: otpEmail,
        purpose: 'register',
        name: 'OTP Test User',
        passwordHash: otpPasswordHash,
        codeHash,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        attempts: 0,
      },
    });

    // 1. Wrong OTP code increments attempts
    const wrongRes = await client.post('/api/auth/register/verify', {
      email: otpEmail,
      code: '999999',
    });
    assert.strictEqual(wrongRes.status, 400);

    const recordAfterWrong = await prisma.emailVerification.findFirst({
      where: { email: otpEmail, purpose: 'register' },
    });
    assert.strictEqual(recordAfterWrong?.attempts, 1);

    // 2. Lockout after 5 attempts
    await prisma.emailVerification.update({
      where: { id: recordAfterWrong!.id },
      data: { attempts: 5 },
    });
    const lockedRes = await client.post('/api/auth/register/verify', {
      email: otpEmail,
      code: otpCode,
    });
    assert.strictEqual(lockedRes.status, 400);

    // 3. Reset attempts and verify with valid code
    await prisma.emailVerification.update({
      where: { id: recordAfterWrong!.id },
      data: { attempts: 0 },
    });
    const successRes = await client.post('/api/auth/register/verify', {
      email: otpEmail,
      code: otpCode,
    });
    assert.strictEqual(successRes.status, 201);
    assert.strictEqual(successRes.body.success, true);
    assert.strictEqual(successRes.body.data.user.email, otpEmail);
    assert.strictEqual(successRes.body.data.user.role, 'CUSTOMER');

    // Verify user exists in database
    const createdUser = await prisma.user.findUnique({ where: { email: otpEmail } });
    assert.ok(createdUser);
    assert.strictEqual(createdUser.role, 'CUSTOMER');

    // 4. Cannot reuse consumed OTP code
    const reuseRes = await client.post('/api/auth/register/verify', {
      email: otpEmail,
      code: otpCode,
    });
    assert.strictEqual(reuseRes.status, 400);

    // Clean up created user and verification
    await prisma.user.deleteMany({ where: { email: otpEmail } });
    await prisma.emailVerification.deleteMany({ where: { email: otpEmail } });
  });

  it('Blocked user cannot log in', async () => {
    const blockedEmail = 'blocked-user@example.com';
    const hash = await bcrypt.hash('BlockedPass123!', 10);
    await prisma.user.deleteMany({ where: { email: blockedEmail } });
    await prisma.user.create({
      data: {
        email: blockedEmail,
        name: 'Blocked User',
        passwordHash: hash,
        role: 'CUSTOMER',
        status: 'BLOCKED',
      },
    });

    const res = await client.post('/api/auth/login', {
      email: blockedEmail,
      password: 'BlockedPass123!',
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);

    await prisma.user.deleteMany({ where: { email: blockedEmail } });
  });

  it('Admin login with scope storefront should be rejected with 403', async () => {
    const adminEmail = 'admin-scope-test@example.com';
    const hash = await bcrypt.hash('AdminPass123!', 10);
    await prisma.user.deleteMany({ where: { email: adminEmail } });
    await prisma.user.create({
      data: {
        email: adminEmail,
        name: 'Admin Scope Test',
        passwordHash: hash,
        role: 'ADMIN',
        status: 'ACTIVE',
      },
    });

    const res = await client.post('/api/auth/login', {
      email: adminEmail,
      password: 'AdminPass123!',
      scope: 'storefront',
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /Tài khoản quản trị viên không thể đăng nhập tại đây/);

    // But admin login with scope admin should succeed
    const resAdmin = await client.post('/api/auth/login', {
      email: adminEmail,
      password: 'AdminPass123!',
      scope: 'admin',
    });
    assert.strictEqual(resAdmin.status, 200);
    assert.strictEqual(resAdmin.body.success, true);

    await prisma.user.deleteMany({ where: { email: adminEmail } });
  });

  it('Customer login with scope admin should be rejected with 403', async () => {
    const res = await client.post('/api/auth/login', {
      email: testCustomerEmail,
      password: initialPassword,
      scope: 'admin',
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.body.success, false);
    assert.match(res.body.error, /Tài khoản không có quyền quản trị/);

    // But customer login with scope storefront should succeed
    const resCustomer = await client.post('/api/auth/login', {
      email: testCustomerEmail,
      password: initialPassword,
      scope: 'storefront',
    });
    assert.strictEqual(resCustomer.status, 200);
    assert.strictEqual(resCustomer.body.success, true);
  });
});
