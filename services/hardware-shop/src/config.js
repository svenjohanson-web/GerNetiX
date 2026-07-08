function createConfig(env = process.env) {
  return {
    host: env.HOST || "127.0.0.1",
    port: Number(env.PORT || 4900),
    publicBaseUrl: env.HARDWARE_SHOP_BASE_URL || "",
    persistenceBackend: env.PERSISTENCE_BACKEND || env.HARDWARE_SHOP_PERSISTENCE_BACKEND || "sqlite",
    sqlitePath: env.PERSISTENCE_SQLITE_PATH || env.HARDWARE_SHOP_SQLITE_PATH || ".runtime/gernetix-services.sqlite",
    hardwareCatalogBaseUrl: env.HARDWARE_CATALOG_BASE_URL || "",
  };
}

module.exports = { createConfig };
