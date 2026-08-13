# SmartRoom Session Handoff — Tomorrow

## User goal

Move SmartRoom operational data from Firestore to the company SQL Server so booking and email delivery do not depend on Firebase Firestore quota. Keep Firebase Hosting for the web frontend.

## Current incident

- Booking creation still worked in Firestore.
- Verification-email endpoint failed with `8 RESOURCE_EXHAUSTED: Quota exceeded.`
- Admin test email worked, proving the Power Automate mail flow itself is reachable.
- The old host API performed broad Firestore scans every minute, causing quota exhaustion.
- Firestore free quota resets around midnight Pacific time (about 14:00 Thailand during PDT / 15:00 during PST).

### Confirmed evidence

The host PC was started manually with:

```powershell
cd C:\temp\portable-api
node .\src\server.js
```

It logged a successful HTTPS listener on the internal host address, followed by:

```text
initial no-show archive failed { message: '8 RESOURCE_EXHAUSTED: Quota exceeded.' }
```

The booking-email request then logged the same Firestore error. This proves the immediate failure is Firestore quota exhaustion, not a DNS, IIS, TLS, mailbox lookup, or Power Automate send-flow problem.

### Why the quota was exhausted

An earlier portable API worker queried all `CONFIRMED` and `NO_SHOW` bookings every minute in order to archive missed check-ins. It also queried queued verification emails. Repeated collection scans consume Firestore reads even when no user is booking. This is incompatible with Firestore's free 50K document-read daily quota.

The local source was changed to prepare SQL-backed queue handling and to remove the broad no-show scan. That source has **not** been approved/deployed to the host PC yet.

## Do not do

- Do not deploy Firebase Hosting, host PC code, or SQL migrations without explicit user approval.
- Do not paste or store secrets in docs/chat: SQL password, PFX password, Firebase service account JSON, or Power Automate signed URLs.
- Do not deploy the incomplete SQL booking cutover yet. A review found that switching only booking creation makes SQL bookings invisible to other users after refresh.

## Existing deployed frontend

- Firebase Hosting URL: `https://tokinsmartroom-495306.web.app`
- It uses the internal API URL from `.env.production`.
- The local-network booking gate was fixed and deployed: a normal successful API health check is accepted as ready.

### Important frontend behavior

- The normal booking form currently writes bookings directly to Firestore.
- The form then calls `/api/booking-verification-emails` to send its verification email.
- The booking write can succeed while the follow-up email request fails; this is why users saw “Booking was created, but verification email failed.”
- Do not deploy a partial SQL “create booking only” implementation. The schedule screen currently reads Firestore through `onSnapshot`, so a SQL-only booking would not be visible to other users or after refresh.
- If a separate temporary frontend version deliberately skips verification-email sending, bookings may continue to be created in Firestore, but there will be no check-in email/link during that temporary period. Include those bookings in the final Firestore delta import.

## Host PC facts

- Host folder: `C:\temp\portable-api`
- Host task: `SmartRoom Portable API`
- Internal HTTPS health endpoint: `https://THBTCADT-L04713.KEMET.COM/health`
- Visiting `/` returns a deliberate JSON `not-found` response; this is normal. Use `/health` for testing.
- The internal API is reachable only from the corporate network. Employee browsers may need the browser **Local network** permission enabled for the Firebase-hosted page.
- Do not combine IIS Windows-auth setup with the current password-based PC admin login. IIS Windows auth can block `/api/admin/session` before Node receives it.

## Work completed locally

- Portable API admin login/session uses SQL `dbo.SmartRoomAdmins`.
- Admin email history uses SQL `dbo.EmailAudit`.
- New branded orange ticket-style verification-email HTML was prepared in `portable-api/src/server.js`.
- SQL email queue preparation was added in `portable-api/sql/004_email_queue.sql`.
- SQL migration preparation scripts exist:
  - `005_sql_bookings.sql`
  - `006_sql_operational_data.sql`

### Admin and email work already prepared

- Admin passwords are stored in SQL as PBKDF2 verifier records, not plaintext.
- Admin sessions are signed, expire after eight hours, and include a SQL session-version check so reinitializing an admin password revokes existing sessions.
- The frontend Admin panel has local code to use PC-admin API login and SQL email history when the portable API is enabled.
- Email history supports successful/failed audit records, test-email purpose labels, booking/room details, and SQL-backed history access.
- A new orange ticket-style verification email HTML template was prepared locally. It uses booking title, room, date/time in `Asia/Bangkok`, organizer, booking ID, and a Verify Booking button.

### Local work that is incomplete and must not be deployed yet

- `POST /api/bookings`, SQL verification-context access, and SQL token verification were started as migration preparation.
- Review found high-risk gaps: SQL booking list/read model is not complete, server-side room/mailbox validation needs completion, and scheduled SQL delivery needs a complete reliable worker.
- Leave these routes disconnected from the frontend until the full import/read/write cutover is complete.

## Full SQL migration order

1. After Firestore quota resets, export/import all existing Firestore data into SQL first: rooms, amenities, bookings, maintenance, missed-check-in history, announcements, admins (without legacy plaintext passwords), and email history as needed.
2. Validate record counts and booking status totals before changing the frontend.
3. Implement and test SQL API read endpoints for rooms and bookings.
4. Implement transactional SQL booking creation with SQL overlap protection and SQL email queue/token state.
5. Replace frontend Firestore operational reads/writes with API calls.
6. Run a final Firestore delta import while booking writes are paused.
7. Only then deploy frontend and update/restart host API.

### Collection-to-table map

| Firestore collection | SQL destination | Migration note |
| --- | --- | --- |
| `rooms` | `dbo.Rooms`, `dbo.RoomAmenities` | Import before booking UI cutover. |
| `bookings` | `dbo.Bookings` | Preserve document IDs; import all statuses and verification fields. |
| `roomMaintenanceHistory` | `dbo.RoomMaintenanceHistory` | Preserve room closure history. |
| `missedCheckInHistory` | `dbo.MissedCheckInHistory` | Import historical/archive records. |
| `admins` | `dbo.SmartRoomAdmins` | Do not migrate old plaintext/browser hashes as passwords. Reinitialize secure SQL passwords. |
| `emailSentHistory` | `dbo.EmailAudit` | Preserve where needed; SQL email history becomes authoritative. |
| `announcements` | `dbo.Announcements` | Keep Firebase Hosting UI but move announcement CRUD/read API to SQL. |

### Required API cutover capabilities

Before frontend migration, the portable API must have:

- SQL `GET /api/rooms`
- SQL `GET /api/bookings` with date/room filtering
- Transactional SQL `POST /api/bookings` with overlap protection
- SQL room maintenance and closure endpoints
- SQL verification context and single-use token verification
- SQL email queue worker that claims due jobs safely and never scans Firestore collections
- SQL admin, announcement, and email-history endpoints

The browser must never connect to SQL Server directly. It talks only to the internal HTTPS API.

## Critical migration rule

Do not move only new booking creation to SQL. Existing bookings must be imported and displayed through SQL first, otherwise users cannot see bookings created by other users and may think occupied rooms are free.

## Tomorrow's recommended checklist

1. Confirm the Firestore quota has reset using one safe API/booking-email test; do not restart an old collection-scanning API build.
2. Export Firestore collections with the host service account to a dated backup file outside the web/API folder.
3. Record collection counts and booking counts by status before import.
4. Run the approved SQL schema scripts in a staging/copy database first.
5. Build and run an idempotent importer that preserves Firestore document IDs and logs rejected documents to `dbo.FirestoreMigrationAudit`.
6. Validate SQL totals against Firestore totals before changing any frontend configuration.
7. Continue implementing the SQL read model, then the write/verification/email workflow.
8. Ask the user for explicit approval before every host SQL migration, host source copy/restart, Firebase deploy, or Firestore rule change.

### Importer prepared locally

`portable-api/scripts/import-firestore-to-sql.js` now exists. It is dry-run by default and requires both `--apply` and `--confirm=IMPORT_SMARTROOM` for SQL writes. It has not been copied to the host or run against any database.

Do not run `--apply` yet. The current script must first be expanded to safely snapshot/import maintenance history, missed-check-in history, announcements and email history; it must also transactionally import room amenities and reject invalid source documents instead of silently changing them.

### Migration attempt — 2026-08-11

- A service-account key for the correct Firebase project was supplied locally and is ignored by Git.
- The named Firestore database is `ai-studio-28114784-a066-482c-9738-dfb6c9d68ce0`.
- The read-only export was attempted with that key and database. Firestore returned `RESOURCE_EXHAUSTED: Quota exceeded` before it could write a backup file.
- Therefore: **no Firestore data, SQL data, host deployment, or Firebase Hosting deployment changed**.
- Resume only after Firestore quota is available again (or after the account owner deliberately enables billing). Start with a dry-run backup, verify counts, then complete the importer fixes before any `--apply` run.

### Final cutover backup — 2026-08-11

- Booking creation was paused before the final export.
- Final backup file: `portable-api/migration-backup-2026-08-11T07-34-52-994Z.json` (Git-ignored; contains booking PII).
- Final source counts: 6 rooms and 354 bookings (`VERIFIED=238`, `CONFIRMED=116`).
- An earlier backup had 385 bookings. Comparison showed 31 `CONFIRMED` records were removed by the running system between exports; no records were added and `VERIFIED` stayed at 238. Use only the final 354-booking backup for cutover.
- Current importer has been reviewed and uses a single SQL transaction: all rooms/bookings/audit rows commit together, or all roll back.
- The final import must be run from the SQL/domain host after copying the final backup plus the current importer script. No SQL import has been run yet from this development workstation.

## Known tooling status

- Firebase CLI is installed and authenticated to project `sutsmartbus-495306`.
- Google Cloud CLI (`gcloud`) is not installed on the current development machine.
- Firebase CLI can list projects but cannot clear an exhausted Firestore quota.
- Firebase Hosting default `*.web.app` domain remains free; the quota/cost issue is Firestore operations, not the domain.

## Useful checks

```powershell
# Host API health
Invoke-WebRequest https://THBTCADT-L04713.KEMET.COM/health

# Host service status
Get-ScheduledTaskInfo -TaskName "SmartRoom Portable API" | Format-List *

# Restart after an approved host update
schtasks /End /TN "SmartRoom Portable API"
schtasks /Run /TN "SmartRoom Portable API"
```

## Verification before any deployment

```powershell
node --check portable-api/src/server.js
npm test --prefix portable-api
npx tsc --noEmit
npm run build
```
