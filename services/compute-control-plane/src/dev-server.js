"use strict";

const http = require("node:http");
const { createConfig, createDefaultComputeControlPlane, createHttpApp } = require("./index");
const { sendJson } = require("./http-app");

async function bootstrap() {
  const config = createConfig();
  const runtime = await createDefaultComputeControlPlane(config);
  const app = createHttpApp({ ...runtime, internalToken: config.internalToken, workerBootstrapToken: config.workerBootstrapToken });
  http.createServer((req, res) => app(req, res).catch((error) => sendJson(res, error.status || 500, { error: error.code || "internal_server_error", message: error.message || "Interner Fehler.", details: error.details || {} })))
    .listen(config.port, config.host, () => console.log(`Compute Control Plane: http://${config.host}:${config.port}`));
}

bootstrap().catch((error) => { console.error(error); process.exitCode = 1; });
