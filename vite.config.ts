import { execFileSync } from 'node:child_process';
import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const DEFAULT_APP_VERSION = 'v1.0.24';

const normalizeAppVersion = (value: string) => {
  const normalized = value.trim().replace(/^portable-api-/, '');
  if (!normalized) return null;
  const version = normalized.startsWith('v') ? normalized : `v${normalized}`;
  return /^v[0-9A-Za-z.-]+$/.test(version) ? version : null;
};

const getAppVersion = () => {
  const configuredVersion = process.env.VITE_APP_VERSION;
  const versionFromEnvironment = configuredVersion ? normalizeAppVersion(configuredVersion) : null;
  if (versionFromEnvironment) return versionFromEnvironment;

  try {
    const releaseTag = execFileSync(
      'git',
      ['describe', '--tags', '--match', 'portable-api-v*', '--abbrev=0'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    );
    const versionFromGit = normalizeAppVersion(releaseTag);
    if (versionFromGit) return versionFromGit;
  } catch {
    // The deployed build may not have a Git checkout or release tags available.
  }

  return DEFAULT_APP_VERSION;
};

export default defineConfig(() => {
    return {
      define: {
        __SMARTROOM_VERSION__: JSON.stringify(getAppVersion()),
      },
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});

