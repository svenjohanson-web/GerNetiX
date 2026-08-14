const http = require("node:http");
const { createConfig, createDefaultPublicDemoService, createHttpApp } = require("./index");
const { sendJson } = require("./http-app");

const config = createConfig();
start().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

async function start() {
  const service = await createDefaultPublicDemoService(config);
  const app = createHttpApp({ service, internalApiSigningKey: config.internalApiSigningKey });
  const server = http.createServer((req, res) => {
    app(req, res).catch((error) => sendJson(res, error.status || 500, {
      error: error.code || "internal_server_error",
      message: error.message || "Interner Fehler.",
    }));
  });
  server.listen(config.port, config.host, () => {
    console.log(`Öffentlicher Demo-Katalog: http://${config.host}:${config.port}`);
  });
}
