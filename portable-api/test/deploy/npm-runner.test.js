const assert = require('node:assert/strict');
const test = require('node:test');

const { createNpmRunner } = require('../../src/deploy/npm-runner');

test('runs production installation and tests with explicit npm arguments', async () => {
  const calls = [];
  const npmRunner = createNpmRunner({
    apiRoot: 'C:\\Deploy\\SmartRoom\\portable-api',
    runner: { run: async (file, args, options) => calls.push({ file, args, options }) },
  });

  await npmRunner.install();
  await npmRunner.run();

  assert.deepEqual(calls.map(({ file, args }) => [file, args]), [
    ['npm.cmd', ['ci', '--omit=dev', '--ignore-scripts']],
    ['npm.cmd', ['test']],
  ]);
});
