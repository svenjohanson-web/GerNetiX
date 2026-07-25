"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");
const {
  readLegacyHardwareShopState,
  requiredSecret,
} = require("./migrate-hardware-shop-sqlite-to-postgres");

test("reads Hardware Shop documents and retains current seed offers", () => {
  const sqlitePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "hardware-shop-migration-")), "legacy.sqlite");
  const db = new DatabaseSync(sqlitePath);
  db.exec(`
    CREATE TABLE service_documents (
      service_key TEXT, collection_name TEXT, document_id TEXT, document_json TEXT
    )
  `);
  db.prepare("INSERT INTO service_documents VALUES (?,?,?,?)").run(
    "hardware-shop",
    "orders",
    "order.custom",
    JSON.stringify({
      order_id: "order.custom",
      cart_id: "cart.custom",
      account_id: "acct-1",
      status: "paid",
      payment_status: "paid",
      fulfillment_status: "not_fulfilled",
      items: [],
      totals: { amount_cents: 0, currency: "EUR" },
      purchase_context: { purchase_context_id: "order.custom" },
      created_at: "2026-07-25T00:00:00.000Z",
      updated_at: "2026-07-25T00:00:00.000Z",
    }),
  );
  db.close();

  const state = readLegacyHardwareShopState(sqlitePath);
  assert.equal(state.orders.some((item) => item.order_id === "order.custom"), true);
  assert.equal(state.offers.some((item) => item.offer_id === "offer.esp32_starter_board"), true);
});

test("requires a Hardware Shop PostgreSQL password", () => {
  assert.throws(() => requiredSecret(""), /HARDWARE_SHOP_POSTGRES_PASSWORD/);
  assert.equal(requiredSecret("secret"), "secret");
});
