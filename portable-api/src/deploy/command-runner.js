const { spawn } = require('node:child_process');

function createCommandRunner({ spawnImpl = spawn } = {}) {
  function run(file, args, { cwd, environment = process.env, timeoutMs = 120_000 } = {}) {
    return new Promise((resolve, reject) => {
      const child = spawnImpl(file, args, {
        cwd,
        env: { ...environment },
        shell: false,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let completed = false;
      let stdout = '';
      let stderr = '';
      const timeout = setTimeout(() => {
        if (completed) return;
        completed = true;
        child.kill();
        reject(new Error(`${file} timed out after ${timeoutMs}ms.`));
      }, timeoutMs);

      child.stdout?.on('data', (chunk) => { stdout += chunk; });
      child.stderr?.on('data', (chunk) => { stderr += chunk; });
      child.once('error', (error) => {
        if (completed) return;
        completed = true;
        clearTimeout(timeout);
        reject(new Error(`${file} could not start: ${error.message}`));
      });
      child.once('close', (code) => {
        if (completed) return;
        completed = true;
        clearTimeout(timeout);
        if (code === 0) return resolve({ stdout, stderr });
        reject(new Error(`${file} exited with code ${code}.`));
      });
    });
  }

  return Object.freeze({ run });
}

module.exports = { createCommandRunner };
