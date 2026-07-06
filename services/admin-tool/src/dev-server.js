const http = require("node:http");
const { createConfig, createDefaultAdminTool, createHttpApp } = require("./index");
const { sendJson } = require("./http-app");

const config = createConfig();
const service = createDefaultAdminTool(config);
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
  console.log(`Admin Tool: http://${config.host}:${config.port}`);
});
