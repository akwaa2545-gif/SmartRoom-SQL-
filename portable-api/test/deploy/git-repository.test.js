const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');

const { createGitRepository, DEPLOYMENT_CLONE_MARKER } = require('../../src/deploy/git-repository');

test('uses argument arrays for safe Git deployment operations', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'smartroom-deploy-test-'));
  const apiRoot = path.join(root, 'portable-api');
  fs.mkdirSync(apiRoot);
  fs.mkdirSync(path.join(root, '.git'));
  fs.writeFileSync(path.join(apiRoot, '.deploy-agent'), DEPLOYMENT_CLONE_MARKER);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const calls = [];
  const runner = {
    run: async (file, args, options) => {
      calls.push({ file, args, options });
      if (args[0] === 'status') return { stdout: '' };
      if (args.includes('HEAD')) return { stdout: 'current\n' };
      return { stdout: 'target\n' };
    },
  };
  const repository = createGitRepository({ repositoryRoot: root, apiRoot, runner });

  await repository.assertDeploymentClone();
  await repository.assertClean();
  await repository.fetch('origin', 'main');
  assert.equal(await repository.getCurrentRevision(), 'current');
  assert.equal(await repository.getRemoteRevision('origin', 'main'), 'target');
  await repository.checkout('target');

  assert.deepEqual(calls.map(({ file, args }) => [file, args]), [
    ['git.exe', ['status', '--porcelain', '--untracked-files=no']],
    ['git.exe', ['fetch', '--prune', 'origin', 'main']],
    ['git.exe', ['rev-parse', 'HEAD']],
    ['git.exe', ['rev-parse', 'origin/main']],
    ['git.exe', ['status', '--porcelain', '--untracked-files=no']],
    ['git.exe', ['checkout', '--detach', '--force', 'target']],
  ]);
});

test('refuses to run outside a marked deployment clone', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'smartroom-deploy-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const repository = createGitRepository({ repositoryRoot: root, apiRoot: root, runner: { run: async () => ({ stdout: '' }) } });

  await assert.rejects(repository.assertDeploymentClone(), /marker is missing/);
});
