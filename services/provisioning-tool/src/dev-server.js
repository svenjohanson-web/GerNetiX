const http = require("node:http");
const { createConfig, createDefaultProvisioningTool, createHttpApp } = require("./index");
const { sendJson } = require("./http-app");

const config = createConfig();
const service = createDefaultProvisioningTool(config);
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
  console.log(`Provisioning Tool: http://${config.host}:${config.port}`);
  console.log(`Flash runner: ${config.flashRunner}`);
});
