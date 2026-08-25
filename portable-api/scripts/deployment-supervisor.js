const path = require('node:path');
const { loadEnv } = require('../src/config');
const { getDeploymentConfig } = require('../src/deploy/config');
const { createCommandRunner } = require('../src/deploy/command-runner');
const { createApiProcessManager } = require('../src/deploy/api-process-manager');
const { createHealthProbe } = require('../src/deploy/health-probe');
const { createNpmRunner } = require('../src/deploy/npm-runner');
const { createReleaseClient } = require('../src/deploy/release-client');
const { createReleaseState } = require('../src/deploy/release-state');
const { createReleaseSupervisor } = require('../src/deploy/release-supervisor');

const apiRoot = path.resolve(__dirname, '..');
const stateRoot = path.join(process.env.ProgramData || 'C:\\ProgramData', 'SmartRoom', 'verified-releases');

loadEnv(path.join(apiRoot, '.env'));
const config = getDeploymentConfig();
const runner = createCommandRunner();
const processManager = createApiProcessManager({ apiRoot, runner });
const healthProbe = createHealthProbe({
  healthUrl: config.healthUrl,
  timeoutMs: config.startTimeoutMs,
  requestTimeoutMs: config.healthTimeoutMs,
});
const npmRunner = createNpmRunner({ runner, apiRoot });
const releaseClient = createReleaseClient({ runner, repository: process.env.DEPLOY_RELEASE_REPOSITORY || 'akwaa2545-gif/SmartRoom-SQL-', stateRoot });
const supervisor = createReleaseSupervisor({
  releaseClient,
  processManager,
  installer: npmRunner,
  healthProbe,
  state: createReleaseState(stateRoot),
});

async function runCycle() {
  try {
    await supervisor.deployOnce();
  } catch (error) {
    console.error('Portable API deployment cycle failed.', { message: error.message });
  }
  setTimeout(runCycle, config.intervalMs);
}

runCycle();
