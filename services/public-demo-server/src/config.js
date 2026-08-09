const path = require("node:path");

const workspaceRoot = path.resolve(__dirname, "..", "..", "..");

function createConfig(env = process.env) {
  const postgresHost = String(env.PUBLIC_DEMO_POSTGRES_HOST || "").trim();
  if (!postgresHost) throw new Error("PUBLIC_DEMO_POSTGRES_HOST muss auf den zentralen VPS-PostgreSQL-Dienst zeigen.");
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 4920),
    persistenceBackend: "postgres",
    postgres: {
      connectionString: env.PUBLIC_DEMO_POSTGRES_URL || "",
      host: postgresHost,
      port: Number(env.PUBLIC_DEMO_POSTGRES_PORT || 5432),
      database: env.PUBLIC_DEMO_POSTGRES_DATABASE || "gernetix_runtime",
      user: env.PUBLIC_DEMO_POSTGRES_USER || "gernetix_runtime",
      password: env.PUBLIC_DEMO_POSTGRES_PASSWORD || "",
    },
    publisherToken: env.PUBLIC_DEMO_PUBLISHER_TOKEN || "",
    artifactDir: path.resolve(env.ARTIFACT_STORE_DIR || path.join(workspaceRoot, ".runtime", "artifacts")),
  };
}

module.exports = { createConfig };
