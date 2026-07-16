const path = require("node:path");

function createConfig(env = process.env) {
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 4610),
    sqlitePath: env.ADMIN_ACCESS_SQLITE_PATH || path.join(__dirname, "..", ".runtime", "gernetix-admin-access.sqlite"),
    adminToolBaseUrl: env.ADMIN_TOOL_BASE_URL || "http://127.0.0.1:4600",
    adminToolAccessToken: env.ADMIN_TOOL_ACCESS_TOKEN || "",
    bootstrapUsername: env.ADMIN_BOOTSTRAP_USERNAME || "",
    bootstrapPassword: env.ADMIN_BOOTSTRAP_PASSWORD || "",
    sessionHours: Math.max(1, Math.min(24, Number(env.ADMIN_SESSION_HOURS || 8))),
    cookieSecure: env.ADMIN_SESSION_COOKIE_SECURE === "true",
  };
}

module.exports = { createConfig };
