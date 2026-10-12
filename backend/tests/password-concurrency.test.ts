import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import bcrypt from 'bcrypt';
import { createTestClient, prisma, TestClient } from './helpers.js';
import { signToken } from '../src/middleware/auth.js';

describe('Password changes racing with another change or OTP reset', () => {
  let api: TestClient;
  const currentPassword = 'CurrentPassword123!';
  const changedPassword = 'ChangedPassword123!';
  const resetPassword = 'ResetPassword123!';
  before(async () => { api = await createTestClient(); });
  after(async () => { await api.close(); });

  async function account() {
    const user = await prisma.user.create({ data: {
      email: `${randomUUID()}@test.invalid`, name: 'Password race test',
      passwordHash: await bcrypt.hash(currentPassword, 4),
    } });
    const cookie = `auth_token=${signToken({ userId: user.id, email: user.email, role: user.role, tokenVersion: 0 })}`;
    return { user, cookie };
  }

  it('only one concurrent change wins and only its password and session remain valid', async () => {
    const { user, cookie } = await account();
    const passwords = Array.from({ length: 4 }, (_, i) => `ConcurrentPassword${i}!`);
    const responses = await Promise.all(passwords.map((newPassword) => api.request('/api/auth/change-password', {
      method: 'POST', cookie, body: JSON.stringify({ currentPassword, newPassword }),
    })));
    assert.equal(responses.filter((r) => r.status === 200).length, 1);
    assert.ok(responses.every((r) => [200, 400, 401, 409].includes(r.status)));
    const winner = responses.findIndex((r) => r.status === 200);
    const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    assert.equal(updated.tokenVersion, 1);
    for (const [index, password] of passwords.entries()) {
      assert.equal(await bcrypt.compare(password, updated.passwordHash), index === winner);
    }
    assert.equal(await bcrypt.compare(currentPassword, updated.passwordHash), false);
    const winnerCookie = responses[winner].headers.get('set-cookie')!.split(';')[0];
    assert.equal((await api.request('/api/auth/session', { cookie })).status, 401);
    assert.equal((await api.request('/api/auth/session', { cookie: winnerCookie })).status, 200);
  });

  for (const resetFirst of [true, false]) {
    it(`OTP reset ${resetFirst ? 'commits before' : 'commits after'} the in-flight password change`, { timeout: 15000 }, async (t) => {
      const { user, cookie } = await account();
      const otp = await prisma.emailVerification.create({ data: {
        email: user.email, purpose: 'reset',
        codeHash: createHash('sha256').update('123456').digest('hex'),
        expiresAt: new Date(Date.now() + 600000),
      } });
      let reached!: () => void;
      let release!: () => void;
      const paused = new Promise<void>((resolve) => { reached = resolve; });
      const proceed = new Promise<void>((resolve) => { release = resolve; });
      const hash = bcrypt.hash;
      // Pause hashing to force both commit orders without relying on timing sleeps.
      const mock = t.mock.method(bcrypt, 'hash', async (value: string, rounds: number) => {
        if (value === (resetFirst ? changedPassword : resetPassword)) {
          reached();
          await proceed;
        }
        return hash(value, rounds);
      });
      const change = () => api.request('/api/auth/change-password', {
        method: 'POST', cookie, body: JSON.stringify({ currentPassword, newPassword: changedPassword }),
      });
      const reset = () => api.post('/api/auth/reset-password', {
        email: user.email, code: '123456', password: resetPassword,
      });
      const waiting = resetFirst ? change() : reset();
      try {
        await paused;
        const first = await (resetFirst ? reset() : change());
        assert.equal(first.status, 200);
        release();
        const second = await waiting;
        assert.equal(second.status, resetFirst ? 409 : 200);
        if (resetFirst) assert.equal(second.headers.get('set-cookie'), null);
        const updated = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
        assert.ok(await bcrypt.compare(resetPassword, updated.passwordHash));
        assert.equal(await bcrypt.compare(changedPassword, updated.passwordHash), false);
        assert.equal(updated.tokenVersion, resetFirst ? 1 : 2);
        assert.ok((await prisma.emailVerification.findUniqueOrThrow({ where: { id: otp.id } })).consumedAt);
        assert.equal((await api.request('/api/auth/session', { cookie })).status, 401);
        if (!resetFirst) {
          const changeCookie = first.headers.get('set-cookie')!.split(';')[0];
          assert.equal((await api.request('/api/auth/session', { cookie: changeCookie })).status, 401);
        }
      } finally {
        release();
        await waiting;
        mock.mock.restore();
      }
    });
  }
});
