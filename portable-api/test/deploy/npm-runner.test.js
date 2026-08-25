const assert = require('node:assert/strict');
const test = require('node:test');

const { createNpmRunner } = require('../../src/deploy/npm-runner');

test('runs npm through the Windows command processor with explicit arguments', async () => {
  const calls = [];
  const npmRunner = createNpmRunner({
    apiRoot: 'C:\\Deploy\\SmartRoom\\portable-api',
    runner: { run: async (file, args, options) => calls.push({ file, args, options }) },
    platform: 'win32',
    commandProcessor: 'C:\\Windows\\System32\\cmd.exe',
  });

  await npmRunner.install();
  await npmRunner.run();

  assert.deepEqual(calls.map(({ file, args }) => [file, args]), [
    ['C:\\Windows\\System32\\cmd.exe', ['/d', '/s', '/c', 'npm.cmd', 'ci', '--omit=dev', '--ignore-scripts']],
    ['C:\\Windows\\System32\\cmd.exe', ['/d', '/s', '/c', 'npm.cmd', 'test']],
  ]);
});

test('runs npm directly on non-Windows platforms', async () => {
  const calls = [];
  const npmRunner = createNpmRunner({
    apiRoot: '/srv/smartroom/portable-api',
    runner: { run: async (file, args, options) => calls.push({ file, args, options }) },
    platform: 'linux',
  });

  await npmRunner.install();
  await npmRunner.run();

  assert.deepEqual(calls.map(({ file, args }) => [file, args]), [
    ['npm', ['ci', '--omit=dev', '--ignore-scripts']],
    ['npm', ['test']],
  ]);
});
