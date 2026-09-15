const net = require("node:net");

function normalizeIpAddress(value) {
  if (typeof value !== "string") return "unknown";

  let candidate = value.trim();
  if (!candidate) return "unknown";
  if (candidate.includes(",")) candidate = candidate.split(",")[0].trim();
  if (candidate.startsWith("[") && candidate.endsWith("]")) {
    candidate = candidate.slice(1, -1);
  }
  if (candidate.startsWith("::ffff:")) candidate = candidate.slice(7);

  return net.isIP(candidate) ? candidate : "unknown";
}

function isLoopbackAddress(value) {
  const normalized = normalizeIpAddress(value);
  return normalized === "127.0.0.1" || normalized === "::1";
}

function getClientIp(request, trustProxy = false) {
  const directAddress = normalizeIpAddress(request?.socket?.remoteAddress);
  if (trustProxy && isLoopbackAddress(directAddress)) {
    const forwarded = request?.headers?.["x-forwarded-for"];
    const forwardedAddress = normalizeIpAddress(
      Array.isArray(forwarded) ? forwarded[0] : forwarded,
    );
    if (forwardedAddress !== "unknown") return forwardedAddress;
  }
  return directAddress;
}

function getAdminDeviceLabel(userAgent) {
  const agent = typeof userAgent === "string" ? userAgent.toLowerCase() : "";
  const browser = agent.includes("edg/")
    ? "Edge"
    : agent.includes("opr/") || agent.includes("opera")
      ? "Opera"
      : agent.includes("chrome/")
        ? "Chrome"
        : agent.includes("firefox/")
          ? "Firefox"
          : agent.includes("safari/")
            ? "Safari"
            : "Browser";
  const operatingSystem = agent.includes("windows")
    ? "Windows"
    : agent.includes("android")
      ? "Android"
      : agent.includes("iphone") || agent.includes("ipad") || agent.includes("ios")
        ? "iOS"
        : agent.includes("mac os") || agent.includes("macintosh")
          ? "macOS"
          : agent.includes("linux")
            ? "Linux"
            : "Unknown OS";
  const deviceType = agent.includes("ipad") || agent.includes("tablet")
    ? "Tablet"
    : agent.includes("mobile") || agent.includes("iphone") || agent.includes("android")
      ? "Mobile"
      : "Desktop";

  return `${browser} on ${operatingSystem} (${deviceType})`;
}

module.exports = {
  normalizeIpAddress,
  getClientIp,
  getAdminDeviceLabel,
};
