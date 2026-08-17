const path = require("node:path");
const { createSystemRepositoryCatalog } = require("./system-repository-catalog");

const workspaceRoot = path.resolve(__dirname, "..", "..", "..");

function createConfig(env = process.env) {
  const runtimeRoot = env.PROJECT_SERVER_RUNTIME_DIR
    ? path.resolve(env.PROJECT_SERVER_RUNTIME_DIR)
    : path.join(workspaceRoot, ".runtime");
  const sqlitePath = env.PROJECT_SERVER_SQLITE_PATH || env.PERSISTENCE_SQLITE_PATH
    ? path.resolve(env.PROJECT_SERVER_SQLITE_PATH || env.PERSISTENCE_SQLITE_PATH)
    : path.join(runtimeRoot, "gernetix-projects.sqlite");
  const persistenceBackend = env.PERSISTENCE_BACKEND || env.PROJECT_SERVER_PERSISTENCE_BACKEND || "sqlite";
  const postgresRuntime = ["postgres", "postgresql"].includes(persistenceBackend);
  const repositoryStoreBackend = env.PROJECT_REPOSITORY_STORE || (postgresRuntime ? "forgejo" : "sql");
  if (postgresRuntime && repositoryStoreBackend !== "forgejo") {
    throw new Error("legacy_sql_project_sources_runtime_forbidden");
  }

  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 4800),
    publicBaseUrl: env.PROJECT_SERVER_BASE_URL || "",
    persistenceBackend,
    runtimeRoot,
    sqlitePath,
    repositoryStoreBackend,
    requireForgejoForNewProjects: env.PROJECT_REQUIRE_FORGEJO_NEW_PROJECTS === "true" || (postgresRuntime && env.PROJECT_REQUIRE_FORGEJO_NEW_PROJECTS !== "false"),
    adminReadToken: env.PROJECT_ADMIN_READ_TOKEN || "",
    systemRepositories: createSystemRepositoryCatalog(env),
    forgejo: {
      baseUrl: env.FORGEJO_INTERNAL_URL || "",
      organization: env.FORGEJO_PROJECT_ORGANIZATION || "gernetix-projects",
      protectedOrganizations: ["gernetix-platform", "gernetix-products"],
      defaultBranch: env.FORGEJO_PROJECT_DEFAULT_BRANCH || "main",
      provisionToken: env.FORGEJO_PROVISION_TOKEN || "",
      runtimeToken: env.FORGEJO_RUNTIME_TOKEN || "",
      gitBinary: env.GIT_BINARY || "git",
      timeoutMs: Number(env.FORGEJO_TIMEOUT_MS || 10_000),
      gitTimeoutMs: Number(env.PROJECT_GIT_TIMEOUT_MS || 30_000),
    },
    postgres: {
      connectionString: env.PROJECT_POSTGRES_URL || "",
      host: env.PROJECT_POSTGRES_HOST || "127.0.0.1",
      port: Number(env.PROJECT_POSTGRES_PORT || 5432),
      database: env.PROJECT_POSTGRES_DATABASE || "gernetix_runtime",
      user: env.PROJECT_POSTGRES_USER || "gernetix_runtime",
      password: env.PROJECT_POSTGRES_PASSWORD || "",
    },
  };
}

module.exports = { createConfig };
