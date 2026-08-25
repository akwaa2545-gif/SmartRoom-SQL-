function createReleaseSupervisor({ releaseClient, processManager, installer, healthProbe, state, logger = console }) {
  async function restore(previous) {
    await processManager.stop();
    await installer.install(previous.apiRoot);
    await processManager.start({ DEPLOY_REVISION: previous.tag, apiRoot: previous.apiRoot });
    await healthProbe.assertHealthy(previous.tag);
  }
  async function deployOnce() {
    const latestTag = await releaseClient.latestTag();
    const previous = state.read();
    if (previous?.tag === latestTag && await healthProbe.isHealthy(latestTag)) return { status: 'current', tag: latestTag };
    const candidate = await releaseClient.prepare(latestTag);
    try {
      await processManager.stop();
      await installer.install(candidate.apiRoot);
      await processManager.start({ DEPLOY_REVISION: candidate.tag, apiRoot: candidate.apiRoot });
      await healthProbe.assertHealthy(candidate.tag);
      state.write(candidate);
      return { status: 'deployed', tag: candidate.tag };
    } catch (error) {
      if (!previous) throw error;
      try { await restore(previous); } catch (rollbackError) { throw new AggregateError([error, rollbackError], 'Release deployment and rollback failed.'); }
      logger.error('Verified release failed; previous verified release restored.', { tag: candidate.tag, message: error.message });
      throw error;
    }
  }
  return Object.freeze({ deployOnce });
}
module.exports = { createReleaseSupervisor };
