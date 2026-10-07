import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import { createTestClient, TestClient } from './helpers.js';

describe('Health and System Endpoints', () => {
  let client: TestClient;

  before(async () => {
    client = await createTestClient();
  });

  after(async () => {
    await client.close();
  });

  it('GET /health should return 200 and healthy status', async () => {
    const res = await client.get('/health');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.data.status, 'ok');
  });

  it('GET /api/non-existent-route should return 404', async () => {
    const res = await client.get('/api/non-existent-route');
    assert.strictEqual(res.status, 404);
    assert.strictEqual(res.body.success, false);
  });
});
