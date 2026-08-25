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

The agent accepts a release only when the health response includes that exact release tag.

## Required files

| File | Purpose |
| --- | --- |
| `portable-api/scripts/deployment-supervisor.js` | Polling entry point. |
| `portable-api/src/deploy/release-supervisor.js` | Verified-release update, verification, and rollback workflow. |
| `portable-api/src/deploy/release-client.js` | GitHub Release download, attestation verification, and extraction. |
| `portable-api/src/deploy/release-state.js` | Records the last successfully confirmed release. |
| `portable-api/src/deploy/api-process-manager.js` | Starts and stops the Node API process. |
| `portable-api/src/deploy/health-probe.js` | Confirms that the deployed revision is healthy. |
| `portable-api/run-deployment-supervisor.cmd` | Scheduled Task entry point. |
| `portable-api/install-deployment-agent-task.ps1` | Creates the scheduled task for a dedicated account. |

## Prepare a deployment host

1. Create a dedicated Windows account such as `DOMAIN\smartroom-deploy`. Give it **Log on as a batch job**, Git access to this repository, read access to the Portable API secrets, and modify access only to the deployment clone.
2. Install supported Node.js, Git for Windows, and GitHub CLI for that account. Confirm GitHub CLI is authenticated with access to the repository:

```powershell
gh auth status
```
3. Clone the repository into a deployment-only folder, for example:

```cmd
git clone --branch main <REPOSITORY_URL> C:\Deploy\SmartRoom
cd /d C:\Deploy\SmartRoom\portable-api
npm ci --omit=dev
```

4. Place the private `portable-api/.env` and `portable-api/secrets` files in that deployment clone. Do not copy them into Git or another repository.
5. Configure the existing HTTP/IIS or direct-HTTPS host setup in the deployment clone if it has not already been done.

### Direct HTTPS and private certificate authorities

When the API terminates HTTPS itself, point the deployment health check at the certificate's DNS name, not its IP address. For example:

```env
DEPLOY_HEALTH_URL=https://<api-dns-name>/health
```

If that certificate is issued by an internal CA, install its trusted root and any required intermediates in the Windows certificate store. Do not trust a non-root server certificate as a root, and never disable TLS validation. Node 23.8+ can use the Windows trust store with `--use-system-ca`; configure this before the task starts:

```powershell
[Environment]::SetEnvironmentVariable('NODE_OPTIONS', '--use-system-ca', 'Machine')
```

Restart the task or reboot after changing this setting. Open a new PowerShell window and validate the same endpoint:

```powershell
node -e "fetch('https://<api-dns-name>/health').then(async r=>console.log(r.status,await r.text())).catch(console.error)"
```

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

The default interval is five minutes. Use `60000` only when a one-minute polling interval is needed for a short test; restore the normal interval afterward.

Keep configuration keys unindented and uncommented. The supervisor reads `.env` at startup, so restart the scheduled task after changing these values.

## Install the task

Run an elevated PowerShell prompt on the deployment host:

```powershell
cd C:\Deploy\SmartRoom\portable-api
.\install-deployment-agent-task.ps1 -TaskUser "DOMAIN\smartroom-deploy"
```

Windows prompts for that account's Task Scheduler password. The installer writes a local `.deploy-agent` marker, removes the legacy `SmartRoom Portable API` task if it exists, and creates `SmartRoom Portable API Deployment Agent`. The marker is intentionally ignored by Git; it prevents the agent from updating an unmarked checkout.

## Operate the agent

Use the scheduled task as the only deployment supervisor. Do **not** run `node .\scripts\deployment-supervisor.js` manually while the task is running; multiple supervisors compete for the API port and can cause unnecessary rollbacks.

```powershell
schtasks /Query /TN "SmartRoom Portable API Deployment Agent" /V /FO LIST
```

`Last Result: 267009` (`0x41301`) means the long-running task is currently running. Check the API rather than expecting the task to exit:

```powershell
Invoke-RestMethod https://<api-dns-name>/health | ConvertTo-Json -Depth 5
```

If configuration changes require a restart, stop the scheduled task and start it once after confirming that no manual supervisor is running. Do not repeatedly start the task or run a foreground supervisor alongside it.

For recovery, inspect the last successfully confirmed release first:

```powershell
Get-Content C:\ProgramData\SmartRoom\verified-releases\current-release.json
```

If duplicate supervisors must be removed, end the task, list only matching supervisor processes, confirm the output, then stop their process trees and start the task once:

```powershell
schtasks /End /TN "SmartRoom Portable API Deployment Agent"

Get-CimInstance Win32_Process |
  Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'scripts\\deployment-supervisor\.js' } |
  Select-Object ProcessId, ParentProcessId, CommandLine
```

Use `taskkill.exe /PID <confirmed-process-id> /T /F` only for a confirmed deployment-supervisor process. This briefly interrupts the API; never target unrelated Node processes.

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

After task installation, verify the API health endpoint returns a revision rather than `unknown`. To test automatic pickup, publish a new `portable-api-v*` tag after the change is already on `main`, then confirm that the health endpoint reaches that tag within the configured interval plus the GitHub release build time.

```powershell
Invoke-RestMethod https://<api-dns-name>/health | ConvertTo-Json -Depth 5
```

Before publishing another test tag, wait for the previous release to finish and for the health response to report its tag. Repeated tags are not a recovery method; investigate any rollback before publishing another release.

To test rollback, use a dedicated test deployment host and a deliberately failing revision. The previous revision must resume and `/health` must report its release tag.

## Download a verified release

The attested release workflow publishes `portable-api-release.zip` only for a `portable-api-v*` Git tag. On the host PC, download and verify a release before extracting or running it:

```powershell
cd C:\Deploy\SmartRoom\portable-api
.\download-verified-release.ps1 -Tag portable-api-v1.0.0
```

The command uses GitHub CLI to download the release, runs `gh attestation verify`, and saves the ZIP only after verification succeeds. It does not extract or deploy the archive. Install GitHub CLI on the host first with `winget install GitHub.cli`.

The deployment agent installs release dependencies automatically with `npm ci --omit=dev --ignore-scripts`; administrators should not install dependencies inside verified-release directories by hand. If installation, startup, or health verification fails, the agent restores the tag recorded in `current-release.json`.

## Security rules

- Keep `.env`, service-account files, certificates, and Git credential caches out of Git.
- Do not run the agent as `SYSTEM`; use the dedicated deployment account.
- Keep the API endpoint restricted to the intended network.
- Do not run the task from a development folder.
- The agent refuses tracked local changes; resolve them manually in the deployment clone before retrying.
- Protect `main` and the deployment account's Git credentials. Anyone able to push to that branch can deploy code that receives the API's production secrets.
- Restrict creation of `portable-api-v*` tags to release maintainers. CI refuses a release tag unless its commit is already reachable from protected `main`.
