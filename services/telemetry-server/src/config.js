const path = require("node:path");

const workspaceRoot = path.resolve(__dirname, "..", "..", "..");

function createConfig(env = process.env) {
  const runtimeRoot = env.TELEMETRY_RUNTIME_DIR ? path.resolve(env.TELEMETRY_RUNTIME_DIR) : path.join(workspaceRoot, ".runtime");
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 5600),
    sqlitePath: env.PERSISTENCE_SQLITE_PATH || env.TELEMETRY_SQLITE_PATH
      ? path.resolve(env.PERSISTENCE_SQLITE_PATH || env.TELEMETRY_SQLITE_PATH)
      : path.join(runtimeRoot, "gernetix-services.sqlite"),
    internalToken: String(env.TELEMETRY_INTERNAL_TOKEN || ""),
    projectServerBaseUrl: String(env.PROJECT_SERVER_BASE_URL || "http://127.0.0.1:4800").replace(/\/$/, ""),
    deviceManagementBaseUrl: String(env.DEVICE_MANAGEMENT_BASE_URL || "http://127.0.0.1:4700").replace(/\/$/, ""),
    identityBaseUrl: String(env.IDENTITY_BASE_URL || "http://127.0.0.1:4300").replace(/\/$/, ""),
    identityAdminToken: String(env.IDENTITY_ADMIN_TOKEN || ""),
    mqttBrokerUrl: String(env.MQTT_BROKER_URL || ""),
    defaultMeasurementRetentionDays: boundedDays(env.TELEMETRY_MEASUREMENT_RETENTION_DAYS, 90),
    defaultEventRetentionDays: boundedDays(env.TELEMETRY_EVENT_RETENTION_DAYS, 365),
    retentionIntervalHours: boundedInterval(env.TELEMETRY_RETENTION_INTERVAL_HOURS, 24),
  };
}

function boundedDays(value, fallback) {
  const parsed = Number(value || fallback);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 3650 ? parsed : fallback;
}
function boundedInterval(value, fallback) {
  const parsed = Number(value || fallback);
  return Number.isInteger(parsed) && parsed >= 1 && parsed <= 168 ? parsed : fallback;
}

module.exports = { createConfig };
