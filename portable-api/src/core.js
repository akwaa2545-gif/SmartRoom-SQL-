const crypto = require("node:crypto");

const DEFAULT_YAGEO_DOMAIN = "yageo.com";
const CHECK_IN_WINDOW_MS = 15 * 60 * 1000;

class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function assertYageoEmail(value, domain = DEFAULT_YAGEO_DOMAIN) {
  const email = typeof value === "string" ? value.trim().toLowerCase() : "";
  const escapedDomain = domain.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (
    !new RegExp(`^[^\\s@]+@${escapedDomain}$`, "i").test(email) ||
    email.length > 254
  ) {
    throw new ApiError(
      400,
      "invalid-email",
      `email must be a valid @${domain} address.`,
    );
  }
  return email;
}

function assertBookingId(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new ApiError(400, "invalid-booking-id", "bookingId is invalid.");
  }
  return value;
}

function parseJson(value) {
  if (typeof value !== "string" || !value.trim()) return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function extractLookupUsers(value) {
  const parsed = parseJson(value);
  if (Array.isArray(parsed)) return parsed;
  if (!parsed || typeof parsed !== "object") return [];
  for (const key of ["users", "value", "body", "data", "results"]) {
    if (Object.prototype.hasOwnProperty.call(parsed, key)) {
      const users = extractLookupUsers(parsed[key]);
      if (users.length) return users;
    }
  }
  return [];
}

function normalizeUser(user) {
  if (!user || typeof user !== "object") return {};
  const string = (value) => (typeof value === "string" ? value.trim() : "");
  return {
    displayName: string(user.displayName),
    mail: string(user.mail || user.email).toLowerCase(),
    userPrincipalName: string(
      user.userPrincipalName || user.userprincipalname || user.upn,
    ).toLowerCase(),
    department: string(user.department),
    jobTitle: string(user.jobTitle),
  };
}

function emailsForUser(user) {
  const normalized = normalizeUser(user);
  return [normalized.mail, normalized.userPrincipalName].filter(Boolean);
}

function toDate(value) {
  if (!value) return null;
  const date =
    typeof value.toDate === "function" ? value.toDate() : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function getCheckInWindowState(booking, now = Date.now()) {
  const start = toDate(booking.startTime);
  if (!start) return { state: "invalid", window: null };
  const window = {
    opensAt: new Date(start.getTime() - CHECK_IN_WINDOW_MS),
    closesAt: new Date(start.getTime() + CHECK_IN_WINDOW_MS),
  };
  if (now < window.opensAt.getTime()) return { state: "too-early", window };
  if (now > window.closesAt.getTime()) return { state: "expired", window };
  return { state: "active", window };
}

function createToken() {
  return crypto.randomBytes(32).toString("base64url");
}
function hashToken(token) {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

module.exports = {
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
  CHECK_IN_WINDOW_MS,
};
