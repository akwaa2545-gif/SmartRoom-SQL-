const MINIMUM_INTERVAL_MS = 60_000;

function readPositiveInteger(value, fallback, name, minimum = 1) {
  if (value === undefined || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum)
    throw new Error(`${name} must be an integer of at least ${minimum}.`);
  return parsed;
}

function readGitReference(value, fallback, name) {
  const reference = value || fallback;
  if (!/^[A-Za-z0-9][A-Za-z0-9._/-]*$/.test(reference) || reference.includes('..'))
    throw new Error(`${name} is invalid.`);
  return reference;
}

function getDeploymentConfig(environment = process.env) {
  const healthUrl = environment.DEPLOY_HEALTH_URL || 'http://127.0.0.1:8787/health';
  let parsedHealthUrl;
  try {
    parsedHealthUrl = new URL(healthUrl);
  } catch {
    throw new Error('DEPLOY_HEALTH_URL must be a valid HTTP or HTTPS URL.');
  }
  if (!['http:', 'https:'].includes(parsedHealthUrl.protocol))
    throw new Error('DEPLOY_HEALTH_URL must use HTTP or HTTPS.');

  return Object.freeze({
    remote: readGitReference(environment.DEPLOY_REMOTE, 'origin', 'DEPLOY_REMOTE'),
    branch: readGitReference(environment.DEPLOY_BRANCH, 'main', 'DEPLOY_BRANCH'),
    intervalMs: readPositiveInteger(
      environment.DEPLOY_INTERVAL_MS,
      300_000,
      'DEPLOY_INTERVAL_MS',
      MINIMUM_INTERVAL_MS,
    ),
    healthUrl: parsedHealthUrl.toString().replace(/\/$/, ''),
    healthTimeoutMs: readPositiveInteger(
      environment.DEPLOY_HEALTH_TIMEOUT_MS,
      15_000,
      'DEPLOY_HEALTH_TIMEOUT_MS',
    ),
    startTimeoutMs: readPositiveInteger(
      environment.DEPLOY_START_TIMEOUT_MS,
      60_000,
      'DEPLOY_START_TIMEOUT_MS',
    ),
  });
}

module.exports = { getDeploymentConfig, MINIMUM_INTERVAL_MS };
