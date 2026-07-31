const assert = require("node:assert/strict");
const test = require("node:test");
const { createConfig } = require("../src/config");
const {
  PostgresHardwareCatalogRepository,
} = require("../src/postgres-repository");

test("uses the central runtime PostgreSQL database by default", () => {
  const config = createConfig({});
  assert.equal(config.persistenceBackend, "postgres");
  assert.equal(config.postgres.database, "gernetix_runtime");
});

test("creates normalized Hardware Catalog tables", async () => {
  const pool = new RecordingPool();
  const repository = new PostgresHardwareCatalogRepository(pool);
  await repository.ensureSchema();
  assert.match(pool.calls[0].text, /hardware_catalog_capabilities/);
  assert.match(pool.calls[0].text, /hardware_catalog_items/);
  assert.match(pool.calls[0].text, /hardware_catalog_migrations/);
});

test("queries hardware items by type and status in PostgreSQL", async () => {
  const item = { hardware_item_id: "hardware.board", item_type: "processor_board" };
  const pool = new RecordingPool([{ raw_json: item }]);
  const repository = new PostgresHardwareCatalogRepository(pool);
  assert.deepEqual(await repository.listHardwareItems({
    item_type: "processor_board",
    status: "active",
  }), [item]);
  assert.deepEqual(pool.calls[0].values, ["processor_board", "active"]);
  assert.match(pool.calls[0].text, /item_type=\$1 AND status=\$2/);
});

test("reconciles PostgreSQL board feature pins with the catalog pin profile", async () => {
  const item = {
    hardware_item_id: "hardware.board",
    sku: "BOARD",
    item_type: "processor_board",
    pin_profile: { assigned_pins: { display_spi: { sclk: 12, cs: 10 } } },
    default_instance_configuration: { board_features: { display: { enabled: true, connection: "spi" } } },
  };
  const pool = new RecordingPool([{ raw_json: item }]);
  const repository = new PostgresHardwareCatalogRepository(pool);
  await repository.synchronizeBoardPins();
  const update = pool.calls.find((call) => /INSERT INTO hardware_catalog_items/.test(call.text));
  assert.ok(update);
  assert.deepEqual(update.values[4].default_instance_configuration.board_features.display.pins, { sclk: 12, cs: 10 });
  assert.equal(update.values[4].default_instance_configuration.board_features.display.pin_assignment_group, "display_spi");
});

class RecordingPool {
  constructor(rows = []) {
    this.rows = rows;
    this.calls = [];
  }

  async query(text, values = []) {
    this.calls.push({ text, values });
    return { rows: this.rows, rowCount: this.rows.length };
  }
}
