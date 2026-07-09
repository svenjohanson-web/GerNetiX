const http = require("node:http");
const { createConfig, createDefaultAiContextServer, createHttpApp } = require("./index");

const config = createConfig();
const service = createDefaultAiContextServer(config);
const app = createHttpApp({ service });

const server = http.createServer(app);

server.listen(config.port, config.host, () => {
  console.log(`AI Context Server: http://${config.host}:${config.port}`);
});
