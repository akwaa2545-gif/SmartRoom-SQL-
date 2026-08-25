const assert = require('node:assert/strict');
const test = require('node:test');

const { createHealthProbe } = require('../../src/deploy/health-probe');

test('accepts a matching revision from the health endpoint', async () => {
  const probe = createHealthProbe({
    healthUrl: 'http://127.0.0.1:8787/health',
    timeoutMs: 1000,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ success: true, data: { status: 'ok', revision: 'abc123' } }),
    }),
  });

  assert.equal(await probe.isHealthy('abc123'), true);
});

test('rejects a response for another revision', async () => {
  const probe = createHealthProbe({
    healthUrl: 'http://127.0.0.1:8787/health',
    timeoutMs: 1000,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ success: true, data: { status: 'ok', revision: 'old' } }),
    }),
  });

  assert.equal(await probe.isHealthy('new'), false);
});

test('waits successfully for a matching health response', async () => {
  const probe = createHealthProbe({
    healthUrl: 'http://127.0.0.1:8787/health',
    timeoutMs: 1000,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({ success: true, data: { status: 'ok', revision: 'abc123' } }),
    }),
  });

  await probe.assertHealthy('abc123');
});
