const path = require("node:path");
const { readOptionalInternalApiAuthConfig } = require("../../shared/internal-api-auth-env");

function createConfig(env = process.env) {
  const runtimeRoot = env.PERSISTENCE_RUNTIME_DIR || path.join(__dirname, "..", ".runtime");
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 5400),
    runtimeRoot,
    dbPath: env.PERSISTENCE_SQLITE_PATH || path.join(runtimeRoot, "gernetix-services.sqlite"),
    internalApiSigningKey: readOptionalInternalApiAuthConfig(env, "persistence-server"),
  };
}

module.exports = { createConfig };
