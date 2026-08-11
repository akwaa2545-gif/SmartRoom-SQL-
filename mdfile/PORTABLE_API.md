# SmartRoom Portable API

## Purpose

The portable API runs on the internal Windows host PC and lets the Firebase-hosted SmartRoom web app use internal resources without Firebase Functions billing. Firebase Hosting remains the public website; SQL Server is the intended long-term operational data store.

## Current host layout

- Host API folder: `C:\temp\portable-api`
- API hostname: `https://THBTCADT-L04713.KEMET.COM`
- API health endpoint: `/health`
- Windows scheduled task: `SmartRoom Portable API`
- SQL database: `SmartRoom` on the company SQL Server

Do not place passwords, PFX passwords, Firebase service-account JSON, or Power Automate HTTP URLs in this file. They belong only in the host PC `.env` and `secrets` folder.

## Current API responsibilities

- YAGEO mailbox search and exact mailbox lookup through Power Automate.
- Booking verification email delivery through Power Automate.
- Admin password login backed by `dbo.SmartRoomAdmins`.
- Admin email history backed by `dbo.EmailAudit`.
- Booking verification-token handling currently still reads Firestore for legacy bookings.

## Base URL and response envelope

Production LAN base URL:

```text
https://THBTCADT-L04713.KEMET.COM
```

Every route returns JSON:

```json
{ "success": true, "data": {} }
```

Errors use:

```json
{ "success": false, "error": { "code": "error-code", "message": "Safe user-facing message" } }
```

The API accepts JSON request bodies up to 64 KB. Browser origins must be listed in `ALLOWED_ORIGINS`. The Firebase Hosting origin is an allowed origin; CORS is not authentication.

## Authentication models

| Route group | Required credential | Notes |
| --- | --- | --- |
| Public health | None | Returns no secrets. |
| Mailbox and legacy booking-email routes | `Authorization: Bearer <Firebase ID token>` | The current app uses Firebase anonymous sign-in; host `.env` must explicitly permit it where required. |
| Admin login | Username and password in JSON body | Password is verified against SQL PBKDF2 record. |
| Admin operations | `Authorization: Bearer <PC admin session>` | Session is HMAC-signed, expires after 8 hours, and is invalidated when the SQL account session version changes. |
| Booking verification link | Booking ID + single-use token | Token is stored only as a hash. |

## Implemented routes

### Health and browser preflight

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `GET` | `/health` | None | Returns `{ status: "ok" }`. Used by the browser local-network readiness check. |
| `OPTIONS` | Any API route | Origin validation | CORS preflight. Allows `content-type` and `authorization`; supports Private Network Access header for approved origins. |

### Mailbox lookup

| Method | Path | Auth | Request | Success data |
| --- | --- | --- | --- |
| `GET` | `/api/mailboxes?query=<text>` | Firebase ID token | Query must be 2–254 chars | `{ users: [...] }` maximum 10 normalized mailbox records |
| `POST` | `/api/mailboxes/lookup` | Firebase ID token | `{ "email": "person@yageo.com" }` | `{ exists: true, email, user }` |

Both routes invoke the configured Power Automate directory flow. Only the host PC knows the signed flow URL.

### Legacy Firestore booking email and verification

| Method | Path | Auth | Request | Success data |
| --- | --- | --- | --- |
| `POST` | `/api/booking-verification-emails` | Firebase ID token | `{ bookingId, email }` | `{ bookingId, status: "queued" | "sent", scheduledAt?, sentAt? }` |
| `POST` | `/api/bookings/verify-token` | Token in body | `{ bookingId, token }` | `{ title, alreadyVerified }` |

The first route reads the existing Firestore booking, checks ownership/status/time window, creates a token hash, then calls the Power Automate send flow. This is the route affected by Firestore quota exhaustion.

### SQL admin session and email history

| Method | Path | Auth | Request | Success data |
| --- | --- | --- | --- |
| `POST` | `/api/admin/session` | Admin password | `{ username, password }` | `{ user: { id, username, role, name }, token }` |
| `POST` | `/api/admin/tools` | PC admin session | `{ tool, payload }` | Tool-specific result |
| `GET` | `/api/admin/email-history?limit=200` | PC admin session | Optional `limit`, 1–200 | `{ history: [...] }` |

Current supported `tool` values:

- `send_test_email` — payload `{ email }`
- `force_send_booking_email` — payload `{ bookingId }`
- `update_booking_verify_status` — payload `{ targetStatus, bookingIds?, allBookings? }`

Unsupported legacy internal tools deliberately return `unsupported-admin-tool` until migrated.

### SQL booking routes — preparation only, not deployed

The local source currently contains the following routes for the SQL migration work. **Do not deploy or connect the frontend to these routes yet.** Existing bookings must first be imported and the SQL read model completed.

| Method | Path | Intended purpose |
| --- | --- | --- |
| `POST` | `/api/bookings` | Create a new SQL booking with transaction/overlap locking and email token state. |
| `GET` | `/api/bookings/:id/verification-context` | Read SQL booking data for the verification page. |

These routes are incomplete as a production cutover because SQL booking list/read endpoints, Firestore import, complete room validation, and scheduled SQL delivery must be finished first.

## SQL data tables

| Table | Purpose | Status |
| --- | --- | --- |
| `dbo.SmartRoomAdmins` | Admin credentials, roles, session-version revocation | Active |
| `dbo.EmailAudit` | Test and booking email delivery history | Active after scripts 001/003 |
| `dbo.EmailQueue` | SQL scheduling/claim state for future verification email | Prepared; apply script 004 |
| `dbo.Bookings` | SQL booking/token/status store | Migration preparation; script 005 |
| `dbo.Rooms`, `dbo.RoomAmenities` | SQL room read model | Migration preparation; script 006 |
| `dbo.RoomMaintenanceHistory` | Maintenance history | Migration preparation; script 006 |
| `dbo.MissedCheckInHistory` | Archived missed check-ins | Migration preparation; script 006 |
| `dbo.Announcements` | Announcement read/write model | Migration preparation; script 006 |
| `dbo.FirestoreMigrationAudit` | Import run record and rejects | Migration preparation; script 006 |

## Configuration reference

The host `.env` must provide values for these names. Use real values only on the host, never in source control or documentation.

| Name | Purpose |
| --- | --- |
| `PORT`, `API_LISTEN_HOST` | HTTP(S) listener configuration |
| `TLS_PFX_PATH`, `TLS_PFX_PASSWORD` | Direct HTTPS certificate; omit only for localhost behind IIS |
| `APP_BASE_URL`, `ALLOWED_ORIGINS` | Hosted app URL and browser origins allowed by CORS |
| `YAGEO_EMAIL_DOMAIN` | Allowed corporate email domain |
| `POWER_AUTOMATE_VERIFICATION_FLOW_URL` | Verification email flow URL |
| `POWER_AUTOMATE_USER_LOOKUP_FLOW_URL` | Mailbox lookup flow URL |
| `SQL_SERVER`, `SQL_DATABASE`, `SQL_USER`, `SQL_PASSWORD` | SQL Server connection |
| `FIREBASE_SERVICE_ACCOUNT_PATH`, `FIREBASE_DATABASE_ID` | Legacy Firestore access during migration |
| `ALLOW_ANONYMOUS_INTERNAL_AUTH` | Explicitly permits the current anonymous Firebase app flow |
| `ADMIN_SESSION_SIGNING_SECRET` | Signs PC-admin session tokens |

## Rate limits and operational behavior

- General endpoint limit: 40 requests per source IP per minute.
- Admin login: 5 attempts per source IP and username per 15 minutes.
- Power Automate calls timeout after 15 seconds.
- Email audits are best effort: a SQL audit failure must not change a successfully delivered email to failed.
- The host API must bind only to the configured internal HTTPS interface or to localhost behind IIS.

## SQL scripts

Run scripts in the `SmartRoom` database in numeric order when applicable:

1. `portable-api/sql/001_email_audit.sql`
2. `portable-api/sql/002_smartroom_admins.sql`
3. `portable-api/sql/003_email_audit_history_details.sql`
4. `portable-api/sql/004_email_queue.sql`

`005_sql_bookings.sql` and `006_sql_operational_data.sql` are preparation for the full SQL migration. Do **not** switch the website to SQL booking creation until the SQL booking read API and Firestore import are complete.

## Firestore import utility

`portable-api/scripts/import-firestore-to-sql.js` is the beginning of the controlled migration utility. It currently exports and imports `rooms` and `bookings`, preserving document IDs.

1. Run the SQL schema scripts first in a staging/copy database.
2. On the host PC, run a dry run after the Firestore quota reset:

```powershell
node .\scripts\import-firestore-to-sql.js
```

This creates a timestamped JSON backup and reports source counts. It does **not** write to SQL.

3. Review the backup and counts. Only with explicit approval, run:

```powershell
node .\scripts\import-firestore-to-sql.js --apply --confirm=IMPORT_SMARTROOM
```

The importer is idempotent for rooms/bookings and records each import/rejection in `dbo.FirestoreMigrationAudit`. Do not run it against production until the schema, backup, and counts have been reviewed.

## Host update procedure

1. Copy approved source changes from `portable-api` to `C:\temp\portable-api`.
2. Run any required SQL migration script in SSMS.
3. Restart the host API:

```powershell
schtasks /End /TN "SmartRoom Portable API"
schtasks /Run /TN "SmartRoom Portable API"
```

4. Check from a domain PC:

```powershell
Invoke-WebRequest https://THBTCADT-L04713.KEMET.COM/health
```

## Important operational note

Firestore free quota was exhausted because an older portable API version scanned all confirmed/no-show bookings every minute. Do not run that version again. The current source prepares an SQL email queue to avoid repeated Firestore collection scans.

## Deployment boundary

- `firebase deploy --only hosting:tokinsmartroom-495306 --project sutsmartbus-495306` deploys only the frontend.
- It does not update the host PC API or SQL schema.
- Do not deploy until the user explicitly requests it.
