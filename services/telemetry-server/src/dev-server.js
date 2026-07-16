const http = require("node:http");
const { createConfig, createHttpApp, createDefaultTelemetryServer } = require("./index");
const { sendJson } = require("./http-app");
const { startRetentionScheduler } = require("./retention-scheduler");

const config = createConfig();
const service = createDefaultTelemetryServer(config);
startRetentionScheduler({ service, intervalHours: config.retentionIntervalHours });
const app = createHttpApp({ service, internalToken: config.internalToken });
http.createServer((req, res) => app(req, res).catch((error) => sendJson(res, error.status || 500, { error: error.code || "internal_server_error", message: error.message || "Interner Fehler.", details: error.details || {} })))
  .listen(config.port, config.host, () => console.log(`Telemetry Server: http://${config.host}:${config.port}`));
