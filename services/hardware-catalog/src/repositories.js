const { SqliteStateStore, jsonColumn } = require("../../shared");
const { defaultCatalogSeed } = require("./seed");

class InMemoryHardwareCatalogRepository {
  constructor(seed = defaultCatalogSeed()) {
    this.capabilities = new Map((seed.capabilities || []).map((item) => [item.capability_id, clone(item)]));
    this.hardwareItems = new Map((seed.hardwareItems || []).map((item) => [item.hardware_item_id, clone(item)]));
  }

  listCapabilities() {
    return Array.from(this.capabilities.values()).map(clone);
  }

  findCapability(capabilityId) {
    return clone(this.capabilities.get(capabilityId));
  }

  saveCapability(capability) {
    this.capabilities.set(capability.capability_id, clone(capability));
    return clone(capability);
  }

  listHardwareItems(filter = {}) {
    return Array.from(this.hardwareItems.values())
      .filter((item) => !filter.item_type || item.item_type === filter.item_type)
      .filter((item) => !filter.status || item.status === filter.status)
      .map(clone);
  }

  findHardwareItem(itemId) {
    return clone(this.hardwareItems.get(itemId));
  }

  saveHardwareItem(item) {
    this.hardwareItems.set(item.hardware_item_id, clone(item));
    return clone(item);
  }
}

class SqliteBackedHardwareCatalogRepository extends InMemoryHardwareCatalogRepository {
  constructor(store) {
    const loaded = store.load();
    const catalogSeed = defaultCatalogSeed();
    const seed = mergeSeed(catalogSeed, migrateLoadedCatalog(catalogSeed, loaded));
    super(seed);
    this.store = store;
    this.store.ensureSchema?.(hardwareCatalogSchema());
    this.persist();
  }

  static create(sqlitePath) {
    return new SqliteBackedHardwareCatalogRepository(new SqliteStateStore(sqlitePath, "hardware-catalog", {
      defaultState: defaultCatalogSeed(),
      collectionMap: {
        capabilities: "capabilities",
        hardwareItems: "hardware_items",
      },
    }));
  }

  saveCapability(capability) {
    const result = super.saveCapability(capability);
    this.persist();
    return result;
  }

  saveHardwareItem(item) {
    const result = super.saveHardwareItem(item);
    this.persist();
    return result;
  }

  persist() {
    const state = {
      capabilities: Array.from(this.capabilities.values()),
      hardwareItems: Array.from(this.hardwareItems.values()),
    };
    this.store.save(state);
    this.store.replaceCollection?.("capabilities", state.capabilities, "capability_id");
    this.store.replaceCollection?.("hardware_items", state.hardwareItems, "hardware_item_id");
    if (typeof this.store.replaceTable === "function") {
      this.store.replaceTable("hardware_catalog_capabilities", state.capabilities, columns(["capability_id", "title", "owner_domain", "status"]));
      this.store.replaceTable("hardware_catalog_items", state.hardwareItems, itemColumns());
    }
  }
}

function hardwareCatalogSchema() {
  return [
    `CREATE TABLE IF NOT EXISTS hardware_catalog_capabilities (capability_id TEXT PRIMARY KEY, title TEXT, owner_domain TEXT, status TEXT, raw_json TEXT);`,
    `CREATE TABLE IF NOT EXISTS hardware_catalog_items (hardware_item_id TEXT PRIMARY KEY, sku TEXT, item_type TEXT, title TEXT, summary TEXT, capability_ids_json TEXT, support_policy TEXT, provisioning_profile_id TEXT, status TEXT, raw_json TEXT NOT NULL);`,
  ];
}

function columns(names) {
  return Object.fromEntries(names.map((name) => [name, name]));
}

function itemColumns() {
  return { ...columns(["hardware_item_id", "sku", "item_type", "title", "summary", "support_policy", "provisioning_profile_id", "status"]), capability_ids_json: jsonColumn("capability_ids"), raw_json: jsonColumn((row) => row) };
}

function mergeSeed(seed, loaded) {
  return {
    capabilities: mergeById(seed.capabilities, loaded.capabilities, "capability_id"),
    hardwareItems: mergeById(seed.hardwareItems, loaded.hardwareItems, "hardware_item_id"),
  };
}

function migrateLoadedCatalog(seed, loaded = {}) {
  const migrated = clone(loaded) || {};
  const itemId = "hardware.processor_board.esp32_s3_es3c28p";
  const seededBoard = (seed.hardwareItems || []).find((item) => item.hardware_item_id === itemId);
  const loadedBoard = (migrated.hardwareItems || []).find((item) => item.hardware_item_id === itemId);
  if (!seededBoard || !loadedBoard) return migrated;

  const loadedFeatures = loadedBoard.default_instance_configuration?.board_features;
  const seededFeatures = seededBoard.default_instance_configuration?.board_features || {};
  if (!loadedFeatures) return migrated;
  for (const featureId of ["ram", "flash"]) {
    if (!Object.prototype.hasOwnProperty.call(loadedFeatures, featureId) && seededFeatures[featureId]) {
      loadedFeatures[featureId] = clone(seededFeatures[featureId]);
    }
  }
  return migrated;
}

function mergeById(seedItems = [], loadedItems = [], idField) {
  const map = new Map(seedItems.map((item) => [item[idField], item]));
  for (const item of loadedItems || []) map.set(item[idField], item);
  return Array.from(map.values());
}

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

module.exports = { InMemoryHardwareCatalogRepository, SqliteBackedHardwareCatalogRepository };
