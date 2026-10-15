import { after, afterEach, before, beforeEach, describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { createTestClient, prisma, TestClient } from './helpers.js';
import { env } from '../src/config/env.js';
import { flushTelegramNotifications } from '../src/utils/telegramQueue.js';
import { formatTelegramOrderMessage, sendTelegramOrderNotification, sendTelegramMessage } from '../src/utils/telegram.js';
import { encryptSensitive, decryptSensitive } from '../src/utils/crypto.js';
import { migrateLegacyPasswords } from '../src/scripts/migrate_passwords.js';
import { signToken } from '../src/middleware/auth.js';

const sample = { orderCode: 'DUKETEST', amount: 10000, packageName: 'Test', gameName: 'Test', userEmail: 'test@example.invalid' };

describe('Notification delivery regressions', () => {
  let client: TestClient;
  let eventId = 9100000;
  const originalToken = env.TELEGRAM_BOT_TOKEN;
  const originalChat = env.TELEGRAM_CHAT_ID;
  before(async () => { client = await createTestClient(); });
  beforeEach(async () => {
    env.TELEGRAM_BOT_TOKEN = '';
    env.TELEGRAM_CHAT_ID = '';
    await prisma.telegramNotification.deleteMany();
  });
  afterEach(() => {
    mock.restoreAll();
    env.TELEGRAM_BOT_TOKEN = originalToken;
    env.TELEGRAM_CHAT_ID = originalChat;
  });
  after(async () => { await client.close(); });

  async function order() {
    const code = `DUKE${randomUUID().replaceAll('-', '').toUpperCase()}`;
    return prisma.transaction.create({ data: {
      code, paymentOrderCode: code, userEmail: sample.userEmail,
      packageName: sample.packageName, gameName: sample.gameName, amount: 10000,
      paymentStatus: 'PENDING', topupInfo: { credential: encryptSensitive('actual-test-password'), uid: '800123456' },
    } });
  }
  function incoming(code: string) {
    return { id: ++eventId, accountNumber: env.SEPAY_ACCOUNT_NUMBER, transferType: 'in',
      transferAmount: 10000, content: code, referenceCode: randomUUID() };
  }
  const webhook = (body: object) => client.post('/api/payments/webhook', body, {
    headers: { authorization: `Apikey ${env.SEPAY_API_KEY}` },
  });
  function enableSender(send: (options?: RequestInit) => Promise<Response>) {
    env.TELEGRAM_BOT_TOKEN = 'test-token';
    env.TELEGRAM_CHAT_ID = 'test-chat';
    const realFetch = globalThis.fetch;
    mock.method(globalThis, 'fetch', (url: Parameters<typeof fetch>[0], options?: RequestInit) =>
      String(url).startsWith('https://api.telegram.org/') ? send(options) : realFetch(url, options));
  }

  it('keeps a failed notification, retries without another payment, and never requeues webhook duplicates', async () => {
    const row = await order();
    const body = incoming(row.code);
    assert.equal((await webhook(body)).status, 200);
    const queued = await prisma.telegramNotification.findUniqueOrThrow({ where: { id: row.id } });
    assert.ok(queued.message.startsWith('enc:'));
    assert.ok(!queued.message.includes('actual-test-password'));
    assert.ok(decryptSensitive(queued.message, true).includes('800123456'));
    let calls = 0;
    enableSender(async (options) => {
      const payload = JSON.parse(String(options?.body));
      assert.ok(payload.text.includes('actual-test-password'));
      assert.ok(!payload.text.includes('enc:'));
      calls++;
      return new Response(JSON.stringify({ ok: calls > 1 }), { status: calls === 1 ? 503 : 200 });
    });
    await flushTelegramNotifications();
    const failed = await prisma.telegramNotification.findUniqueOrThrow({ where: { id: row.id } });
    assert.equal(failed.sentAt, null);
    assert.equal(failed.attempts, 1);
    assert.ok(failed.nextAttemptAt > new Date());
    assert.equal((await webhook(body)).status, 200);
    assert.equal(await prisma.telegramNotification.count(), 1);
    assert.equal((await prisma.transaction.findUniqueOrThrow({ where: { id: row.id } })).paymentStatus, 'PAID');
    await prisma.telegramNotification.update({ where: { id: row.id }, data: { nextAttemptAt: new Date(0) } });
    await flushTelegramNotifications();
    await flushTelegramNotifications();
    const sent = await prisma.telegramNotification.findUniqueOrThrow({ where: { id: row.id } });
    assert.ok(sent.sentAt);
    assert.equal(sent.message, '');
    assert.equal(calls, 2);
  });

  it('rolls payment and receipt back when the durable notification cannot be saved', async () => {
    const row = await order();
    const body = incoming(row.code);
    await prisma.$executeRawUnsafe('ALTER TABLE telegram_notifications ADD CONSTRAINT audit_queue_failure CHECK (false)');
    try {
      assert.equal((await webhook(body)).status, 500);
      assert.equal((await prisma.transaction.findUniqueOrThrow({ where: { id: row.id } })).paymentStatus, 'PENDING');
      assert.equal(await prisma.paymentReceipt.count({ where: { externalId: String(body.id) } }), 0);
      assert.equal(await prisma.telegramNotification.count(), 0);
    } finally {
      await prisma.$executeRawUnsafe('ALTER TABLE telegram_notifications DROP CONSTRAINT audit_queue_failure');
    }
    assert.equal((await webhook(body)).status, 200);
    assert.equal(await prisma.telegramNotification.count(), 1);
  });

  it('blocks reopening paid orders and acknowledges later transfers without queue conflicts', async () => {
    const row = await order();
    assert.equal((await webhook(incoming(row.code))).status, 200);
    const admin = await prisma.user.create({ data: {
      email: `${randomUUID()}@test.invalid`, name: 'Admin', passwordHash: 'unused', role: 'ADMIN',
    } });
    const cookie = `auth_token=${signToken({ userId: admin.id, email: admin.email, role: 'ADMIN', tokenVersion: 0 })}`;
    for (const paymentStatus of ['PENDING', 'UNPAID', 'FAILED', 'EXPIRED']) {
      const res = await client.patch(`/api/admin/transactions/${row.id}/status`, {
        status: 'PENDING', paymentStatus,
      }, { headers: { Cookie: cookie } });
      assert.equal(res.status, 400);
    }
    assert.equal((await webhook(incoming(row.code))).status, 200);
    assert.equal(await prisma.telegramNotification.count(), 1);
    assert.equal((await prisma.transaction.findUniqueOrThrow({ where: { id: row.id } })).paymentStatus, 'PAID');
  });

  it('encrypts legacy queued messages idempotently and never sends unreadable ciphertext', async () => {
    const legacy = await prisma.telegramNotification.create({ data: {
      id: randomUUID(), message: 'legacy-secret', nextAttemptAt: new Date(Date.now() + 3600000),
    } });
    await migrateLegacyPasswords();
    const encrypted = await prisma.telegramNotification.findUniqueOrThrow({ where: { id: legacy.id } });
    assert.ok(encrypted.message.startsWith('enc:'));
    assert.equal(decryptSensitive(encrypted.message, true), 'legacy-secret');
    await migrateLegacyPasswords();
    assert.equal((await prisma.telegramNotification.findUniqueOrThrow({ where: { id: legacy.id } })).message, encrypted.message);
    const broken = await prisma.telegramNotification.create({ data: {
      id: randomUUID(), message: 'enc:invalid', nextAttemptAt: new Date(0),
    } });
    let calls = 0;
    enableSender(async () => { calls++; return new Response('{"ok":true}'); });
    await flushTelegramNotifications();
    assert.equal(calls, 0);
    const saved = await prisma.telegramNotification.findUniqueOrThrow({ where: { id: broken.id } });
    assert.equal(saved.sentAt, null);
    assert.equal(saved.attempts, 1);
  });

  it('sends long messages in bounded parts without losing credentials, Unicode or literal HTML', async () => {
    const password = '<code>&amp;"secret</code>' + '😀'.repeat(5000);
    const message = formatTelegramOrderMessage({ ...sample, topupInfo: { password } });
    const bodies: Array<{ text: string; parse_mode?: string }> = [];
    enableSender(async (options) => {
      bodies.push(JSON.parse(String(options?.body)));
      return new Response('{"ok":true}');
    });
    assert.equal(await sendTelegramMessage(message), true);
    assert.ok(bodies.length > 1);
    assert.ok(bodies.every(body => body.text.length <= 4096 && !body.parse_mode && body.text.isWellFormed()));
    assert.ok(bodies.map(body => body.text).join('').includes(password));
    mock.restoreAll();
    let calls = 0;
    enableSender(async () => { calls++; return new Response(JSON.stringify({ ok: calls === 1 })); });
    assert.equal(await sendTelegramMessage(message), false);
    assert.equal(calls, 2);
  });

  it('recovers an expired worker lease and sends once across two independent processes', async () => {
    const job = await prisma.telegramNotification.create({ data: {
      id: randomUUID(), message: 'Test only', attempts: 1, nextAttemptAt: new Date(Date.now() + 60_000),
    } });
    let calls = 0;
    enableSender(async () => { calls++; return new Response('{"ok":true}'); });
    await flushTelegramNotifications();
    assert.equal(calls, 0);
    await prisma.telegramNotification.update({ where: { id: job.id }, data: { nextAttemptAt: new Date(0) } });
    const source = `
      globalThis.fetch = async () => { console.log('SENT'); await new Promise(r => setTimeout(r, 150)); return new Response('{"ok":true}'); };
      const {flushTelegramNotifications} = require('./src/utils/telegramQueue.ts');
      flushTelegramNotifications().finally(() => require('./src/lib/prisma.ts').prisma.$disconnect());
    `;
    const worker = () => new Promise<string>((resolve, reject) => {
      const child = spawn(process.execPath, ['--import', 'tsx', '-e', source], {
        env: { ...process.env, TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_CHAT_ID: 'test-chat' },
      });
      let output = '';
      child.stdout.on('data', (chunk) => { output += chunk; });
      child.stderr.on('data', () => {});
      child.on('error', reject);
      child.on('exit', (code) => code === 0 ? resolve(output) : reject(new Error(`Worker exit ${code}`)));
    });
    const outputs = await Promise.all([worker(), worker()]);
    assert.equal(outputs.join('').match(/SENT/g)?.length, 1);
    assert.ok((await prisma.telegramNotification.findUniqueOrThrow({ where: { id: job.id } })).sentAt);
  });

  it('formats plain topup fields and decrypts encrypted values for admin fulfillment on Telegram', () => {
    const encrypted = encryptSensitive('my-secret-pass');
    const message = formatTelegramOrderMessage({ ...sample, topupInfo: {
      uid: '800123456', pin: '987654', credential: 'plain-secret', custom: encrypted,
      login: 'template-secret', server: 'Asia',
    }, topupFields: [{ key: 'login', type: 'password' }] });
    assert.ok(message.includes('800123456') && message.includes('Asia'));
    assert.ok(message.includes('987654'));
    assert.ok(message.includes('plain-secret'));
    assert.ok(message.includes('my-secret-pass'));
    assert.ok(message.includes('template-secret'));
    assert.ok(!message.includes('enc:'));
  });

  it('finishes an in-flight send on shutdown and leaves remaining jobs for the next process', async () => {
    await prisma.telegramNotification.createMany({ data: [1, 2].map(() => ({ id: randomUUID(), message: 'Test only' })) });
    const result = spawnSync(process.execPath, ['--import', 'tsx', '-e', `
      let started;
      const sending = new Promise(resolve => { started = resolve; });
      globalThis.fetch = async () => { started(); await new Promise(r => setTimeout(r, 100)); return new Response('{"ok":true}'); };
      const {flushTelegramNotifications,stopTelegramNotifications} = require('./src/utils/telegramQueue.ts');
      flushTelegramNotifications();
      sending.then(() => stopTelegramNotifications()).finally(() => require('./src/lib/prisma.ts').prisma.$disconnect());
    `], { env: { ...process.env, TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_CHAT_ID: 'test-chat' }, timeout: 15000 });
    assert.equal(result.status, 0);
    assert.equal(await prisma.telegramNotification.count({ where: { sentAt: { not: null } } }), 1);
    assert.equal(await prisma.telegramNotification.count({ where: { sentAt: null, attempts: 0 } }), 1);
  });

  it('requires Telegram ok=true and handles network errors without claiming delivery', async () => {
    let reply = new Response('{"ok":false}', { status: 200 });
    enableSender(async () => reply);
    assert.equal(await sendTelegramOrderNotification(sample), false);
    reply = new Response('{"ok":true}', { status: 200 });
    assert.equal(await sendTelegramOrderNotification(sample), true);
    mock.restoreAll();
    enableSender(async () => { throw new Error('SIMULATED_NETWORK_FAILURE'); });
    assert.equal(await sendTelegramOrderNotification(sample), false);
  });

  it('CLI tests fail on delivery failures and succeed only when the provider accepts the message', () => {
    const run = (source: string) => spawnSync(process.execPath, ['--import', 'tsx', '-e', source], {
      env: { ...process.env, SMTP_HOST: 'test.invalid', SMTP_USER: 'test', SMTP_PASSWORD: 'test',
        TELEGRAM_BOT_TOKEN: 'test-token', TELEGRAM_CHAT_ID: 'test-chat' }, encoding: 'utf8', timeout: 15000,
    });
    for (const mode of ['verify-fail', 'send-fail', 'rejected', 'success']) {
      const result = run(`
        process.argv[2] = 'test@example.invalid';
        require('nodemailer').createTransport = () => ({
          verify: async () => { if ('${mode}' === 'verify-fail') throw new Error('SIMULATED'); },
          sendMail: async () => { if ('${mode}' === 'send-fail') throw new Error('SIMULATED'); return {accepted: ${mode === 'success' ? "['test@example.invalid']" : '[]'}, rejected: [], messageId: 'test'}; },
          close: () => {},
        });
        require('./scripts/test-email.ts');
      `);
      assert.equal(result.status, mode === 'success' ? 0 : 1, mode);
    }
    for (const ok of [false, true]) {
      const result = run(`
        globalThis.fetch = async url => new Response(JSON.stringify(String(url).endsWith('/getMe') ? {ok:true,result:{id:1,first_name:'Test',username:'test'}} : {ok:${ok}}), {status:200});
        require('./scripts/test-telegram.ts');
      `);
      assert.equal(result.status, ok ? 0 : 1);
    }
  });
});
