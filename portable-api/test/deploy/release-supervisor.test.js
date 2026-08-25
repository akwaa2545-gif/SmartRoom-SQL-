const assert = require('node:assert/strict');
const test = require('node:test');

const { createReleaseSupervisor } = require('../../src/deploy/release-supervisor');

test('installs and starts from the verified release directory', async () => {
  const calls = [];
  const verifiedApiRoot = 'C:\\ProgramData\\SmartRoom\\verified-releases\\portable-api-v1.0.0\\portable-api';
  const supervisor = createReleaseSupervisor({
    releaseClient: {
      latestTag: async () => 'portable-api-v1.0.0',
      prepare: async () => ({ tag: 'portable-api-v1.0.0', apiRoot: verifiedApiRoot }),
    },
    processManager: {
      stop: async () => calls.push('stop'),
      start: async (options) => calls.push({ start: options }),
    },
    installer: { install: async (apiRoot) => calls.push({ install: apiRoot }) },
    healthProbe: {
      isHealthy: async () => false,
      assertHealthy: async (tag) => calls.push({ health: tag }),
    },
    state: { read: () => null, write: (release) => calls.push({ state: release }) },
  });

  assert.deepEqual(await supervisor.deployOnce(), { status: 'deployed', tag: 'portable-api-v1.0.0' });
  assert.deepEqual(calls, [
    'stop',
    { install: verifiedApiRoot },
    { start: { DEPLOY_REVISION: 'portable-api-v1.0.0', apiRoot: verifiedApiRoot } },
    { health: 'portable-api-v1.0.0' },
    { state: { tag: 'portable-api-v1.0.0', apiRoot: verifiedApiRoot } },
  ]);
});
