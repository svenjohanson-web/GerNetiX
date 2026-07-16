const http = require("node:http");
const { createConfig, createDefaultAdminAccessServer, createHttpApp } = require("./index");
const { sendJson } = require("./http-app");

const config = createConfig();
const runtime = createDefaultAdminAccessServer(config);
const bootstrap = runtime.service.bootstrap();
if (bootstrap.setup_required) console.warn("Admin Access Server wartet auf ADMIN_BOOTSTRAP_USERNAME und ADMIN_BOOTSTRAP_PASSWORD.");
const app = createHttpApp({ service: runtime.service, config });
http.createServer((req, res) => app(req, res).catch((error) => sendJson(res, error.status || 500, { error: error.code || "internal_server_error", message: error.message || "Interner Fehler." })))
  .listen(config.port, config.host, () => console.log(`Admin Access Server: http://${config.host}:${config.port}/admin/`));
