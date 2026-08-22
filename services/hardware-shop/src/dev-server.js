const http = require("node:http");
const { createConfig, createDefaultHardwareShop, createHttpApp } = require("./index");
const { sendJson } = require("./http-app");

async function main() {
  const config = createConfig();
  const service = await createDefaultHardwareShop(config);
  const app = createHttpApp({ service, internalApiSigningKey: config.internalApiSigningKey });

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
    console.log(`Hardware Shop: http://${config.host}:${config.port}`);
    console.log("API prefix: /api/hardware-shop");
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
