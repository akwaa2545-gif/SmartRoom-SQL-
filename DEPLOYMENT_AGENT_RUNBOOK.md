# Portable API deployment agent

This project can update the Portable API automatically on a dedicated Windows host without Docker. The agent polls GitHub Releases, downloads only an attested release ZIP, verifies it with GitHub CLI, and restores the last verified release if the new one is unhealthy.

The agent must run from a dedicated deployment clone. Never install it in a development checkout.

## Deployment contract

The agent runs `portable-api/src/server.js` directly from a verified release directory and sets `DEPLOY_REVISION` to the verified release tag. The API responds to `GET /health` with:

```json
{
  "success": true,
  "data": {
    "status": "ok",
    "revision": "<release tag>"
  }
}
```

The agent accepts a release only when the health response includes that exact SHA.

## Required files

| File | Purpose |
| --- | --- |
| `portable-api/scripts/deployment-supervisor.js` | Polling entry point. |
| `portable-api/src/deploy/deployment-supervisor.js` | Update, verification, and rollback workflow. |
| `portable-api/src/deploy/git-repository.js` | Clean-clone checks and Git revision operations. |
| `portable-api/src/deploy/api-process-manager.js` | Starts and stops the Node API process. |
| `portable-api/src/deploy/health-probe.js` | Confirms that the deployed revision is healthy. |
| `portable-api/run-deployment-supervisor.cmd` | Scheduled Task entry point. |
| `portable-api/install-deployment-agent-task.ps1` | Creates the scheduled task for a dedicated account. |

## Prepare a deployment host

1. Create a dedicated Windows account such as `DOMAIN\smartroom-deploy`. Give it **Log on as a batch job**, Git access to this repository, read access to the Portable API secrets, and modify access only to the deployment clone.
2. Install supported Node.js and Git for Windows for that account.
3. Clone the repository into a deployment-only folder, for example:

```cmd
git clone --branch main <REPOSITORY_URL> C:\Deploy\SmartRoom
cd /d C:\Deploy\SmartRoom\portable-api
npm ci --omit=dev
```

4. Place the private `portable-api/.env` and `portable-api/secrets` files in that deployment clone. Do not copy them into Git or another repository.
5. Configure the existing HTTP/IIS or direct-HTTPS host setup in the deployment clone if it has not already been done.

## Configure the deployment agent

Add these non-secret values to `portable-api/.env` as needed:

```env
DEPLOY_REMOTE=origin
DEPLOY_BRANCH=main
DEPLOY_INTERVAL_MS=300000
DEPLOY_HEALTH_URL=http://127.0.0.1:8787/health
DEPLOY_HEALTH_TIMEOUT_MS=15000
DEPLOY_START_TIMEOUT_MS=60000
```

`DEPLOY_INTERVAL_MS` must be at least `60000`. Use an HTTPS health URL when the API is configured for direct HTTPS. Do not set `DEPLOY_REVISION`; the supervisor supplies it to each API process.

## Install the task

Run an elevated PowerShell prompt on the deployment host:

```powershell
cd C:\Deploy\SmartRoom\portable-api
.\install-deployment-agent-task.ps1 -TaskUser "DOMAIN\smartroom-deploy"
```

Windows prompts for that account's Task Scheduler password. The installer writes a local `.deploy-agent` marker, removes the legacy `SmartRoom Portable API` task if it exists, and creates `SmartRoom Portable API Deployment Agent`. The marker is intentionally ignored by Git; it prevents the agent from updating an unmarked checkout.

## Update sequence

Every polling cycle, the agent:

1. Queries the latest Portable API GitHub Release.
2. Downloads `portable-api-release.zip` and verifies its GitHub attestation before extraction.
3. Confirms the CI-generated manifest binds the verified archive to that exact release tag and commit.
4. Leaves a current, healthy release alone; starts it if it is not healthy after a reboot.
5. Extracts the verified release outside the deployment clone, installs its production dependencies with lifecycle scripts disabled, and stops the old API.
6. Starts the verified release with `DEPLOY_REVISION` set to its tag and validates the health response.
7. If any deployment step fails, restarts the previous verified release and confirms its health response.

If both deployment and rollback fail, the task reports an error and does not claim a successful deployment. Inspect Task Scheduler history and the task account's process output before making changes.

## Verification

After task installation, verify the API health endpoint returns a revision rather than `unknown`. Then push a harmless change to `main` and confirm that the task reaches the new SHA within the configured interval.

To test rollback, use a dedicated test deployment host and a deliberately failing revision. The previous revision must resume and `/health` must report its SHA.

## Download a verified release

The attested release workflow publishes `portable-api-release.zip` only for a `portable-api-v*` Git tag. On the host PC, download and verify a release before extracting or running it:

```powershell
cd C:\Deploy\SmartRoom\portable-api
.\download-verified-release.ps1 -Tag portable-api-v1.0.0
```

The command uses GitHub CLI to download the release, runs `gh attestation verify`, and saves the ZIP only after verification succeeds. It does not extract or deploy the archive. Install GitHub CLI on the host first with `winget install GitHub.cli`.

## Security rules

- Keep `.env`, service-account files, certificates, and Git credential caches out of Git.
- Do not run the agent as `SYSTEM`; use the dedicated deployment account.
- Keep the API endpoint restricted to the intended network.
- Do not run the task from a development folder.
- The agent refuses tracked local changes; resolve them manually in the deployment clone before retrying.
- Protect `main` and the deployment account's Git credentials. Anyone able to push to that branch can deploy code that receives the API's production secrets.
- Restrict creation of `portable-api-v*` tags to release maintainers. CI refuses a release tag unless its commit is already reachable from protected `main`.
