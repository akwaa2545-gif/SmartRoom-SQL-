const crypto = require("node:crypto");

const PBKDF2_ITERATIONS = 310_000;
const KEY_LENGTH = 32;
const DIGEST = "sha256";

function createPasswordRecord(password) {
  if (
    typeof password !== "string" ||
    password.length < 12 ||
    password.length > 256
  ) {
    throw new Error("Admin password must be between 12 and 256 characters.");
  }
  const salt = crypto.randomBytes(16).toString("base64url");
  const hash = crypto
    .pbkdf2Sync(password, salt, PBKDF2_ITERATIONS, KEY_LENGTH, DIGEST)
    .toString("base64url");
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${hash}`;
}

function verifyPassword(password, record) {
  if (typeof password !== "string" || typeof record !== "string") return false;
  const [scheme, iterationsText, salt, expectedHash] = record.split("$");
  const iterations = Number(iterationsText);
  if (
    scheme !== "pbkdf2" ||
    !Number.isSafeInteger(iterations) ||
    iterations < 100_000 ||
    !salt ||
    !expectedHash
  )
    return false;
  const actual = crypto
    .pbkdf2Sync(password, salt, iterations, KEY_LENGTH, DIGEST)
    .toString("base64url");
  if (actual.length !== expectedHash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expectedHash));
}

function base64Json(value) {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function createSession({ username, role, sessionVersion }, secret, expiresAt) {
  const payload = base64Json({
    username,
    role,
    sessionVersion,
    exp: expiresAt,
  });
  const signature = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  return `${payload}.${signature}`;
}

function verifySession(token, secret, now = Date.now()) {
  if (typeof token !== "string" || typeof secret !== "string") return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("base64url");
  if (
    expected.length !== signature.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))
  )
    return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (
      !data ||
      typeof data.username !== "string" ||
      typeof data.sessionVersion !== "string" ||
      !["SUPER_ADMIN", "APPROVER"].includes(data.role) ||
      !Number.isFinite(data.exp) ||
      data.exp <= now
    )
      return null;
    return data;
  } catch {
    return null;
  }
}

module.exports = {
  createPasswordRecord,
  verifyPassword,
  createSession,
  verifySession,
};
