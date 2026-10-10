import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { PrismaClient } from '@prisma/client';

// Each run owns an isolated schema; never seed or clean the application's schema.
const url = new URL(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);
const schema = `test_${randomUUID().replaceAll('-', '')}`;
url.searchParams.set('schema', schema);
const childEnv = {
  ...process.env,
  DATABASE_URL: url.toString(), TEST_SCHEMA: schema, NODE_ENV: 'test',
  JWT_SECRET: 'test-only-jwt-secret-'.repeat(4),
  COOKIE_SECRET: 'test-only-cookie-secret-'.repeat(4),
  ADMIN_EMAIL: 'seed-admin@test.invalid', ADMIN_PASSWORD: 'TestOnlyPassword123!',
  CORS_ORIGIN: 'http://localhost:5173',
  SEPAY_API_KEY: 'test-only-api-key', SEPAY_BANK_CODE: 'TEST',
  SEPAY_ACCOUNT_NUMBER: '0000000000', SEPAY_ACCOUNT_NAME: 'TEST ONLY',
  SMTP_HOST: '', SMTP_USER: '', SMTP_PASSWORD: '', SMTP_SECURE: 'false',
  MAIL_FROM: 'test@example.invalid',
};
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
function run(args) {
  const result = spawnSync(process.execPath, args, { env: childEnv, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Test command failed (exit ${result.status})`);
}
let created = false;
try {
  if (!/^test_[a-f0-9]{32}$/.test(schema)) throw new Error('Invalid isolated schema');
  await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  created = true;
  run(['node_modules/prisma/build/index.js', 'migrate', 'deploy']);
  run(['--import', 'tsx', 'prisma/seed.ts']);
  const tests = readdirSync('tests').filter((name) => name.endsWith('.test.ts')).map((name) => `tests/${name}`);
  run(['--import', 'tsx', '--test', '--test-concurrency=1', ...tests]);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  if (created) await prisma.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await prisma.$disconnect();
}
