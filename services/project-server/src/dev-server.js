const http = require("node:http");
const { createConfig, createDefaultProjectServer, createHttpApp } = require("./index");
const { sendJson } = require("./http-app");

const config = createConfig();
async function bootstrap() {
  const service = await createDefaultProjectServer(config);
  await service.cleanupExpiredDebugSessions();
  const debugSessionCleanupTimer = setInterval(() => {
    service.cleanupExpiredDebugSessions().catch((error) => console.error("Debug-Session-Bereinigung fehlgeschlagen:", error.message));
  }, 15 * 60 * 1000);
  debugSessionCleanupTimer.unref();
  const app = createHttpApp({ service, adminReadToken: config.adminReadToken });

  const server = http.createServer((req, res) => {
    app(req, res).catch((error) => {
      sendJson(res, error.status || 500, {
        error: error.code || "internal_server_error",
        message: error.message || "Interner Fehler.",
        details: error.details || {},
      });
    });
  });

  server.listen(config.port, config.host, () => {
    console.log(`Project Server: http://${config.host}:${config.port}`);
    console.log("API prefix: /api/projects");
  });
}

bootstrap().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
