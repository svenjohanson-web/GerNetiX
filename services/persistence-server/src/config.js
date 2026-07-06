const path = require("node:path");

function createConfig(env = process.env) {
  const runtimeRoot = env.PERSISTENCE_RUNTIME_DIR || path.join(__dirname, "..", ".runtime");
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 5400),
    runtimeRoot,
    dbPath: env.PERSISTENCE_SQLITE_PATH || path.join(runtimeRoot, "gernetix-services.sqlite"),
  };
}

module.exports = { createConfig };
