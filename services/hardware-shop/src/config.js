function createConfig(env = process.env) {
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 4900),
    publicBaseUrl: env.HARDWARE_SHOP_BASE_URL || "",
    persistenceBackend: env.PERSISTENCE_BACKEND || env.HARDWARE_SHOP_PERSISTENCE_BACKEND || "postgres",
    sqlitePath: env.PERSISTENCE_SQLITE_PATH || env.HARDWARE_SHOP_SQLITE_PATH || ".runtime/gernetix-services.sqlite",
    hardwareCatalogBaseUrl: env.HARDWARE_CATALOG_BASE_URL || "",
    postgres: {
      connectionString: env.HARDWARE_SHOP_POSTGRES_URL || "",
      host: env.HARDWARE_SHOP_POSTGRES_HOST || "127.0.0.1",
      port: Number(env.HARDWARE_SHOP_POSTGRES_PORT || 5432),
      database: env.HARDWARE_SHOP_POSTGRES_DATABASE || "gernetix_runtime",
      user: env.HARDWARE_SHOP_POSTGRES_USER || "gernetix_runtime",
      password: env.HARDWARE_SHOP_POSTGRES_PASSWORD || "",
    },
  };
}

module.exports = { createConfig };
