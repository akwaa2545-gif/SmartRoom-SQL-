const assert = require('node:assert/strict');
const test = require('node:test');

const { createDeploymentSupervisor } = require('../../src/deploy/deployment-supervisor');

function createDependencies(overrides = {}) {
  const calls = [];
  return {
    calls,
    repository: {
      assertDeploymentClone: async () => calls.push('assertDeploymentClone'),
      assertClean: async () => calls.push('assertClean'),
      fetch: async () => calls.push('fetch'),
      getRemoteRevision: async () => 'new-revision',
      getCurrentRevision: async () => 'old-revision',
      checkout: async (revision) => calls.push(`checkout:${revision}`),
    },
    processManager: {
      stop: async () => calls.push('stop'),
      start: async ({ DEPLOY_REVISION }) => calls.push(`start:${DEPLOY_REVISION}`),
    },
    installer: { install: async () => calls.push('install') },
    stagingVerifier: { verify: async (revision) => calls.push(`stage:${revision}`) },
    healthProbe: {
      isHealthy: async (revision) => {
        calls.push(`health:${revision}`);
        return true;
      },
      assertHealthy: async (revision) => calls.push(`health:${revision}`),
    },
    config: { remote: 'origin', branch: 'main' },
    logger: { info: () => undefined, error: () => undefined },
    ...overrides,
  };
}

test('deploys a new revision only after it installs, tests, and passes health verification', async () => {
  const dependencies = createDependencies();
  const supervisor = createDeploymentSupervisor(dependencies);

  const result = await supervisor.deployOnce();

  assert.deepEqual(result, { status: 'deployed', revision: 'new-revision' });
  assert.deepEqual(dependencies.calls, [
    'assertDeploymentClone', 'assertClean', 'fetch', 'stage:new-revision', 'stop', 'checkout:new-revision',
    'install', 'start:new-revision', 'health:new-revision',
  ]);
});

test('does not restart the API when the remote revision is already running', async () => {
  const dependencies = createDependencies({
    repository: {
      assertDeploymentClone: async () => undefined,
      assertClean: async () => undefined,
      fetch: async () => undefined,
      getRemoteRevision: async () => 'same-revision',
      getCurrentRevision: async () => 'same-revision',
      checkout: async () => assert.fail('checkout must not run'),
    },
  });
  const supervisor = createDeploymentSupervisor(dependencies);

  assert.deepEqual(await supervisor.deployOnce(), { status: 'current', revision: 'same-revision' });
  assert.deepEqual(dependencies.calls, ['health:same-revision']);
});

test('starts the current revision when no API process is healthy yet', async () => {
  const dependencies = createDependencies({
    repository: {
      assertDeploymentClone: async () => undefined,
      assertClean: async () => undefined,
      fetch: async () => undefined,
      getRemoteRevision: async () => 'same-revision',
      getCurrentRevision: async () => 'same-revision',
      checkout: async () => assert.fail('checkout must not run'),
    },
    healthProbe: {
      isHealthy: async (revision) => {
        dependencies.calls.push(`health:${revision}`);
        return false;
      },
      assertHealthy: async (revision) => dependencies.calls.push(`health:${revision}`),
    },
  });
  const supervisor = createDeploymentSupervisor(dependencies);

  assert.deepEqual(await supervisor.deployOnce(), { status: 'started', revision: 'same-revision' });
  assert.deepEqual(dependencies.calls, ['health:same-revision', 'start:same-revision', 'health:same-revision']);
});

test('restores the previous revision when verification fails', async () => {
  const dependencies = createDependencies({
    healthProbe: {
      assertHealthy: async (revision) => {
        dependencies.calls.push(`health:${revision}`);
        if (revision === 'new-revision') throw new Error('revision mismatch');
      },
    },
  });
  const supervisor = createDeploymentSupervisor(dependencies);

  await assert.rejects(supervisor.deployOnce(), /revision mismatch/);
  assert.deepEqual(dependencies.calls, [
    'assertDeploymentClone', 'assertClean', 'fetch', 'stage:new-revision', 'stop', 'checkout:new-revision',
    'install', 'start:new-revision', 'health:new-revision', 'stop',
    'checkout:old-revision', 'install', 'start:old-revision', 'health:old-revision',
  ]);
});
