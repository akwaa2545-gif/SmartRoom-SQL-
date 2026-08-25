const assert = require('node:assert/strict');
const test = require('node:test');

const { getDeploymentConfig } = require('../../src/deploy/config');

test('uses safe deployment defaults', () => {
  assert.deepEqual(getDeploymentConfig({}), {
    remote: 'origin',
    branch: 'main',
    intervalMs: 300000,
    healthUrl: 'http://127.0.0.1:8787/health',
    healthTimeoutMs: 15000,
    startTimeoutMs: 60000,
  });
});

test('rejects unsafe Git references and a too-short polling interval', () => {
  assert.throws(() => getDeploymentConfig({ DEPLOY_BRANCH: 'main; whoami' }), /DEPLOY_BRANCH/);
  assert.throws(() => getDeploymentConfig({ DEPLOY_INTERVAL_MS: '1000' }), /DEPLOY_INTERVAL_MS/);
});
