function createHealthResponse(revision = process.env.DEPLOY_REVISION) {
  return {
    success: true,
    data: {
      status: 'ok',
      revision: revision?.trim() || 'unknown',
    },
  };
}

module.exports = { createHealthResponse };
