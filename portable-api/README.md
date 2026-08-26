# Smart Room portable mail API

This service runs on a domain-joined Windows PC, uses the local SQL Server only for email audit records, and keeps the existing Firebase Hosting and Firestore booking data.

## First-time setup

1. Install Node.js 20 LTS on the PC.
2. Copy `.env.example` to `.env`, then fill in the Power Automate trigger URLs and the new SQL credentials. Never put credentials in this repository or a frontend environment file.
3. Create a dedicated Firebase service-account key with access only to the app's Firestore database. Save it as `secrets/firebase-service-account.json`; the `secrets` directory is ignored by Git. Restrict its NTFS permissions to the Windows account that runs this API.
4. Run `install-api.cmd` once.
5. Create `dbo.EmailAudit` by running `sql/001_email_audit.sql` in the `SmartRoom` database. For an existing installation, also run `sql/003_email_audit_history_details.sql` once so booking and room details appear in Email Sent History. These scripts grant the API SQL login only `SELECT` and `INSERT` on this audit table.
6. Run `sql/004_email_queue.sql` once. The PC API uses this SQL table to schedule verification emails without scanning every Firestore booking each minute.
7. Run `sql/005_sql_bookings.sql` and `sql/006_sql_operational_data.sql` once. These create the SQL tables used by room booking, operations, and the leaderboard endpoints.
8. Run `start-api.cmd` for a manual test. It deliberately listens only on `127.0.0.1:8787`; do not expose the Node port or SQL Server directly. The host setup script creates a Windows startup task that relaunches the API after a reboot or unexpected stop.

For Windows 11, use `setup-direct-https.cmd PFX_PATH ALLOWED_NETWORK API_IP API_HOSTNAME` instead of IIS/ARR. It runs Node.js directly as HTTPS using the exported PFX certificate, configures the corporate-only firewall rule, and creates the startup task.

For an alternative Windows-domain/IIS-only Admin deployment (do not combine this with the PC API password login below), run this from an elevated Command Prompt:

```text
enable-windows-admin-auth.cmd CERTIFICATE_THUMBPRINT ALLOWED_NETWORK API_IP API_HOSTNAME DOMAIN\SmartRoom-Admins
```

It changes Node to private `127.0.0.1:8787`, configures IIS as the HTTPS reverse proxy, and permits only the specified Windows domain group under `/api/admin`. It backs up the IIS `web.config` before changing it.

## PC API Admin login

The normal Admin login screen can use credentials stored in SQL Server. First run `sql/002_smartroom_admins.sql` in the `SmartRoom` database, then create each Admin once from an elevated command prompt:

```text
initialize-admin-user.cmd admin SUPER_ADMIN
initialize-admin-user.cmd approver APPROVER
```

The command prompts for a new 12+ character password and stores only a salted verifier in `dbo.SmartRoomAdmins`. It never places that password in Firebase, source code, or the frontend. When the portable API URL is enabled, Admin login and the test-mail, force-mail, and booking-status Internal Tools use this PC API login.

## Publish the API safely

Configure a reverse proxy or Cloudflare Tunnel on the same PC to route an HTTPS hostname to `http://127.0.0.1:8787`. Protect that hostname with your company access policy/WAF. The Firebase website needs a public HTTPS API address; SQL Server must remain internal.

Mailbox lookup and email dispatch require a non-anonymous Firebase sign-in by default. For a company-network-only deployment, set `ALLOW_ANONYMOUS_INTERNAL_AUTH=true` in `.env`; this supports the app's existing anonymous sign-in without Microsoft Entra. Do this only while the firewall permits access exclusively from company network/VPN ranges. Do not expose this mode through public internet routing.

After the tunnel hostname is ready, set this public (non-secret) build variable before building and deploying the Firebase Hosting app:

```text
VITE_SMARTROOM_API_URL=https://your-api-hostname
```

The website then sends its Firebase ID token to the API for mailbox search, booking verification emails, and verification-token confirmation. Without that variable, the app continues using Firebase Functions.

## Operations

- Health check: `GET /health`
- The API checks queued booking emails every minute while `start-api.cmd` is running.
- Keep the command window/service running at all times. For production, configure a Windows service or Task Scheduler restart policy.
- Rotate any SQL or Power Automate credential that was shared outside the secured PC.

## Automatic Windows deployment

For a dedicated non-Docker deployment clone, use `run-deployment-supervisor.cmd` and install the task through `install-deployment-agent-task.ps1`. The supervisor deploys only a healthy `origin/main` revision and rolls back failed releases. Follow [the deployment-agent runbook](../DEPLOYMENT_AGENT_RUNBOOK.md); do not run it from a development checkout or as `SYSTEM`.

Before deploying an attested GitHub Release manually, use `download-verified-release.ps1 -Tag portable-api-v<version>`. It refuses ZIP archives that do not pass `gh attestation verify`.

## Limitations

This phase migrates mail lookup, mail dispatch, and booking-token verification. Other Firebase Functions used by the admin tools remain separate and should be migrated in a later phase if Firebase billing is fully removed.
