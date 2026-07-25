#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");
const {
  PostgresHardwareShopRepository,
} = require("../services/hardware-shop/src/repositories/postgres-hardware-shop-repository");
const {
  mergeShopState,
} = require("../services/hardware-shop/src/repositories/sqlite-backed-hardware-shop-repository");

function readLegacyHardwareShopState(sqlitePath) {
  const loaded = { offers: [], carts: [], orders: [] };
  if (!sqlitePath || !fs.existsSync(sqlitePath)) return mergeShopState(loaded);
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    if (tableExists(db, "service_documents")) {
      for (const row of db.prepare(`
        SELECT collection_name, document_json
        FROM service_documents
        WHERE service_key='hardware-shop'
        ORDER BY collection_name, document_id
      `).all()) {
        const value = JSON.parse(row.document_json);
        if (row.collection_name === "offers") loaded.offers.push(value);
        if (row.collection_name === "carts") loaded.carts.push(value);
        if (row.collection_name === "orders") loaded.orders.push(value);
      }
      if (loaded.offers.length || loaded.carts.length || loaded.orders.length) {
        return mergeShopState(loaded);
      }
    }
    loaded.offers = readRawRows(db, "hardware_shop_offers", "offer_id");
    loaded.carts = readRawRows(db, "hardware_shop_carts", "cart_id");
    loaded.orders = readRawRows(db, "hardware_shop_orders", "order_id");
    return mergeShopState(loaded);
  } finally {
    db.close();
  }
}

function readRawRows(db, table, idColumn) {
  if (!tableExists(db, table)) return [];
  return db.prepare(
    `SELECT raw_json FROM ${table} ORDER BY ${idColumn}`,
  ).all().map((row) => JSON.parse(row.raw_json));
}

function tableExists(db, table) {
  return Boolean(db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
  ).get(table));
}

async function main() {
  const sqlitePath = process.env.HARDWARE_SHOP_SQLITE_PATH
    || process.env.PERSISTENCE_SQLITE_PATH
    || "/var/lib/gernetix/services/gernetix-services.sqlite";
  const repository = await PostgresHardwareShopRepository.create({
    seedDefaults: false,
    poolOptions: {
      connectionString: process.env.HARDWARE_SHOP_POSTGRES_URL || undefined,
      host: process.env.HARDWARE_SHOP_POSTGRES_HOST || "hardware-shop-postgres",
      port: Number(process.env.HARDWARE_SHOP_POSTGRES_PORT || 5432),
      database: process.env.HARDWARE_SHOP_POSTGRES_DATABASE || "gernetix_hardware_shop",
      user: process.env.HARDWARE_SHOP_POSTGRES_USER || "gernetix_hardware_shop",
      password: requiredSecret(process.env.HARDWARE_SHOP_POSTGRES_PASSWORD),
    },
  });
  try {
    const result = await repository.importLegacyState(readLegacyHardwareShopState(sqlitePath));
    process.stdout.write(`${JSON.stringify({ sqlite_path: sqlitePath, ...result })}\n`);
  } finally {
    await repository.close();
  }
}

function requiredSecret(value) {
  if (!String(value || "").trim()) throw new Error("HARDWARE_SHOP_POSTGRES_PASSWORD fehlt.");
  return value;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Hardware-Shop-Migration fehlgeschlagen: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { readLegacyHardwareShopState, requiredSecret };
