import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { PrismaClient } from '@prisma/client';

// Build the real Dockerfile first: npm run test:container
const image = 'duke1305-backend:shutdown-test';
const schema = `test_${randomUUID().replaceAll('-', '')}`;
const hostUrl = new URL(process.env.TEST_DATABASE_URL || process.env.DATABASE_URL);
hostUrl.searchParams.set('schema', schema);
const containerUrl = new URL(hostUrl);
if (['localhost', '127.0.0.1', '[::1]'].includes(containerUrl.hostname)) {
  containerUrl.hostname = 'host.docker.internal';
}
const testEnv = {
  ...process.env, DATABASE_URL: containerUrl.toString(), NODE_ENV: 'production', PORT: '3000',
  JWT_SECRET: 'shutdown-test-jwt-'.repeat(5), COOKIE_SECRET: 'shutdown-test-cookie-'.repeat(3),
  DATA_ENCRYPTION_KEY: 'shutdown-test-encryption-'.repeat(2), CORS_ORIGIN: 'https://shutdown.test.invalid',
};
const prisma = new PrismaClient({ datasources: { db: { url: hostUrl.toString() } } });
const containers = [];
let created = false;
function docker(args, timeout = 15000) {
  const result = spawnSync('docker', args, { env: testEnv, encoding: 'utf8', timeout });
  assert.equal(result.status, 0, `docker ${args[0]} failed: ${result.stderr || result.error || ''}`);
  return (args[0] === 'logs' ? result.stdout + result.stderr : result.stdout).trim();
}
try {
  docker(['version', '--format', '{{.Server.Os}}']);
  await prisma.$executeRawUnsafe(`CREATE SCHEMA "${schema}"`);
  created = true;
  for (const signal of ['SIGTERM', 'SIGINT']) {
    const name = `duke-shutdown-${randomUUID()}`;
    containers.push(name);
    docker(['run', '-d', '--name', name, '--add-host', 'host.docker.internal:host-gateway',
      ...['DATABASE_URL', 'NODE_ENV', 'PORT', 'JWT_SECRET', 'COOKIE_SECRET', 'DATA_ENCRYPTION_KEY', 'CORS_ORIGIN']
        .flatMap((key) => ['--env', key]), image]);
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const result = spawnSync('docker', ['exec', name, 'node', '-e',
        "fetch('http://127.0.0.1:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"],
      { encoding: 'utf8', timeout: 3000 });
      if (result.status === 0) { ready = true; break; }
      if (docker(['inspect', '--format', '{{.State.Running}}', name]) === 'false') break;
      await delay(500);
    }
    assert.ok(ready, `Container failed readiness: ${docker(['logs', name])}`);
    const started = Date.now();
    if (signal === 'SIGTERM') docker(['stop', '--timeout', '12', name]);
    else docker(['kill', '--signal', signal, name]);
    assert.equal(docker(['wait', name]), '0', `${signal}: container must exit cleanly`);
    const elapsed = Date.now() - started;
    assert.ok(elapsed < 10000, `${signal}: shutdown took ${elapsed}ms`);
    const logs = docker(['logs', name]);
    assert.ok(logs.includes(`Received ${signal}`), logs);
    assert.ok(logs.includes('HTTP server closed'), logs);
    assert.ok(logs.includes('Database disconnected'), logs);
    assert.ok(!logs.includes('Forced shutdown'), logs);
    console.log(`PASS ${signal}: real API closed HTTP and Prisma, exit 0 (${elapsed}ms)`);
  }
} finally {
  for (const name of containers) docker(['rm', '-f', name]);
  if (created) await prisma.$executeRawUnsafe(`DROP SCHEMA "${schema}" CASCADE`);
  await prisma.$disconnect();
}
