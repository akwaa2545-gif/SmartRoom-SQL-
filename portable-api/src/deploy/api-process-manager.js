const { spawn } = require('node:child_process');

function waitForExit(child, timeoutMs) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) return resolve();
    const timeout = setTimeout(resolve, timeoutMs);
    child.once('close', () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

function createApiProcessManager({
  apiRoot: defaultApiRoot,
  nodeExecutable = process.execPath,
  spawnImpl = spawn,
  runner,
  stopTimeoutMs = 10_000,
}) {
  let child = null;

  function isRunning() {
    return Boolean(child && child.exitCode === null && !child.killed);
  }

  async function start({ apiRoot = defaultApiRoot, ...environment }) {
    if (isRunning()) throw new Error('Portable API is already running.');
    child = spawnImpl(nodeExecutable, ['src/server.js'], {
      cwd: apiRoot,
      env: { ...process.env, ...environment },
      shell: false,
      windowsHide: true,
      stdio: 'inherit',
    });
    child.once('error', () => { child = null; });
    child.once('close', () => { child = null; });
  }

  async function stop() {
    if (!isRunning()) {
      child = null;
      return;
    }
    const activeChild = child;
    activeChild.kill();
    await waitForExit(activeChild, stopTimeoutMs);
    if (activeChild.exitCode === null)
      await runner.run('taskkill.exe', ['/PID', String(activeChild.pid), '/T', '/F'], {
        cwd: defaultApiRoot,
        timeoutMs: stopTimeoutMs,
      });
    child = null;
  }

  return Object.freeze({ isRunning, start, stop });
}

module.exports = { createApiProcessManager };
