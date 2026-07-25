function createConfig(env = process.env) {
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || env.HARDWARE_CATALOG_PORT || 4910),
    publicBaseUrl: env.HARDWARE_CATALOG_BASE_URL || "",
    persistenceBackend: env.PERSISTENCE_BACKEND || env.HARDWARE_CATALOG_PERSISTENCE_BACKEND || "postgres",
    sqlitePath: env.PERSISTENCE_SQLITE_PATH || env.HARDWARE_CATALOG_SQLITE_PATH || ".runtime/gernetix-services.sqlite",
    postgres: {
      connectionString: env.HARDWARE_CATALOG_POSTGRES_URL || "",
      host: env.HARDWARE_CATALOG_POSTGRES_HOST || "127.0.0.1",
      port: Number(env.HARDWARE_CATALOG_POSTGRES_PORT || 5432),
      database: env.HARDWARE_CATALOG_POSTGRES_DATABASE || "gernetix_runtime",
      user: env.HARDWARE_CATALOG_POSTGRES_USER || "gernetix_runtime",
      password: env.HARDWARE_CATALOG_POSTGRES_PASSWORD || "",
    },
  };
}

module.exports = { createConfig };
