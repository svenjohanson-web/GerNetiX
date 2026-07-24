const http = require("node:http");
const { createConfig, createDefaultDeviceManagementServer, createHttpApp } = require("./index");
const { sendJson } = require("./http-app");

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  const config = createConfig();
  const service = await createDefaultDeviceManagementServer(config);
  const app = createHttpApp({ service });

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
    console.log(`Device Management Server: http://${config.host}:${config.port}`);
    console.log(`API prefix: /api/device-management`);
  });
}
