const fs = require("node:fs");
const crypto = require("node:crypto");
const http = require("node:http");
const https = require("node:https");
const path = require("node:path");
const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const sql = require("mssql");
const { getConfig } = require("./config");
const { createHealthResponse } = require("./health");
const {
  ApiError,
  assertYageoEmail,
  assertBookingId,
  extractLookupUsers,
  normalizeUser,
  emailsForUser,
  toDate,
  getCheckInWindowState,
  createToken,
  hashToken,
} = require("./core");
const {
  verifyPassword,
  createSession,
  verifySession,
} = require("./admin-auth");

const config = getConfig();
const serviceAccount = JSON.parse(
  fs.readFileSync(config.serviceAccountPath, "utf8"),
);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const databaseId = process.env.FIREBASE_DATABASE_ID;
const db = databaseId ? getFirestore(databaseId) : getFirestore();
const pool = new sql.ConnectionPool(config.sql);
const requestTimes = new Map();
const adminLoginTimes = new Map();

function json(response, status, body) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(body));
}

function error(response, value) {
  const known =
    value instanceof ApiError
      ? value
      : new ApiError(500, "internal", "The mail service failed.");
  if (!(value instanceof ApiError))
    console.error("portable-api error", {
      message: value?.message,
      stack: value?.stack,
    });
  json(response, known.status, {
    success: false,
    error: { code: known.code, message: known.message },
  });
}

function requireOrigin(request, response) {
  const origin = request.headers.origin;
  if (!origin) return true;
  if (!config.allowedOrigins.includes(origin)) {
    error(
      response,
      new ApiError(
        403,
        "origin-not-allowed",
        "This website is not allowed to use the mail service.",
      ),
    );
    return false;
  }
  response.setHeader("access-control-allow-origin", origin);
  response.setHeader("vary", "Origin");
  return true;
}

async function requireFirebaseUser(request) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : "";
  if (!token)
    throw new ApiError(
      401,
      "authentication-required",
      "Sign in is required to use the mail service.",
    );
  try {
    const user = await admin.auth().verifyIdToken(token);
    if (
      user.firebase?.sign_in_provider === "anonymous" &&
      !config.allowAnonymousInternalAuth
    ) {
      throw new ApiError(
        403,
        "corporate-sign-in-required",
        "Sign in with an approved company account to use the mail service.",
      );
    }
    return user;
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    throw new ApiError(
      401,
      "invalid-authentication",
      "Your sign-in session is invalid. Please refresh and try again.",
    );
  }
}

function limit(request) {
  const key = `${request.socket.remoteAddress || "unknown"}:${new URL(request.url, "http://local").pathname}`;
  const cutoff = Date.now() - 60_000;
  const recent = (requestTimes.get(key) || []).filter((time) => time > cutoff);
  if (recent.length >= 40)
    throw new ApiError(
      429,
      "rate-limited",
      "Too many requests. Please try again shortly.",
    );
  recent.push(Date.now());
  requestTimes.set(key, recent);
}

async function body(request) {
  const chunks = [];
  for await (const chunk of request) {
    chunks.push(chunk);
    if (Buffer.concat(chunks).length > 64 * 1024)
      throw new ApiError(413, "payload-too-large", "Request is too large.");
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new ApiError(400, "invalid-json", "Request body must be valid JSON.");
  }
}

async function callFlow(flowUrl, payload, label) {
  let response;
  try {
    response = await fetch(flowUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(15_000),
    });
  } catch (cause) {
    throw new ApiError(
      503,
      `${label}-unavailable`,
      "The Power Automate flow could not be reached.",
    );
  }
  const text = await response.text().catch(() => "");
  if (!response.ok) {
    console.error("Power Automate flow rejected request", {
      label,
      status: response.status,
    });
    throw new ApiError(
      503,
      `${label}-rejected`,
      "The Power Automate flow did not accept the request.",
    );
  }
  return text;
}

async function searchMailboxes(query) {
  if (
    typeof query !== "string" ||
    query.trim().length < 2 ||
    query.trim().length > 254
  ) {
    throw new ApiError(
      400,
      "invalid-query",
      "query must be between 2 and 254 characters.",
    );
  }
  const users = extractLookupUsers(
    await callFlow(
      config.lookupFlowUrl,
      { query: query.trim() },
      "mailbox-lookup",
    ),
  );
  const seen = new Set();
  return users
    .map(normalizeUser)
    .filter((user) => {
      const key = user.mail || user.userPrincipalName;
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

async function lookupMailbox(email) {
  const normalizedEmail = assertYageoEmail(email, config.yageoDomain);
  const users = await searchMailboxes(normalizedEmail);
  const user = users.find((candidate) =>
    emailsForUser(candidate).includes(normalizedEmail),
  );
  if (!user)
    throw new ApiError(
      404,
      "mailbox-not-found",
      "No active YAGEO mailbox matched this email address.",
    );
  return { exists: true, email: normalizedEmail, user };
}

async function getAdminAccount(username) {
  if (!config.adminSessionSecret) {
    throw new ApiError(
      503,
      "admin-auth-not-configured",
      "Admin tools have not been configured on this PC.",
    );
  }
  try {
    const connection = await pool.connect();
    const result = await connection
      .request()
      .input("username", sql.NVarChar(128), username)
      .query(
        "SELECT TOP 1 Id, Username, DisplayName, Role, PasswordHash, CONVERT(nvarchar(36), SessionVersion) AS SessionVersion FROM dbo.SmartRoomAdmins WHERE Username = @username AND IsActive = 1;",
      );
    return result.recordset[0] || null;
  } catch {
    throw new ApiError(
      503,
      "admin-auth-not-configured",
      "Admin tools configuration is invalid.",
    );
  }
}

function limitAdminLogin(request, username) {
  const key = `${request.socket.remoteAddress || "unknown"}:${username}`;
  const cutoff = Date.now() - 15 * 60 * 1000;
  const recent = (adminLoginTimes.get(key) || []).filter(
    (time) => time > cutoff,
  );
  if (recent.length >= 5)
    throw new ApiError(
      429,
      "admin-login-rate-limited",
      "Too many login attempts. Please wait 15 minutes.",
    );
  recent.push(Date.now());
  adminLoginTimes.set(key, recent);
}

async function loginAdmin(request, input) {
  const username =
    typeof input.username === "string" ? input.username.trim() : "";
  const password = typeof input.password === "string" ? input.password : "";
  if (
    !/^[A-Za-z0-9_.-]{1,128}$/.test(username) ||
    !password ||
    password.length > 256
  ) {
    throw new ApiError(
      401,
      "invalid-admin-login",
      "Invalid username or password.",
    );
  }
  limitAdminLogin(request, username);
  const account = await getAdminAccount(username);
  if (
    !account ||
    !["SUPER_ADMIN", "APPROVER"].includes(account.Role) ||
    !verifyPassword(password, account.PasswordHash)
  )
    throw new ApiError(
      401,
      "invalid-admin-login",
      "Invalid username or password.",
    );
  const sessionVersion =
    typeof account.SessionVersion === "string" ? account.SessionVersion : "";
  if (!sessionVersion)
    throw new ApiError(
      503,
      "admin-auth-not-configured",
      "Admin credentials need to be initialized again on this PC.",
    );
  const user = {
    id: account.Id || username,
    username,
    role: account.Role,
    name: account.DisplayName || username,
  };
  return {
    user,
    token: createSession(
      { ...user, sessionVersion },
      config.adminSessionSecret,
      Date.now() + 8 * 60 * 60 * 1000,
    ),
  };
}

async function requireAdminSession(request) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const session = verifySession(token, config.adminSessionSecret);
  if (!session)
    throw new ApiError(
      401,
      "admin-session-required",
      "Please sign in to Admin again.",
    );
  const account = await getAdminAccount(session.username);
  if (
    !account ||
    account.Role !== session.role ||
    account.SessionVersion !== session.sessionVersion
  )
    throw new ApiError(
      401,
      "admin-session-required",
      "Please sign in to Admin again.",
    );
  return session;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function requiredText(value, name, maxLength) {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text.length > maxLength)
    throw new ApiError(400, `invalid-${name}`, `${name} is invalid.`);
  return text;
}

function optionalText(value, name, maxLength) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string")
    throw new ApiError(400, `invalid-${name}`, `${name} is invalid.`);
  const text = value.trim();
  if (text.length > maxLength)
    throw new ApiError(400, `invalid-${name}`, `${name} is invalid.`);
  return text;
}

function parseBookingTime(value, name) {
  if (typeof value !== "string" || value.length > 64) {
    throw new ApiError(
      400,
      "invalid-booking-time",
      `${name} must be a valid ISO date-time.`,
    );
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime()))
    throw new ApiError(
      400,
      "invalid-booking-time",
      `${name} must be a valid ISO date-time.`,
    );
  return date;
}

function sqlBookingFromRecord(record) {
  if (!record) return null;
  return {
    id: record.Id,
    roomId: record.RoomId,
    roomName: record.RoomName,
    title: record.Title,
    organizer: record.Organizer,
    department: record.Department,
    employeeId: record.EmployeeId,
    deskNumber: record.DeskNumber,
    email: record.Email,
    startTime: record.StartTime,
    endTime: record.EndTime,
    status: record.Status,
    verificationEmailStatus: record.VerificationEmailStatus,
    verificationEmailSentAt: record.VerificationEmailSentAt,
    createdByUid: record.CreatedByUid,
    verificationEmailScheduledAt: record.VerificationEmailScheduledAt,
    verificationWindowOpenedAt: record.VerificationWindowOpenedAt,
    verificationWindowClosedAt: record.VerificationWindowClosedAt,
    verificationTokenHash: record.VerificationTokenHash,
    verificationTokenUsedHash: record.VerificationTokenUsedHash,
    verificationTokenExpiresAt: record.VerificationTokenExpiresAt,
    actualStartTime: record.ActualStartTime,
  };
}

function toIsoDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toDateOnly(value) {
  if (!value) return null;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value))
    return value;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
}

function parseDateFilter(value, name) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new ApiError(
      400,
      `invalid-${name}`,
      `${name} must be a valid ISO date or date-time.`,
    );
  }
  return date;
}

function sqlBookingAvailabilityForClient(record) {
  return {
    id: record.Id,
    roomId: record.RoomId,
    title: record.Title,
    organizer: record.Organizer,
    department: record.Department,
    startTime: toIsoDate(record.StartTime),
    endTime: toIsoDate(record.EndTime),
    status: record.Status,
    verificationEmailStatus: record.VerificationEmailStatus || undefined,
    verificationEmailScheduledAt: toIsoDate(
      record.VerificationEmailScheduledAt,
    ),
    verificationWindowOpenedAt: toIsoDate(record.VerificationWindowOpenedAt),
    verificationWindowClosedAt: toIsoDate(record.VerificationWindowClosedAt),
  };
}

async function listSqlRooms() {
  const connection = await pool.connect();
  const result = await connection.request()
    .query(`SELECT r.Id, r.Name, r.RoomType, r.Capacity, r.ImageUrl,
      r.IsClosed, r.ClosureReason, r.ClosureStartDate, r.ClosureEndDate, r.ClosureStartTime, r.ClosureEndTime,
      a.Amenity
    FROM dbo.Rooms AS r
    LEFT JOIN dbo.RoomAmenities AS a ON a.RoomId = r.Id
    ORDER BY r.Name ASC, a.Amenity ASC;`);
  const rooms = new Map();
  for (const record of result.recordset) {
    let room = rooms.get(record.Id);
    if (!room) {
      room = {
        id: record.Id,
        name: record.Name,
        type: record.RoomType,
        capacity: record.Capacity,
        imageUrl: record.ImageUrl || "",
        isClosed: Boolean(record.IsClosed),
        closureReason: record.ClosureReason || undefined,
        closureStartDate: toDateOnly(record.ClosureStartDate) || undefined,
        closureEndDate: toDateOnly(record.ClosureEndDate) || undefined,
        closureStartTime: record.ClosureStartTime ?? undefined,
        closureEndTime: record.ClosureEndTime ?? undefined,
        amenities: [],
      };
      rooms.set(record.Id, room);
    }
    if (record.Amenity) room.amenities.push(record.Amenity);
  }
  return [...rooms.values()];
}

async function listSqlBookings(from, end) {
  const connection = await pool.connect();
  const query = `SELECT Id, RoomId, Title, Organizer, Department, StartTime, EndTime, Status,
      VerificationEmailStatus, VerificationEmailScheduledAt,
      VerificationWindowOpenedAt, VerificationWindowClosedAt
    FROM dbo.Bookings
    WHERE (@from IS NULL OR EndTime >= @from)
      AND (@end IS NULL OR StartTime <= @end)
    ORDER BY StartTime ASC, Id ASC;`;
  const result = await connection
    .request()
    .input("from", sql.DateTime2, from)
    .input("end", sql.DateTime2, end)
    .query(query);
  const activeBookings = result.recordset.map(sqlBookingAvailabilityForClient);
  const historyResult = await connection
    .request()
    .query("SELECT Id, Payload FROM dbo.MissedCheckInHistory ORDER BY ArchivedAt DESC;");
  const missedCheckIns = historyResult.recordset.flatMap((record) => {
    try {
      const payload = JSON.parse(record.Payload);
      const startTime = toDate(payload.startTime);
      const endTime = toDate(payload.endTime);
      if (!startTime || !endTime) return [];
      if (from && endTime < from) return [];
      if (end && startTime > end) return [];
      return [{
        id: record.Id,
        roomId: payload.roomId || "",
        title: payload.title || "",
        organizer: payload.organizer || "",
        department: payload.department || "",
        startTime: startTime.toISOString(),
        endTime: endTime.toISOString(),
        status: "MISSED_CHECK_IN",
      }];
    } catch {
      return [];
    }
  });
  return [...activeBookings, ...missedCheckIns].sort(
    (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime() || a.id.localeCompare(b.id),
  );
}

async function listSqlRoomMaintenanceHistory() {
  const connection = await pool.connect();
  const result = await connection.request()
    .query(`SELECT Id, RoomId, RoomName, Reason, StartDate, EndDate,
      StartTime, EndTime, CreatedAt
    FROM dbo.RoomMaintenanceHistory
    ORDER BY CreatedAt DESC, Id ASC;`);
  return result.recordset.map((record) => ({
    id: record.Id,
    roomId: record.RoomId,
    roomName: record.RoomName,
    reason: record.Reason,
    startDate: toDateOnly(record.StartDate),
    endDate: toDateOnly(record.EndDate),
    startTime: record.StartTime,
    endTime: record.EndTime,
    createdAt: toIsoDate(record.CreatedAt),
  }));
}

function buildVerificationMessage(bookingId, booking, verifyUrl) {
  const title = escapeHtml(booking.title || "TOKIN Smart Room booking");
  const roomName = escapeHtml(
    booking.roomName || booking.roomId || "Smart Room",
  );
  const organizer = escapeHtml(
    booking.organizer || booking.email || "Room organizer",
  );
  const start = toDate(booking.startTime);
  const end = toDate(booking.endTime);
  const bookingDate = start
    ? start.toLocaleDateString("en-GB", {
        weekday: "short",
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Bangkok",
      })
    : "Scheduled date";
  const timeRange =
    start && end
      ? `${start.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" })} - ${end.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Bangkok" })}`
      : "See your SmartRoom booking for the scheduled time";
  const safeVerifyUrl = escapeHtml(verifyUrl);
  const logoUrl = escapeHtml(
    new URL("/email-logo-white.png", config.appBaseUrl).toString(),
  );
  return `<!doctype html>
<html><body style="margin:0;padding:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;color:#172033;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;">Your room is ready. Verify your TOKIN Smart Room booking now.</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#f3f4f6;padding:28px 12px;">
    <tr><td align="center">
      <table role="presentation" width="620" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:620px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 10px 28px rgba(15,23,42,.12);">
        <tr><td style="padding:22px 30px;background:#d84f25;color:#ffffff;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
            <td style="font-size:19px;font-weight:800;letter-spacing:.2px;"><img src="${logoUrl}" width="32" height="32" alt="TOKIN Smart Room" style="display:inline-block;vertical-align:middle;margin-right:10px;border:0;outline:none;text-decoration:none;">TOKIN <span style="font-weight:400;">Smart Room</span></td>
            <td align="right" style="font-size:12px;line-height:18px;color:#fff2eb;">BOOKING TICKET<br><span style="font-size:13px;font-weight:700;color:#ffffff;">#${escapeHtml(bookingId)}</span></td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:30px 30px 20px;">
          <div style="font-size:25px;line-height:32px;font-weight:800;color:#172033;">Your booking is ready</div>
          <p style="margin:10px 0 0;font-size:15px;line-height:23px;color:#526074;">Please verify your room booking during its check-in window. This helps us keep rooms available for everyone.</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:24px;background:#fff7f3;border:1px solid #fed6c8;border-radius:14px;">
            <tr><td style="padding:19px 20px;border-bottom:1px dashed #e5a38d;">
              <div style="font-size:11px;font-weight:700;letter-spacing:.8px;color:#b54220;text-transform:uppercase;">Meeting</div>
              <div style="margin-top:5px;font-size:20px;line-height:27px;font-weight:800;color:#172033;">${title}</div>
              <div style="margin-top:6px;font-size:14px;line-height:20px;color:#5d6878;">${roomName}</div>
            </td></tr>
            <tr><td style="padding:18px 20px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>
                <td width="50%" style="padding-right:10px;border-right:1px solid #f0c7b8;vertical-align:top;"><div style="font-size:11px;font-weight:700;letter-spacing:.7px;color:#9a3412;text-transform:uppercase;">Date</div><div style="margin-top:5px;font-size:15px;font-weight:700;color:#172033;">${escapeHtml(bookingDate)}</div></td>
                <td width="50%" style="padding-left:17px;vertical-align:top;"><div style="font-size:11px;font-weight:700;letter-spacing:.7px;color:#9a3412;text-transform:uppercase;">Time</div><div style="margin-top:5px;font-size:15px;font-weight:700;color:#172033;">${escapeHtml(timeRange)}</div></td>
              </tr></table>
            </td></tr>
          </table>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin-top:20px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:12px;"><tr><td style="padding:15px 17px;font-size:13px;line-height:20px;color:#526074;"><span style="font-weight:700;color:#172033;">Booked by:</span> ${organizer}<br><span style="font-weight:700;color:#172033;">Booking ID:</span> ${escapeHtml(bookingId)}</td></tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:26px 0 18px;"><tr><td style="border-radius:9px;background:#e85d31;">
            <a href="${safeVerifyUrl}" style="display:inline-block;padding:15px 25px;font-size:16px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:9px;">Verify booking</a>
          </td></tr></table>
          <p style="margin:0;font-size:13px;line-height:20px;color:#64748b;">If the button does not open, use this link:<br><a href="${safeVerifyUrl}" style="color:#c2410c;word-break:break-all;">${safeVerifyUrl}</a></p>
        </td></tr>
        <tr><td style="padding:17px 30px;background:#172033;font-size:12px;line-height:18px;color:#d7dde8;">TOKIN Smart Room &middot; Automated booking notification<br><span style="color:#9eaabc;">Please do not reply to this email.</span></td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

async function recordAudit({
  email,
  subject,
  status,
  purpose = "Booking Verification",
  bookingId = null,
  bookingTitle = null,
  roomId = null,
  roomName = null,
  errorCode = null,
  errorMessage = null,
}) {
  const connection = await pool.connect();
  await connection
    .request()
    .input("id", sql.UniqueIdentifier, require("node:crypto").randomUUID())
    .input("email", sql.NVarChar(254), email)
    .input("subject", sql.NVarChar(500), subject)
    .input("purpose", sql.NVarChar(100), purpose)
    .input("status", sql.NVarChar(20), status)
    .input("bookingId", sql.NVarChar(128), bookingId)
    .input("bookingTitle", sql.NVarChar(500), bookingTitle)
    .input("roomId", sql.NVarChar(128), roomId)
    .input("roomName", sql.NVarChar(500), roomName)
    .input("errorCode", sql.NVarChar(100), errorCode)
    .input(
      "errorMessage",
      sql.NVarChar(1000),
      errorMessage ? String(errorMessage).slice(0, 1000) : null,
    )
    .query(
      `INSERT INTO dbo.EmailAudit (Id, RecipientEmail, Subject, Purpose, Status, RelatedBookingId, RelatedBookingTitle, RelatedRoomId, RelatedRoomName, ErrorCode, ErrorMessage) VALUES (@id, @email, @subject, @purpose, @status, @bookingId, @bookingTitle, @roomId, @roomName, @errorCode, @errorMessage);`,
    );
}

async function recordAuditBestEffort(entry) {
  try {
    await recordAudit(entry);
  } catch (cause) {
    console.error("Email audit write failed.", {
      status: entry.status,
      purpose: entry.purpose || "Booking Verification",
      message: cause instanceof Error ? cause.message : "Unknown error",
    });
  }
}

async function enqueueVerificationEmail(bookingId, scheduledAt) {
  const connection = await pool.connect();
  await connection
    .request()
    .input("bookingId", sql.NVarChar(128), bookingId)
    .input("scheduledAt", sql.DateTime2, scheduledAt)
    .query(`MERGE dbo.EmailQueue WITH (HOLDLOCK) AS target
      USING (SELECT @bookingId AS BookingId, @scheduledAt AS ScheduledAt) AS source
      ON target.BookingId = source.BookingId
      WHEN MATCHED THEN UPDATE SET ScheduledAt = source.ScheduledAt, Status = N'queued', ProcessingStartedAt = NULL, LastError = NULL, UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (BookingId, ScheduledAt, Status) VALUES (source.BookingId, source.ScheduledAt, N'queued');`);
}

async function claimDueVerificationEmails(limitValue = 20) {
  const connection = await pool.connect();
  await connection.request().query(`UPDATE dbo.EmailQueue
    SET Status = N'queued', ProcessingStartedAt = NULL, LastError = N'Email worker lease expired; delivery will be retried.', UpdatedAt = SYSUTCDATETIME()
    WHERE Status = N'processing' AND ProcessingStartedAt < DATEADD(minute, -10, SYSUTCDATETIME());`);
  const result = await connection.request().input("limit", sql.Int, limitValue)
    .query(`;WITH due AS (
      SELECT TOP (@limit) * FROM dbo.EmailQueue WITH (UPDLOCK, READPAST, ROWLOCK)
      WHERE Status = N'queued' AND ScheduledAt <= SYSUTCDATETIME()
      ORDER BY ScheduledAt ASC
    )
    UPDATE due SET Status = N'processing', ProcessingStartedAt = SYSUTCDATETIME(), AttemptCount = AttemptCount + 1, UpdatedAt = SYSUTCDATETIME()
    OUTPUT inserted.BookingId;`);
  return result.recordset.map((record) => record.BookingId);
}

async function cancelQueuedVerificationEmail(bookingId) {
  const connection = await pool.connect();
  await connection.request().input("bookingId", sql.NVarChar(128), bookingId)
    .query(`UPDATE dbo.EmailQueue SET Status = N'cancelled', LastError = N'Superseded by an admin force-send.', UpdatedAt = SYSUTCDATETIME()
      WHERE BookingId = @bookingId AND Status IN (N'queued', N'processing');`);
}

async function finishQueuedVerificationEmail(
  bookingId,
  status,
  errorMessage = null,
) {
  const connection = await pool.connect();
  await connection
    .request()
    .input("bookingId", sql.NVarChar(128), bookingId)
    .input("status", sql.NVarChar(20), status)
    .input(
      "errorMessage",
      sql.NVarChar(1000),
      errorMessage ? String(errorMessage).slice(0, 1000) : null,
    )
    .query(`UPDATE dbo.EmailQueue SET Status = @status, LastError = @errorMessage, ProcessingStartedAt = NULL, UpdatedAt = SYSUTCDATETIME()
      WHERE BookingId = @bookingId AND Status = N'processing';`);
}

async function claimImmediateVerificationEmail(bookingId) {
  const connection = await pool.connect();
  const result = await connection
    .request()
    .input("bookingId", sql.NVarChar(128), bookingId)
    .query(`MERGE dbo.EmailQueue WITH (HOLDLOCK) AS target
      USING (SELECT @bookingId AS BookingId) AS source ON target.BookingId = source.BookingId
      WHEN MATCHED AND target.Status <> N'processing' THEN UPDATE SET Status = N'processing', ScheduledAt = SYSUTCDATETIME(), ProcessingStartedAt = SYSUTCDATETIME(), AttemptCount = AttemptCount + 1, LastError = NULL, UpdatedAt = SYSUTCDATETIME()
      WHEN NOT MATCHED THEN INSERT (BookingId, ScheduledAt, Status, AttemptCount, ProcessingStartedAt) VALUES (source.BookingId, SYSUTCDATETIME(), N'processing', 1, SYSUTCDATETIME())
      OUTPUT inserted.BookingId;`);
  if (!result.recordset.length)
    throw new ApiError(
      409,
      "verification-email-in-progress",
      "A verification email is already being sent. Please wait before retrying.",
    );
}

async function loadSqlBooking(bookingId) {
  const connection = await pool.connect();
  const result = await connection
    .request()
    .input("bookingId", sql.NVarChar(128), bookingId)
    .query(`SELECT TOP 1 b.*, r.Name AS RoomName
      FROM dbo.Bookings AS b
      LEFT JOIN dbo.Rooms AS r ON r.Id = b.RoomId
      WHERE b.Id = @bookingId;`);
  return sqlBookingFromRecord(result.recordset[0]);
}

async function createSqlBooking(input, requesterUid) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new ApiError(400, "invalid-booking", "Booking details are invalid.");
  }
  const id =
    input.id === undefined || input.id === null
      ? require("node:crypto").randomUUID()
      : assertBookingId(input.id);
  const roomId = assertBookingId(input.roomId);
  const title = requiredText(input.title, "title", 200);
  const organizer = requiredText(input.organizer, "organizer", 100);
  const email = assertYageoEmail(input.email, config.yageoDomain);
  const department = optionalText(input.department, "department", 120);
  const employeeId = optionalText(input.employeeId, "employee-id", 60);
  const deskNumber = optionalText(input.deskNumber, "desk-number", 60);
  const emailDisplayName = optionalText(
    input.emailDisplayName,
    "email-display-name",
    200,
  );
  const emailJobTitle = optionalText(
    input.emailJobTitle,
    "email-job-title",
    200,
  );
  const emailDepartment = optionalText(
    input.emailDepartment,
    "email-department",
    200,
  );
  const startTime = parseBookingTime(input.startTime, "startTime");
  const endTime = parseBookingTime(input.endTime, "endTime");
  if (endTime <= startTime)
    throw new ApiError(400, "invalid-booking-time", "Booking time is invalid.");
  const bookingWindow = getCheckInWindowState({ startTime, endTime });
  if (bookingWindow.state === "invalid" || bookingWindow.state === "expired")
    throw new ApiError(
      412,
      "invalid-booking-time",
      "Booking time is no longer available.",
    );
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const request = transaction.request();
    const room = await request
      .input("roomId", sql.NVarChar(128), roomId)
      .query(
        "SELECT TOP 1 Id FROM dbo.Rooms WITH (UPDLOCK, HOLDLOCK) WHERE Id = @roomId;",
      );
    if (!room.recordset.length)
      throw new ApiError(
        404,
        "room-not-found",
        "The selected room does not exist.",
      );
    const overlap = await request
      .input("startTime", sql.DateTime2, startTime)
      .input("endTime", sql.DateTime2, endTime)
      .query(`SELECT TOP 1 Id FROM dbo.Bookings WITH (UPDLOCK, HOLDLOCK)
        WHERE RoomId = @roomId
          AND Status NOT IN (N'REJECTED', N'NO_SHOW')
          AND NOT (Status = N'CONFIRMED' AND ActualStartTime IS NULL AND DATEADD(minute, 15, StartTime) < SYSUTCDATETIME())
          AND StartTime < @endTime AND EndTime > @startTime;`);
    if (overlap.recordset.length)
      throw new ApiError(
        409,
        "booking-conflict",
        "This room is already booked for the selected time.",
      );
    const scheduledAt = bookingWindow.window.opensAt;
    await transaction
      .request()
      .input("id", sql.NVarChar(128), id)
      .input("roomId", sql.NVarChar(128), roomId)
      .input("title", sql.NVarChar(200), title)
      .input("organizer", sql.NVarChar(100), organizer)
      .input("department", sql.NVarChar(120), department)
      .input("employeeId", sql.NVarChar(60), employeeId)
      .input("deskNumber", sql.NVarChar(60), deskNumber)
      .input("email", sql.NVarChar(254), email)
      .input("displayName", sql.NVarChar(200), emailDisplayName)
      .input("jobTitle", sql.NVarChar(200), emailJobTitle)
      .input("emailDepartment", sql.NVarChar(200), emailDepartment)
      .input("createdByUid", sql.NVarChar(128), requesterUid)
      .input("startTime", sql.DateTime2, startTime)
      .input("endTime", sql.DateTime2, endTime)
      .input("scheduledAt", sql.DateTime2, scheduledAt)
      .input("closedAt", sql.DateTime2, bookingWindow.window.closesAt)
      .query(`INSERT INTO dbo.Bookings (Id, RoomId, Title, Organizer, Department, EmployeeId, DeskNumber, Email, EmailDisplayName, EmailJobTitle, EmailDepartment, CreatedByUid, StartTime, EndTime, VerificationEmailStatus, VerificationEmailScheduledAt, VerificationWindowOpenedAt, VerificationWindowClosedAt, VerificationTokenHash, VerificationTokenCreatedAt, VerificationTokenExpiresAt)
        VALUES (@id, @roomId, @title, @organizer, @department, @employeeId, @deskNumber, @email, @displayName, @jobTitle, @emailDepartment, @createdByUid, @startTime, @endTime, N'queued', @scheduledAt, @scheduledAt, @closedAt, NULL, NULL, NULL);`);
    await transaction
      .request()
      .input("bookingId", sql.NVarChar(128), id)
      .input("scheduledAt", sql.DateTime2, scheduledAt)
      .query(`INSERT INTO dbo.EmailQueue (BookingId, ScheduledAt, Status)
        VALUES (@bookingId, @scheduledAt, N'queued');`);
    await transaction.commit();
  } catch (cause) {
    await transaction.rollback().catch(() => undefined);
    throw cause;
  }
  return {
    booking: {
      id,
      roomId,
      title,
      organizer,
      department,
      employeeId,
      deskNumber,
      email,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      status: "CONFIRMED",
      verificationEmailStatus: "queued",
    },
    status: "queued",
    scheduledAt: bookingWindow.window.opensAt.toISOString(),
  };
}

async function deliverBookingEmail(bookingId, booking) {
  const email = assertYageoEmail(booking.email, config.yageoDomain);
  const subject = `[TOKIN Smart Room] Verify booking ${bookingId}`;
  const verifyUrl = booking.verifyUrl;
  if (!verifyUrl)
    throw new ApiError(
      412,
      "missing-verification-url",
      "Booking verification URL is missing.",
    );
  const message = buildVerificationMessage(bookingId, booking, verifyUrl);
  const payload = {
    to: email,
    email,
    recipient: email,
    recipientEmail: email,
    To: email,
    Email: email,
    RecipientEmail: email,
    subject,
    Subject: subject,
    body: message,
    html: message,
    message,
    Body: message,
    Html: message,
    Message: message,
    senderName: "TOKIN Smart Room",
  };
  try {
    await callFlow(config.emailFlowUrl, payload, "email");
  } catch (cause) {
    try {
      await db.collection("bookings").doc(bookingId).update({
        verificationEmailStatus: "failed",
        verificationEmailFailedAt: FieldValue.serverTimestamp(),
      });
    } catch (statusCause) {
      console.error("Booking email failure status update failed.", {
        bookingId,
        message:
          statusCause instanceof Error ? statusCause.message : "Unknown error",
      });
    }
    await recordAuditBestEffort({
      email,
      subject,
      status: "failed",
      bookingId,
      bookingTitle: booking.title || "",
      roomId: booking.roomId || "",
      roomName: booking.roomName || "",
      errorCode: cause.code || "internal",
      errorMessage: cause.message,
    });
    throw cause;
  }
  try {
    await db.collection("bookings").doc(bookingId).update({
      verificationEmailStatus: "sent",
      verificationEmailSentAt: FieldValue.serverTimestamp(),
    });
  } catch (cause) {
    console.error(
      "Booking email was delivered but Firestore status update failed.",
      {
        bookingId,
        message: cause instanceof Error ? cause.message : "Unknown error",
      },
    );
    await recordAuditBestEffort({
      email,
      subject,
      status: "successful",
      bookingId,
      bookingTitle: booking.title || "",
      roomId: booking.roomId || "",
      roomName: booking.roomName || "",
    });
    return { statusSyncPending: true };
  }
  await recordAuditBestEffort({
    email,
    subject,
    status: "successful",
    bookingId,
    bookingTitle: booking.title || "",
    roomId: booking.roomId || "",
    roomName: booking.roomName || "",
  });
  return { statusSyncPending: false };
}

async function deliverSqlBookingEmail(bookingId, booking) {
  const email = assertYageoEmail(booking.email, config.yageoDomain);
  const subject = `[TOKIN Smart Room] Verify booking ${bookingId}`;
  const token = createToken();
  const verifyUrl = new URL("/verify", config.appBaseUrl);
  verifyUrl.searchParams.set("bookingId", bookingId);
  verifyUrl.searchParams.set("token", token);
  const message = buildVerificationMessage(
    bookingId,
    booking,
    verifyUrl.toString(),
  );
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await acquireBookingTransactionLock(transaction, bookingId);
    const claimed = await transaction
      .request()
      .input("bookingId", sql.NVarChar(128), bookingId)
      .input("tokenHash", sql.Char(64), hashToken(token))
      .input("tokenExpiresAt", sql.DateTime2, booking.endTime)
      .query(`UPDATE dbo.Bookings
        SET VerificationTokenHash = @tokenHash, VerificationTokenCreatedAt = SYSUTCDATETIME(),
            VerificationTokenExpiresAt = @tokenExpiresAt, VerificationEmailStatus = N'sending',
            VerificationEmailFailedAt = NULL, UpdatedAt = SYSUTCDATETIME()
        WHERE Id = @bookingId AND Status = N'CONFIRMED' AND ActualStartTime IS NULL;
        SELECT @@ROWCOUNT AS UpdatedCount;`);
    if ((claimed.recordset[0]?.UpdatedCount || 0) !== 1) {
      throw new ApiError(
        410,
        "booking-not-active",
        "Booking no longer exists or is no longer eligible for verification email.",
      );
    }
    await callFlow(
      config.emailFlowUrl,
      {
        to: email,
        email,
        recipient: email,
        recipientEmail: email,
        To: email,
        Email: email,
        RecipientEmail: email,
        subject,
        Subject: subject,
        body: message,
        html: message,
        message,
        Body: message,
        Html: message,
        Message: message,
        senderName: "TOKIN Smart Room",
      },
      "email",
    );
  } catch (cause) {
    const errorMessage =
      cause instanceof Error ? cause.message : "Email delivery failed.";
    await transaction.rollback().catch(() => undefined);
    await recordAuditBestEffort({
      email,
      subject,
      status: "failed",
      bookingId,
      bookingTitle: booking.title || "",
      roomId: booking.roomId || "",
      errorCode: cause instanceof ApiError ? cause.code : "internal",
      errorMessage,
    });
    throw cause;
  }
  try {
    await transaction
      .request()
      .input("bookingId", sql.NVarChar(128), bookingId)
      .query(
        `UPDATE dbo.Bookings SET VerificationEmailStatus = N'sent', VerificationEmailSentAt = SYSUTCDATETIME(), UpdatedAt = SYSUTCDATETIME() WHERE Id = @bookingId;`,
      );
    await transaction.commit();
  } catch (cause) {
    await transaction.rollback().catch(() => undefined);
    throw cause;
  }
  await recordAuditBestEffort({
    email,
    subject,
    status: "successful",
    bookingId,
    bookingTitle: booking.title || "",
    roomId: booking.roomId || "",
  });
}

async function queueOrSendBookingEmail(input, requesterUid) {
  const bookingId =
    typeof input.bookingId === "string" &&
    /^[A-Za-z0-9_-]{1,128}$/.test(input.bookingId)
      ? input.bookingId
      : "";
  if (!bookingId)
    throw new ApiError(400, "invalid-booking-id", "bookingId is invalid.");
  const email = assertYageoEmail(input.email, config.yageoDomain);
  const booking = await loadSqlBooking(bookingId);
  if (!booking)
    throw new ApiError(404, "booking-not-found", "Booking was not found.");
  if (!booking.createdByUid || booking.createdByUid !== requesterUid)
    throw new ApiError(
      403,
      "booking-owner-required",
      "Only the booking requester can send its verification email.",
    );
  if (
    ["REJECTED", "NO_SHOW", "MISSED_CHECK_IN", "VERIFIED"].includes(
      booking.status,
    ) ||
    booking.actualStartTime
  ) {
    throw new ApiError(
      412,
      "booking-not-active",
      "Only active bookings can receive verification email.",
    );
  }
  const lastSentAt = toDate(booking.verificationEmailSentAt);
  if (lastSentAt && Date.now() - lastSentAt.getTime() < 2 * 60 * 1000)
    throw new ApiError(
      429,
      "resend-cooldown",
      "Verification email was sent recently. Please wait before retrying.",
    );
  if (booking.email?.toLowerCase() !== email)
    throw new ApiError(
      403,
      "email-mismatch",
      "Verification email must match the booking email.",
    );
  const windowState = getCheckInWindowState(booking);
  if (windowState.state === "invalid")
    throw new ApiError(
      412,
      "invalid-booking-time",
      "Booking start time is invalid.",
    );
  if (windowState.state === "expired")
    throw new ApiError(
      410,
      "check-in-expired",
      "The check-in window has expired.",
    );
  if (windowState.state === "active") {
    await claimImmediateVerificationEmail(bookingId);
    try {
      await deliverSqlBookingEmail(bookingId, booking);
      await finishQueuedVerificationEmail(bookingId, "sent");
    } catch (cause) {
      await finishQueuedVerificationEmail(
        bookingId,
        "failed",
        cause instanceof Error ? cause.message : "Email delivery failed.",
      );
      throw cause;
    }
    return { bookingId, status: "sent", sentAt: new Date().toISOString() };
  }
  try {
    await enqueueVerificationEmail(bookingId, windowState.window.opensAt);
  } catch {
    throw new ApiError(
      503,
      "email-queue-unavailable",
      "The email queue is not available. Please contact an administrator.",
    );
  }
  return {
    bookingId,
    status: "queued",
    scheduledAt: windowState.window.opensAt.toISOString(),
    windowStart: windowState.window.opensAt.toISOString(),
    windowEnd: windowState.window.closesAt.toISOString(),
  };
}

async function sendAdminTestEmail(email, username) {
  const recipient = assertYageoEmail(email, config.yageoDomain);
  const subject = "[TOKIN Smart Room] Internal email test";
  const message = `<div style="font-family:Arial,sans-serif"><h2>TOKIN Smart Room</h2><p>This message confirms that the internal email tool can reach Power Automate.</p><p><strong>Requested by:</strong> ${escapeHtml(username)}</p></div>`;
  try {
    await callFlow(
      config.emailFlowUrl,
      {
        to: recipient,
        email: recipient,
        recipient: recipient,
        subject,
        Subject: subject,
        message,
        body: message,
        html: message,
        senderName: "TOKIN Smart Room",
      },
      "email",
    );
  } catch (cause) {
    await recordAuditBestEffort({
      email: recipient,
      subject,
      status: "failed",
      purpose: "Internal Email Test",
      errorCode: cause.code || "internal",
      errorMessage: cause.message,
    });
    throw cause;
  }
  await recordAuditBestEffort({
    email: recipient,
    subject,
    status: "successful",
    purpose: "Internal Email Test",
  });
  return { email: recipient, status: "sent" };
}

async function forceSendBookingEmail(bookingId, username) {
  const id = assertBookingId(bookingId);
  const transaction = new sql.Transaction(pool);
  let bookingForDelivery;
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const result = await transaction
      .request()
      .input("bookingId", sql.NVarChar(128), id)
      .query(`SELECT TOP 1 b.*, r.Name AS RoomName
        FROM dbo.Bookings AS b WITH (UPDLOCK, HOLDLOCK)
        LEFT JOIN dbo.Rooms AS r ON r.Id = b.RoomId
        WHERE b.Id = @bookingId;`);
    const booking = sqlBookingFromRecord(result.recordset[0]);
    if (!booking)
      throw new ApiError(404, "booking-not-found", "Booking was not found.");
    if (booking.status !== "CONFIRMED" || booking.actualStartTime)
      throw new ApiError(
        412,
        "booking-not-active",
        "Only confirmed bookings that have not started can be force-sent.",
      );
    const windowState = getCheckInWindowState(booking);
    if (windowState.state === "invalid")
      throw new ApiError(
        412,
        "invalid-booking-time",
        "Booking start time is invalid.",
      );
    if (windowState.state === "expired")
      throw new ApiError(
        410,
        "check-in-expired",
        "The check-in window has expired.",
      );
    const email = assertYageoEmail(booking.email, config.yageoDomain);
    bookingForDelivery = { ...booking, email };
    await transaction.commit();
  } catch (cause) {
    await transaction.rollback().catch(() => undefined);
    throw cause;
  }
  await cancelQueuedVerificationEmail(id);
  await deliverSqlBookingEmail(id, bookingForDelivery);
  return { bookingId: id, status: "sent", forced: true };
}

async function updateBookingVerificationStatus(input) {
  const status =
    typeof input.targetStatus === "string" ? input.targetStatus : "";
  if (!["CONFIRMED", "VERIFIED", "NO_SHOW"].includes(status))
    throw new ApiError(400, "invalid-status", "Target status is invalid.");
  const allBookings = input.allBookings === true;
  const bookingIds = Array.isArray(input.bookingIds)
    ? [...new Set(input.bookingIds.map(assertBookingId))]
    : [];
  if (!allBookings && bookingIds.length === 0)
    throw new ApiError(400, "booking-required", "Select at least one booking.");
  const connection = await pool.connect();
  const idParameters = bookingIds.map((_, index) => `@id${index}`);
  const addIdParameters = (request) =>
    bookingIds.reduce(
      (next, id, index) => next.input(`id${index}`, sql.NVarChar(128), id),
      request,
    );
  const where = allBookings ? "" : ` WHERE Id IN (${idParameters.join(", ")})`;
  const existing = allBookings
    ? null
    : await addIdParameters(connection.request()).query(
        `SELECT Id FROM dbo.Bookings${where};`,
      );
  const existingIds = new Set(
    (existing?.recordset || []).map((record) => record.Id),
  );
  const missingIds = allBookings
    ? []
    : bookingIds.filter((id) => !existingIds.has(id));
  const update =
    status === "VERIFIED"
      ? `Status = N'VERIFIED', VerifiedAt = SYSUTCDATETIME(), ActualStartTime = SYSUTCDATETIME(), VerificationTokenHash = NULL, VerificationTokenCreatedAt = NULL, VerificationTokenExpiresAt = NULL, UpdatedAt = SYSUTCDATETIME()`
      : status === "NO_SHOW"
        ? `Status = N'NO_SHOW', VerifiedAt = NULL, ActualStartTime = NULL, VerificationTokenHash = NULL, VerificationTokenCreatedAt = NULL, VerificationTokenExpiresAt = NULL, UpdatedAt = SYSUTCDATETIME()`
        : `Status = N'CONFIRMED', VerifiedAt = NULL, ActualStartTime = NULL, UpdatedAt = SYSUTCDATETIME()`;
  const result = await addIdParameters(connection.request()).query(
    `UPDATE dbo.Bookings SET ${update}${where}; SELECT @@ROWCOUNT AS UpdatedCount;`,
  );
  return { updatedCount: result.recordset[0]?.UpdatedCount || 0, missingIds };
}

function assertSafeId(value, name, maxLength = 128) {
  const id = typeof value === "string" ? value.trim() : "";
  if (!new RegExp(`^[A-Za-z0-9_-]{1,${maxLength}}$`).test(id)) {
    throw new ApiError(400, `invalid-${name}`, `${name} is invalid.`);
  }
  return id;
}

function assertRoomImageUrl(value) {
  const imageUrl = optionalText(value, "room-image-url", 1_000_000);
  if (!imageUrl) return "";
  if (
    !/^https?:\/\/\S{1,999980}$/i.test(imageUrl) &&
    !/^data:image\/(jpeg|jpg|png|webp);base64,[a-z0-9+/=\s]+$/i.test(imageUrl)
  ) {
    throw new ApiError(
      400,
      "invalid-room-image-url",
      "room image URL is invalid.",
    );
  }
  return imageUrl;
}

function parseRoomDate(value, name, required) {
  const date = optionalText(value, name, 10);
  if (!date && !required) return null;
  const parsed = new Date(`${date}T00:00:00Z`);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
  ) {
    throw new ApiError(400, `invalid-${name}`, `${name} is invalid.`);
  }
  return date;
}

function parseRoomHour(value, name, fallback) {
  const hour =
    value === undefined || value === null || value === ""
      ? fallback
      : Number(value);
  if (!Number.isInteger(hour) || hour < 0 || hour > 24)
    throw new ApiError(400, `invalid-${name}`, `${name} is invalid.`);
  return hour;
}

function sanitizeAdminRoom(input) {
  const room = input && typeof input === "object" ? input : null;
  if (!room) throw new ApiError(400, "invalid-room", "room is required.");
  const id = assertSafeId(room.id, "room-id");
  const name = requiredText(room.name, "room-name", 200);
  const type = requiredText(room.type, "room-type", 80);
  if (!["Meeting Room", "Reception Area", "Training Room"].includes(type))
    throw new ApiError(400, "invalid-room-type", "room type is invalid.");
  const capacity = Number(room.capacity);
  if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000)
    throw new ApiError(
      400,
      "invalid-room-capacity",
      "room capacity is invalid.",
    );
  if (!Array.isArray(room.amenities) || room.amenities.length > 20)
    throw new ApiError(
      400,
      "invalid-room-amenities",
      "room amenities are invalid.",
    );
  const amenities = [
    ...new Set(
      room.amenities.map((amenity) =>
        requiredText(amenity, "room-amenity", 100),
      ),
    ),
  ];
  const isClosed = room.isClosed === true;
  const closureStartDate = parseRoomDate(
    room.closureStartDate,
    "closure-start-date",
    isClosed,
  );
  const closureEndDate = parseRoomDate(
    room.closureEndDate,
    "closure-end-date",
    isClosed,
  );
  const closureStartTime = parseRoomHour(
    room.closureStartTime,
    "closure-start-time",
    7,
  );
  const closureEndTime = parseRoomHour(
    room.closureEndTime,
    "closure-end-time",
    19,
  );
  if (
    closureEndTime <= closureStartTime ||
    (isClosed && closureEndDate < closureStartDate)
  )
    throw new ApiError(
      400,
      "invalid-room-closure",
      "room closure range is invalid.",
    );
  return {
    id,
    name,
    type,
    capacity,
    amenities,
    imageUrl: assertRoomImageUrl(room.imageUrl),
    isClosed,
    closureReason: optionalText(room.closureReason, "closure-reason", 200),
    closureStartDate,
    closureEndDate,
    closureStartTime,
    closureEndTime,
  };
}

function sanitizeMaintenanceRecord(input, room) {
  if (input === null || input === undefined) return null;
  if (typeof input !== "object")
    throw new ApiError(
      400,
      "invalid-maintenance-record",
      "maintenance record is invalid.",
    );
  const id = assertSafeId(input.id, "maintenance-record-id", 180);
  const roomId = assertSafeId(input.roomId || room.id, "maintenance-room-id");
  if (roomId !== room.id)
    throw new ApiError(
      400,
      "invalid-maintenance-room",
      "maintenance record must belong to this room.",
    );
  const startDate = parseRoomDate(
    input.startDate,
    "maintenance-start-date",
    true,
  );
  const endDate = parseRoomDate(input.endDate, "maintenance-end-date", true);
  const startTime = parseRoomHour(
    input.startTime,
    "maintenance-start-time",
    -1,
  );
  const endTime = parseRoomHour(input.endTime, "maintenance-end-time", -1);
  if (endDate < startDate || endTime <= startTime)
    throw new ApiError(
      400,
      "invalid-maintenance-range",
      "maintenance range is invalid.",
    );
  return {
    id,
    roomId,
    roomName: optionalText(
      input.roomName || room.name,
      "maintenance-room-name",
      200,
    ),
    reason: requiredText(input.reason, "maintenance-reason", 200),
    startDate,
    endDate,
    startTime,
    endTime,
  };
}

async function saveSqlRoom(input) {
  const room = sanitizeAdminRoom(input.room);
  const maintenance = sanitizeMaintenanceRecord(input.maintenanceRecord, room);
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await transaction
      .request()
      .input("id", sql.NVarChar(128), room.id)
      .input("name", sql.NVarChar(200), room.name)
      .input("type", sql.NVarChar(80), room.type)
      .input("capacity", sql.Int, room.capacity)
      .input("imageUrl", sql.NVarChar(sql.MAX), room.imageUrl)
      .input("isClosed", sql.Bit, room.isClosed)
      .input("reason", sql.NVarChar(200), room.closureReason || null)
      .input(
        "startDate",
        sql.Date,
        room.isClosed ? room.closureStartDate : null,
      )
      .input("endDate", sql.Date, room.isClosed ? room.closureEndDate : null)
      .input("startTime", sql.Int, room.isClosed ? room.closureStartTime : null)
      .input("endTime", sql.Int, room.isClosed ? room.closureEndTime : null)
      .query(`MERGE dbo.Rooms WITH (HOLDLOCK) AS target USING (SELECT @id AS Id) AS source ON target.Id = source.Id
        WHEN MATCHED THEN UPDATE SET Name=@name, RoomType=@type, Capacity=@capacity, ImageUrl=@imageUrl, IsClosed=@isClosed, ClosureReason=@reason, ClosureStartDate=@startDate, ClosureEndDate=@endDate, ClosureStartTime=@startTime, ClosureEndTime=@endTime, UpdatedAt=SYSUTCDATETIME()
        WHEN NOT MATCHED THEN INSERT (Id, Name, RoomType, Capacity, ImageUrl, IsClosed, ClosureReason, ClosureStartDate, ClosureEndDate, ClosureStartTime, ClosureEndTime) VALUES (@id, @name, @type, @capacity, @imageUrl, @isClosed, @reason, @startDate, @endDate, @startTime, @endTime);`);
    await transaction
      .request()
      .input("roomId", sql.NVarChar(128), room.id)
      .query("DELETE FROM dbo.RoomAmenities WHERE RoomId = @roomId;");
    for (const amenity of room.amenities)
      await transaction
        .request()
        .input("roomId", sql.NVarChar(128), room.id)
        .input("amenity", sql.NVarChar(200), amenity)
        .query(
          "INSERT INTO dbo.RoomAmenities (RoomId, Amenity) VALUES (@roomId, @amenity);",
        );
    if (maintenance)
      await transaction
        .request()
        .input("id", sql.NVarChar(180), maintenance.id)
        .input("roomId", sql.NVarChar(128), maintenance.roomId)
        .input("roomName", sql.NVarChar(200), maintenance.roomName)
        .input("reason", sql.NVarChar(200), maintenance.reason)
        .input("startDate", sql.Date, maintenance.startDate)
        .input("endDate", sql.Date, maintenance.endDate)
        .input("startTime", sql.Int, maintenance.startTime)
        .input("endTime", sql.Int, maintenance.endTime)
        .query(`MERGE dbo.RoomMaintenanceHistory WITH (HOLDLOCK) AS target USING (SELECT @id AS Id) AS source ON target.Id = source.Id
        WHEN MATCHED THEN UPDATE SET RoomId=@roomId, RoomName=@roomName, Reason=@reason, StartDate=@startDate, EndDate=@endDate, StartTime=@startTime, EndTime=@endTime
        WHEN NOT MATCHED THEN INSERT (Id, RoomId, RoomName, Reason, StartDate, EndDate, StartTime, EndTime) VALUES (@id, @roomId, @roomName, @reason, @startDate, @endDate, @startTime, @endTime);`);
    await transaction.commit();
  } catch (cause) {
    await transaction.rollback().catch(() => undefined);
    throw cause;
  }
  return {
    roomId: room.id,
    saved: true,
    maintenanceRecordId: maintenance?.id || null,
  };
}

async function deleteSqlRoom(input) {
  const roomId = assertSafeId(input.roomId, "room-id");
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const existing = await transaction
      .request()
      .input("roomId", sql.NVarChar(128), roomId)
      .query(
        "SELECT TOP 1 Id FROM dbo.Rooms WITH (UPDLOCK, HOLDLOCK) WHERE Id = @roomId;",
      );
    if (!existing.recordset.length)
      throw new ApiError(404, "room-not-found", "Room was not found.");
    await transaction
      .request()
      .input("roomId", sql.NVarChar(128), roomId)
      .query(
        "DELETE FROM dbo.EmailQueue WHERE BookingId IN (SELECT Id FROM dbo.Bookings WHERE RoomId = @roomId);",
      );
    const deletedBookings = await transaction
      .request()
      .input("roomId", sql.NVarChar(128), roomId)
      .query(
        "DELETE FROM dbo.Bookings WHERE RoomId = @roomId; SELECT @@ROWCOUNT AS DeletedCount;",
      );
    await transaction
      .request()
      .input("roomId", sql.NVarChar(128), roomId)
      .query(
        "DELETE FROM dbo.RoomAmenities WHERE RoomId = @roomId; DELETE FROM dbo.Rooms WHERE Id = @roomId;",
      );
    await transaction.commit();
    return {
      roomId,
      deleted: true,
      deletedRelatedBookings: deletedBookings.recordset[0]?.DeletedCount || 0,
    };
  } catch (cause) {
    await transaction.rollback().catch(() => undefined);
    throw cause;
  }
}

async function acquireBookingTransactionLock(transaction, bookingId) {
  const result = await transaction
    .request()
    .input("lockResource", sql.NVarChar(255), `smartroom-booking:${bookingId}`)
    .query(`DECLARE @result int;
      EXEC @result = sp_getapplock @Resource = @lockResource, @LockMode = 'Exclusive', @LockOwner = 'Transaction', @LockTimeout = 15000;
      SELECT @result AS Result;`);
  if ((result.recordset[0]?.Result ?? -999) < 0) {
    throw new ApiError(
      409,
      "booking-operation-in-progress",
      "This booking is currently being updated. Please try again.",
    );
  }
}

async function deleteSqlBooking(input) {
  const bookingId = assertBookingId(input.bookingId);
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    await acquireBookingTransactionLock(transaction, bookingId);
    const existing = await transaction
      .request()
      .input("bookingId", sql.NVarChar(128), bookingId)
      .query(
        "SELECT TOP 1 Id FROM dbo.Bookings WITH (UPDLOCK, HOLDLOCK) WHERE Id = @bookingId;",
      );
    if (!existing.recordset.length)
      throw new ApiError(404, "booking-not-found", "Booking was not found.");

    const deletedQueue = await transaction
      .request()
      .input("bookingId", sql.NVarChar(128), bookingId)
      .query(
        "DELETE FROM dbo.EmailQueue WHERE BookingId = @bookingId; SELECT @@ROWCOUNT AS DeletedCount;",
      );
    await transaction
      .request()
      .input("bookingId", sql.NVarChar(128), bookingId)
      .query("DELETE FROM dbo.Bookings WHERE Id = @bookingId;");

    await transaction.commit();
    return {
      bookingId,
      deleted: true,
      deletedQueuedVerificationEmail:
        (deletedQueue.recordset[0]?.DeletedCount || 0) > 0,
    };
  } catch (cause) {
    await transaction.rollback().catch(() => undefined);
    throw cause;
  }
}

async function runAdminTool(session, input) {
  const tool = typeof input.tool === "string" ? input.tool : "";
  const payload =
    input.payload && typeof input.payload === "object" ? input.payload : {};
  const requireSuperAdmin = () => {
    if (session.role !== "SUPER_ADMIN")
      throw new ApiError(
        403,
        "admin-role-required",
        "Only super admins can run this administrative action.",
      );
  };
  if (tool === "send_test_email") {
    requireSuperAdmin();
    return sendAdminTestEmail(payload.email, session.username);
  }
  if (tool === "force_send_booking_email") {
    requireSuperAdmin();
    return forceSendBookingEmail(payload.bookingId, session.username);
  }
  if (tool === "update_booking_verify_status") {
    if (payload.allBookings === true) requireSuperAdmin();
    return updateBookingVerificationStatus(payload);
  }
  if (
    tool === "save_room" ||
    tool === "save_room_as_admin" ||
    tool === "save_room_maintenance"
  ) {
    if (session.role !== "SUPER_ADMIN")
      throw new ApiError(
        403,
        "admin-role-required",
        "Only super admins can manage rooms.",
      );
    return saveSqlRoom(payload);
  }
  if (tool === "delete_room" || tool === "delete_room_as_admin") {
    if (session.role !== "SUPER_ADMIN")
      throw new ApiError(
        403,
        "admin-role-required",
        "Only super admins can manage rooms.",
      );
    return deleteSqlRoom(payload);
  }
  if (tool === "delete_booking" || tool === "delete_booking_as_admin") {
    requireSuperAdmin();
    return deleteSqlBooking(payload);
  }
  throw new ApiError(
    400,
    "unsupported-admin-tool",
    "This admin tool has not been migrated yet.",
  );
}

async function listAdminEmailHistory(limitValue) {
  const limit = Number.isInteger(limitValue)
    ? Math.min(Math.max(limitValue, 1), 200)
    : 200;
  const connection = await pool.connect();
  const result = await connection
    .request()
    .input("limit", sql.Int, limit)
    .query(
      "SELECT TOP (@limit) Id, RecipientEmail, Subject, Purpose, Status, RelatedBookingId, RelatedBookingTitle, RelatedRoomId, RelatedRoomName, ErrorCode, ErrorMessage, CreatedAt FROM dbo.EmailAudit ORDER BY CreatedAt DESC;",
    );
  return result.recordset.map((record) => ({
    id: String(record.Id),
    recipientEmail: record.RecipientEmail,
    recipientName: "",
    subject: record.Subject,
    purpose: record.Purpose,
    sentAt: record.CreatedAt,
    status: record.Status,
    relatedBookingId: record.RelatedBookingId || "",
    relatedBookingTitle: record.RelatedBookingTitle || "",
    relatedRoomId: record.RelatedRoomId || "",
    relatedRoomName: record.RelatedRoomName || "",
    errorCode: record.ErrorCode || "",
    errorMessage: record.ErrorMessage || "",
    createdAt: record.CreatedAt,
  }));
}

function missedCheckInArchive(bookingId, booking) {
  return {
    ...booking,
    id: bookingId,
    originalBookingId: bookingId,
    originalStatus: booking.status || "",
    status: "MISSED_CHECK_IN",
    missedCheckInAt: new Date().toISOString(),
    archivedAt: new Date().toISOString(),
    archivedReason: "Missed check-in window",
    archivedFromPath: `bookings/${bookingId}`,
    createdAt: booking.createdAt || new Date().toISOString(),
  };
}

async function archiveExpiredBooking(bookingId) {
  const id = assertBookingId(bookingId);
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const result = await transaction
      .request()
      .input("bookingId", sql.NVarChar(128), id)
      .query(
        "SELECT TOP 1 * FROM dbo.Bookings WITH (UPDLOCK, HOLDLOCK) WHERE Id = @bookingId;",
      );
    const booking = sqlBookingFromRecord(result.recordset[0]);
    if (!booking) {
      const history = await transaction
        .request()
        .input("bookingId", sql.NVarChar(128), id)
        .query(
          "SELECT TOP 1 Id FROM dbo.MissedCheckInHistory WHERE Id = @bookingId;",
        );
      await transaction.commit();
      return history.recordset.length > 0;
    }
    if (
      ["REJECTED", "VERIFIED", "NO_SHOW"].includes(booking.status) ||
      booking.actualStartTime ||
      getCheckInWindowState(booking).state !== "expired"
    ) {
      await transaction.commit();
      return false;
    }
    const payload = JSON.stringify(
      missedCheckInArchive(id, sqlBookingFromRecord(result.recordset[0])),
    );
    await transaction
      .request()
      .input("id", sql.NVarChar(128), id)
      .input("payload", sql.NVarChar(sql.MAX), payload)
      .query(`MERGE dbo.MissedCheckInHistory WITH (HOLDLOCK) AS target
        USING (SELECT @id AS Id) AS source ON target.Id = source.Id
        WHEN NOT MATCHED THEN INSERT (Id, OriginalBookingId, Payload, ArchivedAt, ArchiveReason)
          VALUES (@id, @id, @payload, SYSUTCDATETIME(), N'Missed check-in window');
        DELETE FROM dbo.Bookings WHERE Id = @id;`);
    await transaction.commit();
    return true;
  } catch (cause) {
    await transaction.rollback().catch(() => undefined);
    throw cause;
  }
}

async function processQueue() {
  const bookingIds = await claimDueVerificationEmails();
  for (const bookingId of bookingIds) {
    try {
      const booking = await loadSqlBooking(bookingId);
      if (!booking) {
        await finishQueuedVerificationEmail(
          bookingId,
          "cancelled",
          "Booking no longer exists.",
        );
        continue;
      }
      const windowState = getCheckInWindowState(booking);
      if (booking.status !== "CONFIRMED" || windowState.state === "expired") {
        await finishQueuedVerificationEmail(
          bookingId,
          "cancelled",
          "Booking is no longer eligible for verification email.",
        );
        continue;
      }
      if (windowState.state !== "active") {
        await finishQueuedVerificationEmail(bookingId, "queued");
        continue;
      }
      await deliverSqlBookingEmail(bookingId, booking);
      await finishQueuedVerificationEmail(bookingId, "sent");
    } catch (cause) {
      await finishQueuedVerificationEmail(
        bookingId,
        "failed",
        cause instanceof Error ? cause.message : "Email processing failed.",
      );
      console.error("queued verification email failed", {
        bookingId,
        message: cause instanceof Error ? cause.message : "Unknown error",
      });
    }
  }
}

async function verifyBookingToken(input) {
  const bookingId =
    typeof input.bookingId === "string" &&
    /^[A-Za-z0-9_-]{1,128}$/.test(input.bookingId)
      ? input.bookingId
      : "";
  const token = typeof input.token === "string" ? input.token : "";
  if (!bookingId || !token)
    throw new ApiError(
      400,
      "invalid-verification-link",
      "Verification link is invalid.",
    );
  const ref = db.collection("bookings").doc(bookingId);
  let result;
  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists)
      throw new ApiError(
        404,
        "booking-not-found",
        "Booking was not found or has already been released.",
      );
    const booking = snapshot.data() || {};
    const suppliedHash = hashToken(token);
    const activeHash =
      typeof booking.verificationTokenHash === "string"
        ? booking.verificationTokenHash
        : "";
    const usedHash =
      typeof booking.verificationTokenUsedHash === "string"
        ? booking.verificationTokenUsedHash
        : "";
    const matches = (value) =>
      value.length === suppliedHash.length &&
      value.length > 0 &&
      require("node:crypto").timingSafeEqual(
        Buffer.from(value, "hex"),
        Buffer.from(suppliedHash, "hex"),
      );
    if (booking.status === "VERIFIED" || booking.actualStartTime) {
      if (!matches(usedHash))
        throw new ApiError(
          403,
          "invalid-verification-token",
          "Verification link is invalid.",
        );
      result = { title: booking.title || "", alreadyVerified: true };
      return;
    }
    const windowState = getCheckInWindowState(booking);
    if (windowState.state === "too-early")
      throw new ApiError(
        412,
        "check-in-not-available",
        "Check-in is not available yet.",
      );
    if (windowState.state === "expired")
      throw new ApiError(
        410,
        "check-in-expired",
        "The check-in window has expired.",
      );
    if (!matches(activeHash)) {
      throw new ApiError(
        403,
        "invalid-verification-token",
        "Verification link is invalid.",
      );
    }
    const expiresAt = toDate(booking.verificationTokenExpiresAt);
    if (expiresAt && expiresAt.getTime() < Date.now())
      throw new ApiError(
        410,
        "verification-token-expired",
        "Verification link has expired.",
      );
    transaction.update(ref, {
      status: "VERIFIED",
      actualStartTime: FieldValue.serverTimestamp(),
      verifiedAt: FieldValue.serverTimestamp(),
      verificationTokenUsedHash: suppliedHash,
      verificationTokenHash: FieldValue.delete(),
      verificationTokenCreatedAt: FieldValue.delete(),
      verificationTokenExpiresAt: FieldValue.delete(),
      verifyUrl: FieldValue.delete(),
    });
    result = { title: booking.title || "", alreadyVerified: false };
  });
  return result;
}

function verificationTokenMatches(expectedHash, suppliedHash) {
  if (
    typeof expectedHash !== "string" ||
    expectedHash.length !== suppliedHash.length
  )
    return false;
  return crypto.timingSafeEqual(
    Buffer.from(expectedHash, "utf8"),
    Buffer.from(suppliedHash, "utf8"),
  );
}

async function getSqlVerificationContext(bookingId, token) {
  const id = assertBookingId(bookingId);
  if (typeof token !== "string" || !/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
    throw new ApiError(
      401,
      "verification-token-required",
      "A valid verification link is required.",
    );
  }
  const booking = await loadSqlBooking(id);
  if (!booking) return null;
  const suppliedHash = hashToken(token);
  const expectedHash =
    booking.status === "VERIFIED" || booking.actualStartTime
      ? booking.verificationTokenUsedHash
      : booking.verificationTokenHash;
  if (!verificationTokenMatches(expectedHash, suppliedHash)) {
    throw new ApiError(
      403,
      "invalid-verification-token",
      "Verification link is invalid.",
    );
  }
  const expiresAt = toDate(booking.verificationTokenExpiresAt);
  if (
    !(booking.status === "VERIFIED" || booking.actualStartTime) &&
    expiresAt &&
    expiresAt.getTime() < Date.now()
  ) {
    throw new ApiError(
      410,
      "verification-token-expired",
      "Verification link has expired.",
    );
  }
  return {
    id: booking.id,
    title: booking.title,
    roomId: booking.roomId,
    startTime: booking.startTime,
    endTime: booking.endTime,
    status: booking.status,
    actualStartTime: booking.actualStartTime,
    verificationWindowOpenedAt: booking.verificationWindowOpenedAt,
    verificationWindowClosedAt: booking.verificationWindowClosedAt,
  };
}

async function verifySqlBookingToken(input) {
  const bookingId = typeof input.bookingId === "string" ? input.bookingId : "";
  const token = typeof input.token === "string" ? input.token : "";
  if (!bookingId || !token)
    throw new ApiError(
      400,
      "invalid-verification-link",
      "Verification link is invalid.",
    );
  const transaction = new sql.Transaction(pool);
  await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
  try {
    const result = await transaction
      .request()
      .input("bookingId", sql.NVarChar(128), assertBookingId(bookingId))
      .query(
        `SELECT TOP 1 * FROM dbo.Bookings WITH (UPDLOCK, HOLDLOCK) WHERE Id = @bookingId;`,
      );
    const booking = sqlBookingFromRecord(result.recordset[0]);
    if (!booking) {
      await transaction.rollback();
      return null;
    }
    const suppliedHash = hashToken(token);
    const activeHash = booking.verificationTokenHash || "";
    const usedHash = booking.verificationTokenUsedHash || "";
    const matches = (value) =>
      value.length === suppliedHash.length &&
      value.length > 0 &&
      require("node:crypto").timingSafeEqual(
        Buffer.from(value, "hex"),
        Buffer.from(suppliedHash, "hex"),
      );
    if (booking.status === "VERIFIED" || booking.actualStartTime) {
      if (!matches(usedHash))
        throw new ApiError(
          403,
          "invalid-verification-token",
          "Verification link is invalid.",
        );
      await transaction.commit();
      return { title: booking.title, alreadyVerified: true };
    }
    const windowState = getCheckInWindowState(booking);
    if (windowState.state === "too-early")
      throw new ApiError(
        412,
        "check-in-not-available",
        "Check-in is not available yet.",
      );
    if (windowState.state === "expired")
      throw new ApiError(
        410,
        "check-in-expired",
        "Check-in window has expired.",
      );
    if (!matches(activeHash))
      throw new ApiError(
        403,
        "invalid-verification-token",
        "Verification link is invalid.",
      );
    await transaction
      .request()
      .input("bookingId", sql.NVarChar(128), bookingId)
      .input("hash", sql.Char(64), suppliedHash)
      .query(
        `UPDATE dbo.Bookings SET Status = N'VERIFIED', ActualStartTime = SYSUTCDATETIME(), VerifiedAt = SYSUTCDATETIME(), VerificationTokenUsedHash = @hash, VerificationTokenHash = NULL, UpdatedAt = SYSUTCDATETIME() WHERE Id = @bookingId;`,
      );
    await transaction.commit();
    return { title: booking.title, alreadyVerified: false };
  } catch (cause) {
    await transaction.rollback().catch(() => undefined);
    throw cause;
  }
}

const requestHandler = async (request, response) => {
  try {
    if (!requireOrigin(request, response)) return;
    if (request.method === "OPTIONS") {
      const preflightHeaders = {
        "access-control-allow-methods": "GET,POST,OPTIONS",
        "access-control-allow-headers": "content-type, authorization",
      };
      if (
        request.headers["access-control-request-private-network"] === "true"
      ) {
        preflightHeaders["access-control-allow-private-network"] = "true";
        response.setHeader(
          "vary",
          "Origin, Access-Control-Request-Private-Network",
        );
      }
      response.writeHead(204, preflightHeaders);
      return response.end();
    }
    limit(request);
    const url = new URL(request.url, "http://local");
    if (request.method === "GET" && url.pathname === "/health")
      return json(response, 200, createHealthResponse());
    if (request.method === "POST" && url.pathname === "/api/admin/session")
      return json(response, 200, {
        success: true,
        data: await loginAdmin(request, await body(request)),
      });
    if (request.method === "POST" && url.pathname === "/api/admin/tools")
      return json(response, 200, {
        success: true,
        data: await runAdminTool(
          await requireAdminSession(request),
          await body(request),
        ),
      });
    if (
      request.method === "GET" &&
      url.pathname === "/api/admin/email-history"
    ) {
      await requireAdminSession(request);
      const requestedLimit = url.searchParams.has("limit")
        ? Number(url.searchParams.get("limit"))
        : undefined;
      return json(response, 200, {
        success: true,
        data: { history: await listAdminEmailHistory(requestedLimit) },
      });
    }
    if (request.method === "GET" && url.pathname === "/api/mailboxes") {
      await requireFirebaseUser(request);
      return json(response, 200, {
        success: true,
        data: {
          users: await searchMailboxes(url.searchParams.get("query") || ""),
        },
      });
    }
    if (request.method === "POST" && url.pathname === "/api/mailboxes/lookup") {
      await requireFirebaseUser(request);
      return json(response, 200, {
        success: true,
        data: await lookupMailbox((await body(request)).email),
      });
    }
    if (request.method === "GET" && url.pathname === "/api/rooms") {
      await requireFirebaseUser(request);
      return json(response, 200, {
        success: true,
        data: { rooms: await listSqlRooms() },
      });
    }
    if (request.method === "GET" && url.pathname === "/api/bookings") {
      await requireFirebaseUser(request);
      const from = parseDateFilter(url.searchParams.get("from"), "from");
      const end = parseDateFilter(url.searchParams.get("end"), "end");
      if (from && end && end < from)
        throw new ApiError(
          400,
          "invalid-date-range",
          "end must be on or after from.",
        );
      return json(response, 200, {
        success: true,
        data: { bookings: await listSqlBookings(from, end) },
      });
    }
    if (
      request.method === "POST" &&
      /^\/api\/bookings\/[^/]+\/archive-expired$/.test(url.pathname)
    ) {
      await requireFirebaseUser(request);
      const bookingId = decodeURIComponent(url.pathname.split("/")[3]);
      return json(response, 200, {
        success: true,
        data: { bookingId, archived: await archiveExpiredBooking(bookingId) },
      });
    }
    if (
      request.method === "GET" &&
      url.pathname === "/api/room-maintenance-history"
    ) {
      await requireFirebaseUser(request);
      return json(response, 200, {
        success: true,
        data: { history: await listSqlRoomMaintenanceHistory() },
      });
    }
    if (request.method === "POST" && url.pathname === "/api/bookings") {
      const user = await requireFirebaseUser(request);
      return json(response, 201, {
        success: true,
        data: await createSqlBooking(await body(request), user.uid),
      });
    }
    if (
      request.method === "GET" &&
      /^\/api\/bookings\/[^/]+\/verification-context$/.test(url.pathname)
    ) {
      const bookingId = url.pathname.split("/")[3];
      const context = await getSqlVerificationContext(
        bookingId,
        url.searchParams.get("token"),
      );
      if (!context)
        throw new ApiError(404, "booking-not-found", "Booking was not found.");
      return json(response, 200, { success: true, data: context });
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/booking-verification-emails"
    ) {
      const user = await requireFirebaseUser(request);
      return json(response, 200, {
        success: true,
        data: await queueOrSendBookingEmail(await body(request), user.uid),
      });
    }
    if (
      request.method === "POST" &&
      url.pathname === "/api/bookings/verify-token"
    ) {
      const input = await body(request);
      const sqlResult = await verifySqlBookingToken(input);
      return json(response, 200, {
        success: true,
        data: sqlResult || (await verifyBookingToken(input)),
      });
    }
    throw new ApiError(404, "not-found", "Endpoint was not found.");
  } catch (cause) {
    error(response, cause);
  }
};

const server = config.tlsPfxPath
  ? https.createServer(
      {
        pfx: fs.readFileSync(config.tlsPfxPath),
        passphrase: config.tlsPfxPassword,
        minVersion: "TLSv1.2",
      },
      requestHandler,
    )
  : http.createServer(requestHandler);

server.listen(config.port, config.listenHost, () =>
  console.log(
    `Smart Room portable API listening on ${config.tlsPfxPath ? "https" : "http"}://${config.listenHost}:${config.port}`,
  ),
);
setInterval(
  () =>
    processQueue().catch((cause) =>
      console.error("background email processing failed", {
        message: cause.message,
      }),
    ),
  60_000,
).unref();
