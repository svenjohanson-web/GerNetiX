#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");
const {
  PostgresHardwareCatalogRepository,
} = require("../services/hardware-catalog/src/postgres-repository");
const {
  mergeCatalogState,
} = require("../services/hardware-catalog/src/repositories");

function readLegacyHardwareCatalogState(sqlitePath) {
  const loaded = { capabilities: [], hardwareItems: [] };
  if (!sqlitePath || !fs.existsSync(sqlitePath)) return mergeCatalogState(loaded);
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    if (tableExists(db, "service_documents")) {
      for (const row of db.prepare(`
        SELECT collection_name, document_json
        FROM service_documents
        WHERE service_key='hardware-catalog'
        ORDER BY collection_name, document_id
      `).all()) {
        const value = JSON.parse(row.document_json);
        if (row.collection_name === "capabilities") loaded.capabilities.push(value);
        if (row.collection_name === "hardware_items") loaded.hardwareItems.push(value);
      }
      if (loaded.capabilities.length || loaded.hardwareItems.length) {
        return mergeCatalogState(loaded);
      }
    }
    if (tableExists(db, "hardware_catalog_capabilities")) {
      loaded.capabilities = db.prepare(`
        SELECT capability_id, title, owner_domain, status
        FROM hardware_catalog_capabilities ORDER BY capability_id
      `).all().map((row) => ({
        ...row,
        owner_domain: row.owner_domain || "Hardware",
        status: row.status || "active",
        summary: "",
      }));
    }
    if (tableExists(db, "hardware_catalog_items")) {
      loaded.hardwareItems = db.prepare(
        "SELECT raw_json FROM hardware_catalog_items ORDER BY hardware_item_id",
      ).all().map((row) => JSON.parse(row.raw_json));
    }
    return mergeCatalogState(loaded);
  } finally {
    db.close();
  }
}

function tableExists(db, table) {
  return Boolean(db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
  ).get(table));
}

async function main() {
  const sqlitePath = process.env.HARDWARE_CATALOG_SQLITE_PATH
    || process.env.PERSISTENCE_SQLITE_PATH
    || "/var/lib/gernetix/services/gernetix-services.sqlite";
  const repository = await PostgresHardwareCatalogRepository.create({
    seedDefaults: false,
    poolOptions: {
      connectionString: process.env.HARDWARE_CATALOG_POSTGRES_URL || undefined,
      host: process.env.HARDWARE_CATALOG_POSTGRES_HOST || "hardware-catalog-postgres",
      port: Number(process.env.HARDWARE_CATALOG_POSTGRES_PORT || 5432),
      database: process.env.HARDWARE_CATALOG_POSTGRES_DATABASE || "gernetix_hardware_catalog",
      user: process.env.HARDWARE_CATALOG_POSTGRES_USER || "gernetix_hardware_catalog",
      password: requiredSecret(process.env.HARDWARE_CATALOG_POSTGRES_PASSWORD),
    },
  });
  try {
    const result = await repository.importLegacyState(readLegacyHardwareCatalogState(sqlitePath));
    process.stdout.write(`${JSON.stringify({ sqlite_path: sqlitePath, ...result })}\n`);
  } finally {
    await repository.close();
  }
}

function requiredSecret(value) {
  if (!String(value || "").trim()) throw new Error("HARDWARE_CATALOG_POSTGRES_PASSWORD fehlt.");
  return value;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Hardware-Catalog-Migration fehlgeschlagen: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { readLegacyHardwareCatalogState, requiredSecret };
