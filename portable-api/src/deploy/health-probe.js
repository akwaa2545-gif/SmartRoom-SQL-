function delay(milliseconds) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function createHealthProbe({ healthUrl, timeoutMs, requestTimeoutMs = 5_000, fetchImpl = fetch }) {
  async function isHealthy(expectedRevision) {
    try {
      const response = await fetchImpl(healthUrl, { signal: AbortSignal.timeout(requestTimeoutMs) });
      const payload = await response.json();
      return Boolean(
        response.ok &&
        payload?.success &&
        payload?.data?.status === 'ok' &&
        payload.data.revision === expectedRevision,
      );
    } catch {
      return false;
    }
  }

  async function assertHealthy(expectedRevision) {
    const deadline = Date.now() + timeoutMs;
    let lastError = new Error('Health endpoint did not respond.');
    while (Date.now() < deadline) {
      try {
        if (await isHealthy(expectedRevision)) return;
        lastError = new Error('Health endpoint returned an unexpected deployment revision.');
      } catch (error) {
        lastError = error;
      }
      await delay(1_000);
    }
    throw new Error(`Portable API did not become healthy for ${expectedRevision}: ${lastError.message}`);
  }

  return Object.freeze({ isHealthy, assertHealthy });
}

module.exports = { createHealthProbe };
