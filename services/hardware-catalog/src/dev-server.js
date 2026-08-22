const http = require("node:http");
const { createConfig, createDefaultHardwareCatalog, createHttpApp } = require("./index");
const { sendJson } = require("./http-app");

async function main() {
  const config = createConfig();
  const service = await createDefaultHardwareCatalog(config);
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
    console.log(`Hardware Catalog: http://${config.host}:${config.port}`);
    console.log("API prefix: /api/hardware-catalog");
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
