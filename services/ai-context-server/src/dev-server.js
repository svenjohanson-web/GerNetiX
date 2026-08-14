const http = require("node:http");
const {
  createConfig,
  createDefaultAiContextServer,
  createHttpApp,
  startAiContextBackgroundInitialization,
} = require("./index");

const config = createConfig();
start().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exitCode = 1;
});

async function start() {
  const service = await createDefaultAiContextServer(config);
  const app = createHttpApp({ service, internalApiSigningKey: config.internalApiSigningKey });

  const server = http.createServer(app);

  server.listen(config.port, config.host, () => {
    console.log(`AI Context Server: http://${config.host}:${config.port}`);
    void startAiContextBackgroundInitialization(service);
  });
}
