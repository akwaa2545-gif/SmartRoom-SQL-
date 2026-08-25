const fs = require("node:fs");
const path = require("node:path");

function loadEnv(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const rawLine of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    const value = line
      .slice(separator + 1)
      .trim()
      .replace(/^['"]|['"]$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}

function getConfig() {
  loadEnv(path.resolve(__dirname, "..", ".env"));
  const required = [
    "APP_BASE_URL",
    "POWER_AUTOMATE_VERIFICATION_FLOW_URL",
    "POWER_AUTOMATE_USER_LOOKUP_FLOW_URL",
    "FIREBASE_SERVICE_ACCOUNT_PATH",
    "SQL_SERVER",
    "SQL_DATABASE",
    "SQL_USER",
    "SQL_PASSWORD",
  ];
  const missing = required.filter((key) => !process.env[key]?.trim());
  if (missing.length)
    throw new Error(`Missing required configuration: ${missing.join(", ")}`);
  const rawServiceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || "";
  const serviceAccountPath = path.isAbsolute(rawServiceAccountPath)
    ? rawServiceAccountPath
    : path.resolve(__dirname, "..", rawServiceAccountPath);
  const rawTlsPfxPath = process.env.TLS_PFX_PATH || "";
  const tlsPfxPath = rawTlsPfxPath
    ? (path.isAbsolute(rawTlsPfxPath) ? rawTlsPfxPath : path.resolve(__dirname, "..", rawTlsPfxPath))
    : "";
  if (tlsPfxPath && !fs.existsSync(tlsPfxPath))
    throw new Error("TLS_PFX_PATH does not exist.");
  if (tlsPfxPath && !process.env.TLS_PFX_PASSWORD)
    throw new Error(
      "TLS_PFX_PASSWORD is required when TLS_PFX_PATH is configured.",
    );
  const listenHost = process.env.API_LISTEN_HOST || "127.0.0.1";
  const allowInsecureHttp =
    process.env.ALLOW_INSECURE_HTTP === "true" ||
    process.env.ALLOW_HTTP_PROXY === "true";
  if (
    !tlsPfxPath &&
    !allowInsecureHttp &&
    !["127.0.0.1", "::1", "localhost"].includes(listenHost)
  ) {
    throw new Error(
      "TLS_PFX_PATH is required unless the API listens only on localhost behind IIS or ALLOW_INSECURE_HTTP is enabled.",
    );
  }
  return Object.freeze({
    port: Number(process.env.PORT || 8787),
    listenHost,
    appBaseUrl: process.env.APP_BASE_URL.replace(/\/+$/, ""),
    yageoDomain: (process.env.YAGEO_EMAIL_DOMAIN || "yageo.com").toLowerCase(),
    lookupFlowUrl: process.env.POWER_AUTOMATE_USER_LOOKUP_FLOW_URL,
    emailFlowUrl: process.env.POWER_AUTOMATE_VERIFICATION_FLOW_URL,
    allowedOrigins: (process.env.ALLOWED_ORIGINS || process.env.APP_BASE_URL)
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean),
    allowAnonymousInternalAuth:
      process.env.ALLOW_ANONYMOUS_INTERNAL_AUTH === "true",
    serviceAccountPath,
    adminSessionSecret: process.env.ADMIN_SESSION_SIGNING_SECRET || "",
    tlsPfxPath,
    tlsPfxPassword: process.env.TLS_PFX_PASSWORD || "",
    sql: {
      server: process.env.SQL_SERVER,
      database: process.env.SQL_DATABASE,
      user: process.env.SQL_USER,
      password: process.env.SQL_PASSWORD,
      options: { encrypt: true, trustServerCertificate: true },
    },
  });
}

module.exports = { getConfig, loadEnv };
