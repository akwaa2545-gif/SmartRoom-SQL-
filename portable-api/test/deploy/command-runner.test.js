const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const test = require('node:test');

const { createCommandRunner } = require('../../src/deploy/command-runner');

test('runs commands without a shell and returns their output', async () => {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = () => undefined;
  let options;
  const runner = createCommandRunner({
    spawnImpl: (_file, _args, receivedOptions) => {
      options = receivedOptions;
      process.nextTick(() => {
        child.stdout.emit('data', 'ok');
        child.emit('close', 0);
      });
      return child;
    },
  });

  const result = await runner.run('git.exe', ['status'], { cwd: 'C:\\Deploy\\SmartRoom' });

  assert.equal(options.shell, false);
  assert.equal(options.windowsHide, true);
  assert.deepEqual(result, { stdout: 'ok', stderr: '' });
});
