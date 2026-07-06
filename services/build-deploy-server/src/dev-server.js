const http = require("node:http");
const { createConfig, createDefaultBuildDeployService, createHttpApp } = require("./index");
const { sendJson } = require("./http-app");

const config = createConfig();
const service = createDefaultBuildDeployService(config);
const app = createHttpApp({ service, artifactDir: config.artifactDir });

const server = http.createServer((req, res) => {
  app(req, res).catch((error) => {
    const status = error.status || 500;
    sendJson(res, status, {
      error: error.code || "internal_server_error",
      message: error.message || "Interner Fehler.",
      details: error.details || {},
    });
  });
});

server.listen(config.port, config.host, () => {
  console.log(`Build-&-Deploy-Server: http://${config.host}:${config.port}`);
  console.log(`Runner: ${config.runner}`);
  console.log(`Runtime: ${config.runtimeRoot}`);
});
