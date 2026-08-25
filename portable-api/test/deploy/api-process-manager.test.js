const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const { createApiProcessManager } = require('../../src/deploy/api-process-manager');

test('starts the API with a copied environment and deployment revision', async () => {
  const child = new EventEmitter();
  child.exitCode = null;
  child.killed = false;
  const calls = [];
  const manager = createApiProcessManager({
    apiRoot: 'C:\\Deploy\\SmartRoom\\portable-api',
    nodeExecutable: 'node.exe',
    spawnImpl: (file, args, options) => {
      calls.push({ file, args, options });
      return child;
    },
    runner: { run: async () => assert.fail('taskkill must not run') },
  });

  await manager.start({ DEPLOY_REVISION: 'abc123' });

  assert.equal(manager.isRunning(), true);
  assert.deepEqual(calls[0].args, ['src/server.js']);
  assert.equal(calls[0].options.shell, false);
  assert.equal(calls[0].options.env.DEPLOY_REVISION, 'abc123');
  await assert.rejects(manager.start({ DEPLOY_REVISION: 'other' }), /already running/);
});

test('does not treat a killed child with no exit code as running', async () => {
  const child = new EventEmitter();
  child.exitCode = null;
  child.killed = false;
  child.kill = () => {
    child.killed = true;
    child.exitCode = 0;
    child.emit('close', 0);
  };
  const manager = createApiProcessManager({
    apiRoot: 'C:\\Deploy\\SmartRoom\\portable-api',
    spawnImpl: () => child,
    runner: { run: async () => assert.fail('taskkill must not run') },
  });
  await manager.start({ DEPLOY_REVISION: 'abc123' });
  await manager.stop();

  assert.equal(manager.isRunning(), false);
});

test('ignores taskkill code 128 when the child exits during forced shutdown', async () => {
  const child = new EventEmitter();
  child.exitCode = null;
  child.killed = false;
  child.pid = 1234;
  child.kill = () => { child.killed = true; };
  const manager = createApiProcessManager({
    apiRoot: 'C:\\Deploy\\SmartRoom\\portable-api',
    stopTimeoutMs: 1,
    spawnImpl: () => child,
    runner: {
      run: async () => {
        throw new Error('taskkill.exe exited with code 128.');
      },
    },
  });

  await manager.start({ DEPLOY_REVISION: 'abc123' });
  await manager.stop();

  assert.equal(manager.isRunning(), false);
});

test('uses an explicitly supplied verified release directory for the API process', async () => {
  const child = new EventEmitter();
  child.exitCode = null;
  child.killed = false;
  let options;
  const manager = createApiProcessManager({
    apiRoot: 'C:\\Deploy\\SmartRoom\\portable-api',
    spawnImpl: (_file, _args, receivedOptions) => {
      options = receivedOptions;
      return child;
    },
    runner: { run: async () => undefined },
  });

  await manager.start({ DEPLOY_REVISION: 'portable-api-v1.0.0', apiRoot: 'C:\\ProgramData\\SmartRoom\\verified-releases\\portable-api-v1.0.0\\portable-api' });

  assert.equal(options.cwd, 'C:\\ProgramData\\SmartRoom\\verified-releases\\portable-api-v1.0.0\\portable-api');
});
