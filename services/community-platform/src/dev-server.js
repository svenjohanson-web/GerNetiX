const http = require("node:http");
const { createConfig, createDefaultCommunityPlatform, createHttpApp } = require("./index");
const { sendJson } = require("./http-app");

const config = createConfig();
const service = createDefaultCommunityPlatform(config);
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
  console.log(`Community Platform: http://${config.host}:${config.port}`);
  console.log("API prefix: /api/community");
});
