"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createConfig } = require("../src/config");
const {
  PostgresHardwareShopRepository,
} = require("../src/repositories/postgres-hardware-shop-repository");

test("uses the central runtime PostgreSQL database by default", () => {
  const config = createConfig({});
  assert.equal(config.persistenceBackend, "postgres");
  assert.equal(config.postgres.database, "gernetix_runtime");
});

test("creates normalized Hardware Shop tables", async () => {
  const pool = new RecordingPool();
  const repository = new PostgresHardwareShopRepository(pool);
  await repository.ensureSchema();
  assert.match(pool.calls[0].text, /hardware_shop_offers/);
  assert.match(pool.calls[0].text, /hardware_shop_carts/);
  assert.match(pool.calls[0].text, /hardware_shop_orders/);
  assert.match(pool.calls[0].text, /hardware_shop_migrations/);
});

test("queries offers by status and type in PostgreSQL", async () => {
  const offer = { offer_id: "offer.test", offer_type: "hardware_item" };
  const pool = new RecordingPool([{ raw_json: offer }]);
  const repository = new PostgresHardwareShopRepository(pool);
  assert.deepEqual(await repository.listOffers({
    status: "active",
    offer_type: "hardware_item",
  }), [offer]);
  assert.deepEqual(pool.calls[0].values, ["active", "hardware_item"]);
  assert.match(pool.calls[0].text, /status=\$1 AND offer_type=\$2/);
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
