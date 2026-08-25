const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

const DEPLOYMENT_CLONE_MARKER = 'SMARTROOM_PORTABLE_API_DEPLOYMENT_CLONE';

function createGitRepository({ repositoryRoot, apiRoot, runner }) {
  const markerPath = path.join(apiRoot, '.deploy-agent');
  const lockPath = path.join(repositoryRoot, '.git', 'smartroom-deployment-agent.lock');

  async function runGit(args) {
    return runner.run('git.exe', args, { cwd: repositoryRoot });
  }

  async function assertDeploymentClone() {
    if (!fs.existsSync(markerPath))
      throw new Error(`Deployment clone marker is missing: ${markerPath}`);
    const marker = fs.readFileSync(markerPath, 'utf8').trim();
    if (marker !== DEPLOYMENT_CLONE_MARKER)
      throw new Error('Deployment clone marker is invalid.');
  }

  async function assertClean() {
    const { stdout } = await runGit(['status', '--porcelain', '--untracked-files=no']);
    if (stdout.trim())
      throw new Error('Deployment clone has tracked local changes; refusing to overwrite them.');
  }

  async function fetch(remote, branch) {
    await runGit(['fetch', '--prune', remote, branch]);
  }

  async function getCurrentRevision() {
    const { stdout } = await runGit(['rev-parse', 'HEAD']);
    return stdout.trim();
  }

  async function getRemoteRevision(remote, branch) {
    const { stdout } = await runGit(['rev-parse', `${remote}/${branch}`]);
    return stdout.trim();
  }

  async function checkout(revision) {
    let lockDescriptor;
    try {
      lockDescriptor = fs.openSync(lockPath, 'wx');
    } catch {
      throw new Error('Another deployment operation is already running.');
    }
    try {
      await assertClean();
      await runGit(['checkout', '--detach', '--force', revision]);
    } finally {
      fs.closeSync(lockDescriptor);
      fs.rmSync(lockPath, { force: true });
    }
  }

  async function withStagingWorkspace(revision, work) {
    const stagingRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'smartroom-portable-api-'));
    const stagingRepository = path.join(stagingRoot, 'source');
    try {
      await runGit(['worktree', 'add', '--detach', stagingRepository, revision]);
      return await work(path.join(stagingRepository, 'portable-api'));
    } finally {
      if (fs.existsSync(stagingRepository))
        await runGit(['worktree', 'remove', '--force', stagingRepository]);
      fs.rmSync(stagingRoot, { recursive: true, force: true });
    }
  }

  return Object.freeze({
    assertDeploymentClone,
    assertClean,
    fetch,
    getCurrentRevision,
    getRemoteRevision,
    checkout,
    withStagingWorkspace,
  });
}

module.exports = { createGitRepository, DEPLOYMENT_CLONE_MARKER };
