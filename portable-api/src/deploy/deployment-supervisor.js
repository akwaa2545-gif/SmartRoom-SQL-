function createDeploymentSupervisor({
  repository,
  processManager,
  installer,
  testRunner,
  healthProbe,
  stagingVerifier,
  config,
  logger = console,
}) {
  let deploymentInProgress = false;

  async function restoreRevision(revision) {
    await processManager.stop();
    await repository.checkout(revision);
    await installer.install();
    await processManager.start({ DEPLOY_REVISION: revision });
    await healthProbe.assertHealthy(revision);
  }

  async function deployOnce() {
    if (deploymentInProgress) return { status: 'skipped', reason: 'deployment-in-progress' };
    deploymentInProgress = true;

    try {
      await repository.assertDeploymentClone();
      await repository.assertClean();
      await repository.fetch(config.remote, config.branch);
      const targetRevision = await repository.getRemoteRevision(config.remote, config.branch);
      const currentRevision = await repository.getCurrentRevision();
      if (targetRevision === currentRevision) {
        if (await healthProbe.isHealthy(currentRevision))
          return { status: 'current', revision: currentRevision };
        await processManager.start({ DEPLOY_REVISION: currentRevision });
        await healthProbe.assertHealthy(currentRevision);
        return { status: 'started', revision: currentRevision };
      }

      await stagingVerifier.verify(targetRevision);
      await processManager.stop();
      try {
        await repository.checkout(targetRevision);
        await installer.install();
        await processManager.start({ DEPLOY_REVISION: targetRevision });
        await healthProbe.assertHealthy(targetRevision);
        logger.info('Portable API deployment succeeded.', { revision: targetRevision });
        return { status: 'deployed', revision: targetRevision };
      } catch (deploymentError) {
        logger.error('Portable API deployment failed; restoring the prior revision.', {
          revision: targetRevision,
          message: deploymentError.message,
        });
        try {
          await restoreRevision(currentRevision);
        } catch (rollbackError) {
          throw new AggregateError(
            [deploymentError, rollbackError],
            `Deployment and rollback both failed for ${targetRevision}.`,
          );
        }
        throw deploymentError;
      }
    } finally {
      deploymentInProgress = false;
    }
  }

  return Object.freeze({ deployOnce });
}

module.exports = { createDeploymentSupervisor };
