const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");
const {
  readLegacyHardwareCatalogState,
  requiredSecret,
} = require("./migrate-hardware-catalog-sqlite-to-postgres");

test("reads Hardware Catalog documents and retains current seed additions", () => {
  const sqlitePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "hardware-catalog-migration-")), "legacy.sqlite");
  const db = new DatabaseSync(sqlitePath);
  db.exec(`
    CREATE TABLE service_documents (
      service_key TEXT, collection_name TEXT, document_id TEXT, document_json TEXT
    )
  `);
  db.prepare("INSERT INTO service_documents VALUES (?,?,?,?)").run(
    "hardware-catalog",
    "hardware_items",
    "hardware.custom",
    JSON.stringify({
      hardware_item_id: "hardware.custom",
      sku: "CUSTOM",
      item_type: "module",
      title: "Custom",
      status: "active",
    }),
  );
  db.close();

  const state = readLegacyHardwareCatalogState(sqlitePath);
  assert.equal(state.hardwareItems.some((item) => item.hardware_item_id === "hardware.custom"), true);
  assert.equal(state.hardwareItems.some((item) => item.hardware_item_id === "hardware.processor_board.esp32_s3_es3c28p"), true);
  assert.equal(state.capabilities.some((item) => item.capability_id === "capability.wifi"), true);
});

test("requires a Hardware Catalog PostgreSQL password", () => {
  assert.throws(() => requiredSecret(""), /HARDWARE_CATALOG_POSTGRES_PASSWORD/);
  assert.equal(requiredSecret("secret"), "secret");
});
