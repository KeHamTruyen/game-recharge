import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { createTestClient, prisma, TestClient } from './helpers.js';
import { signToken } from '../src/middleware/auth.js';
import { env } from '../src/config/env.js';

describe('Order cancellation and payment concurrency', () => {
  let customer: TestClient;
  let stranger: TestClient;
  let admin: TestClient;
  let owner: { id: string; email: string };
  let eventId = 8100000;

  before(async () => {
    [customer, stranger, admin] = await Promise.all([
      createTestClient(), createTestClient(), createTestClient(),
    ]);
    for (const [client, role] of [[customer, 'CUSTOMER'], [stranger, 'CUSTOMER'], [admin, 'ADMIN']] as const) {
      const user = await prisma.user.create({ data: {
        email: `${randomUUID()}@test.invalid`, name: 'Cancellation', passwordHash: 'unused', role,
      } });
      client.cookie = `auth_token=${signToken({ userId: user.id, email: user.email, role, tokenVersion: 0 })}`;
      if (client === customer) owner = user;
    }
  });
  after(async () => { await Promise.all([customer.close(), stranger.close(), admin.close()]); });

  async function group(amounts = [10000, 20000]) {
    const paymentOrderCode = `DUKE${randomUUID().replaceAll('-', '').toUpperCase()}`;
    const rows = [];
    for (const amount of amounts) {
      rows.push(await prisma.transaction.create({ data: {
        code: `DUKE${randomUUID().replaceAll('-', '').toUpperCase()}`, paymentOrderCode,
        userId: owner.id, userEmail: owner.email, packageName: 'Test', gameName: 'Test',
        amount, paymentStatus: 'PENDING',
      } }));
    }
    return rows.sort((a, b) => a.id.localeCompare(b.id));
  }

  function incoming(paymentOrderCode: string, amount = 30000) {
    return { id: ++eventId, accountNumber: env.SEPAY_ACCOUNT_NUMBER, transferType: 'in',
      content: paymentOrderCode, transferAmount: amount, referenceCode: randomUUID() };
  }
  const sendPayment = (body: object) => customer.post('/api/payments/webhook', body, {
    headers: { authorization: `Apikey ${env.SEPAY_API_KEY}` },
  });
  const cancel = (code: string, client = customer) => client.post(`/api/orders/${code}/cancel`);

  // Observe real PostgreSQL lock waits to force both arrival orders, without timing guesses.
  async function waitForBlockedRequests(holder: number, count: number) {
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      const waits = await prisma.$queryRaw<Array<{ pid: number; blockers: number[] }>>`
        SELECT pid, pg_blocking_pids(pid) AS blockers FROM pg_stat_activity
        WHERE datname = current_database() AND wait_event_type = 'Lock'`;
      const chain = new Set([holder]);
      for (let i = 0; i < waits.length; i++) {
        for (const row of waits) {
          if (row.blockers.some((pid) => chain.has(pid))) chain.add(row.pid);
        }
      }
      if (chain.size - 1 >= count) return;
      await delay(20);
    }
    assert.fail(`Expected ${count} requests waiting on the held order lock`);
  }

  async function orderedRace(paymentOrderCode: string, ...requests: Array<() => ReturnType<TestClient['post']>>) {
    const pending: Array<ReturnType<TestClient['post']>> = [];
    try {
      await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM transactions WHERE "paymentOrderCode" = ${paymentOrderCode} ORDER BY id FOR UPDATE`;
        const [{ pid }] = await tx.$queryRaw<Array<{ pid: number }>>`SELECT pg_backend_pid() AS pid`;
        for (const request of requests) {
          pending.push(request());
          await waitForBlockedRequests(pid, pending.length);
        }
      }, { timeout: 12000 });
      return await Promise.all(pending);
    } finally {
      await Promise.allSettled(pending);
    }
  }

  it('cancels every pending line sharing one payment code and rejects a repeated cancellation', async () => {
    const rows = await group();
    const response = await cancel(rows[1].code);
    assert.equal(response.status, 200);
    assert.equal(response.body.data.id, rows[1].id);
    const cancelled = await prisma.transaction.findMany({ where: { paymentOrderCode: rows[0].paymentOrderCode } });
    assert.ok(cancelled.every((row) => row.status === 'FAILED' && row.paymentStatus === 'EXPIRED'));
    assert.deepEqual(cancelled[0].paymentMetadata, cancelled[1].paymentMetadata);
    assert.equal((await cancel(rows[0].code)).status, 400);
  });

  it('supports legacy single orders without a payment group and enforces ownership', async () => {
    const [row] = await group([10000]);
    await prisma.transaction.update({ where: { id: row.id }, data: { paymentOrderCode: null } });
    assert.equal((await cancel(row.code, stranger)).status, 403);
    assert.equal((await cancel('MISSING')).status, 404);
    assert.equal((await cancel(row.code, admin)).status, 200);
    const saved = await prisma.transaction.findUniqueOrThrow({ where: { id: row.id } });
    assert.equal(saved.paymentStatus, 'EXPIRED');
    assert.equal((saved.paymentMetadata as { cancelledBy: string }).cancelledBy, 'ADMIN');
  });

  it('rejects the entire cancellation when another line is already paid', async () => {
    const rows = await group();
    await prisma.transaction.update({ where: { id: rows[1].id }, data: { paymentStatus: 'PAID' } });
    assert.equal((await cancel(rows[0].code)).status, 400);
    assert.equal((await prisma.transaction.findUniqueOrThrow({ where: { id: rows[0].id } })).paymentStatus, 'PENDING');
  });

  it('does not cancel another owner through a shared payment code', async () => {
    const rows = await group();
    await prisma.transaction.update({ where: { id: rows[1].id }, data: { userId: null } });
    assert.equal((await cancel(rows[0].code)).status, 403);
    assert.equal((await prisma.transaction.findUniqueOrThrow({ where: { id: rows[0].id } })).paymentStatus, 'PENDING');
  });

  it('preserves payment and receipt when webhook reaches the lock before cancellation', async () => {
    const rows = await group();
    const body = incoming(rows[0].paymentOrderCode!);
    const [payment, cancellation] = await orderedRace(rows[0].paymentOrderCode!,
      () => sendPayment(body), () => cancel(rows[0].code));
    assert.equal(payment.status, 200);
    assert.equal(cancellation.status, 400);
    const paid = await prisma.transaction.findMany({ where: { paymentOrderCode: rows[0].paymentOrderCode } });
    assert.ok(paid.every((row) => row.paymentStatus === 'PAID' && row.status === 'PROCESSING'));
    assert.ok(paid.every((row) => row.bankTransactionId === body.referenceCode));
    assert.ok(paid.every((row) => (row.paymentMetadata as { id: number }).id === body.id));
    assert.equal(await prisma.paymentReceipt.count({ where: { externalId: String(body.id) } }), 1);
  });

  it('rejects cancellation after an in-flight admin payment confirmation', async () => {
    const rows = await group();
    const [payment, cancellation] = await orderedRace(rows[0].paymentOrderCode!,
      () => admin.patch(`/api/admin/transactions/${rows[0].id}/status`, {
        status: 'PROCESSING', paymentStatus: 'PAID', reason: 'Verified transfer',
      }), () => cancel(rows[0].code));
    assert.equal(payment.status, 200);
    assert.equal(cancellation.status, 400);
    const paid = await prisma.transaction.findUniqueOrThrow({ where: { id: rows[0].id } });
    assert.equal(paid.paymentStatus, 'PAID');
    assert.equal(paid.status, 'PROCESSING');
    assert.ok(paid.paidAt);
  });

  it('records late incoming money without reopening any line when cancellation wins', async () => {
    const rows = await group();
    const body = incoming(rows[0].paymentOrderCode!);
    const [cancellation, payment] = await orderedRace(rows[0].paymentOrderCode!,
      () => cancel(rows[0].code), () => sendPayment(body));
    assert.equal(cancellation.status, 200);
    assert.equal(payment.status, 200);
    const saved = await prisma.transaction.findMany({ where: { paymentOrderCode: rows[0].paymentOrderCode } });
    assert.ok(saved.every((row) => row.status === 'FAILED' && row.paymentStatus === 'PAID'));
    assert.ok(saved.every((row) => row.bankTransactionId === body.referenceCode));
    assert.equal(await prisma.paymentReceipt.count({ where: { externalId: String(body.id) } }), 1);
    assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: owner.id } })).totalSpent.toNumber(), 0);
  });

  it('only accepts one of two cancellations of the same payment group', async () => {
    const rows = await group();
    const responses = await orderedRace(rows[0].paymentOrderCode!,
      () => cancel(rows[0].code), () => cancel(rows[1].code));
    assert.deepEqual(responses.map((res) => res.status), [200, 400]);
    const saved = await prisma.transaction.findMany({ where: { paymentOrderCode: rows[0].paymentOrderCode } });
    assert.ok(saved.every((row) => row.status === 'FAILED' && row.paymentStatus === 'EXPIRED'));
  });
});
