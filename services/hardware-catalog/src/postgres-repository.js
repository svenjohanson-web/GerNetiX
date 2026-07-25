"use strict";

const { defaultCatalogSeed } = require("./seed");

class PostgresHardwareCatalogRepository {
  constructor(pool) {
    this.pool = pool;
  }

  static async create(options = {}) {
    const { Pool } = require("pg");
    const pool = options.pool || new Pool(options.poolOptions || options);
    const repository = new PostgresHardwareCatalogRepository(pool);
    await repository.ensureSchema();
    if (options.seedDefaults !== false) await repository.seedDefaults();
    return repository;
  }

  async ensureSchema() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS hardware_catalog_capabilities (
        capability_id text PRIMARY KEY,
        title text NOT NULL,
        owner_domain text NOT NULL,
        status text NOT NULL,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_hardware_catalog_capabilities_status
        ON hardware_catalog_capabilities (status, capability_id);

      CREATE TABLE IF NOT EXISTS hardware_catalog_items (
        hardware_item_id text PRIMARY KEY,
        sku text NOT NULL,
        item_type text NOT NULL,
        status text NOT NULL,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_hardware_catalog_items_type_status
        ON hardware_catalog_items (item_type, status, hardware_item_id);

      CREATE TABLE IF NOT EXISTS hardware_catalog_migrations (
        migration_id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  async seedDefaults() {
    const seed = defaultCatalogSeed();
    for (const capability of seed.capabilities || []) {
      await this.saveCapability(capability, { insertOnly: true });
    }
    for (const item of seed.hardwareItems || []) {
      await this.saveHardwareItem(item, { insertOnly: true });
    }
  }

  async listCapabilities() {
    return rows(await this.pool.query(
      "SELECT raw_json FROM hardware_catalog_capabilities ORDER BY capability_id",
    ));
  }

  async findCapability(capabilityId) {
    return first(await this.pool.query(
      "SELECT raw_json FROM hardware_catalog_capabilities WHERE capability_id=$1",
      [capabilityId],
    ));
  }

  async saveCapability(capability, options = {}) {
    await this.pool.query(`
      INSERT INTO hardware_catalog_capabilities
        (capability_id, title, owner_domain, status, raw_json)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (capability_id) DO ${options.insertOnly
    ? "NOTHING"
    : `UPDATE SET title=EXCLUDED.title, owner_domain=EXCLUDED.owner_domain,
        status=EXCLUDED.status, raw_json=EXCLUDED.raw_json, updated_at=now()`}
    `, [
      capability.capability_id,
      capability.title,
      capability.owner_domain || "Hardware",
      capability.status || "active",
      capability,
    ]);
    return clone(capability);
  }

  async listHardwareItems(filter = {}) {
    const conditions = [];
    const values = [];
    if (filter.item_type) {
      values.push(filter.item_type);
      conditions.push(`item_type=$${values.length}`);
    }
    if (filter.status) {
      values.push(filter.status);
      conditions.push(`status=$${values.length}`);
    }
    const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
    return rows(await this.pool.query(
      `SELECT raw_json FROM hardware_catalog_items${where} ORDER BY hardware_item_id`,
      values,
    ));
  }

  async findHardwareItem(itemId) {
    return first(await this.pool.query(
      "SELECT raw_json FROM hardware_catalog_items WHERE hardware_item_id=$1",
      [itemId],
    ));
  }

  async saveHardwareItem(item, options = {}) {
    await this.pool.query(`
      INSERT INTO hardware_catalog_items
        (hardware_item_id, sku, item_type, status, raw_json)
      VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (hardware_item_id) DO ${options.insertOnly
    ? "NOTHING"
    : `UPDATE SET sku=EXCLUDED.sku, item_type=EXCLUDED.item_type,
        status=EXCLUDED.status, raw_json=EXCLUDED.raw_json, updated_at=now()`}
    `, [
      item.hardware_item_id,
      item.sku || item.hardware_item_id,
      item.item_type || "module",
      item.status || "active",
      item,
    ]);
    return clone(item);
  }

  async importLegacyState(state, migrationId = "hardware-catalog-sqlite-v1") {
    const client = typeof this.pool.connect === "function" ? await this.pool.connect() : this.pool;
    try {
      await client.query("BEGIN");
      const applied = await client.query(
        "SELECT 1 FROM hardware_catalog_migrations WHERE migration_id=$1",
        [migrationId],
      );
      if (applied.rowCount) {
        await client.query("ROLLBACK");
        return { imported: false, reason: "already_applied" };
      }
      const occupied = await client.query(`
        SELECT
          (SELECT count(*) FROM hardware_catalog_capabilities)
          + (SELECT count(*) FROM hardware_catalog_items) AS count
      `);
      if (Number(occupied.rows[0]?.count || 0) > 0) {
        throw new Error("Hardware-Catalog-PostgreSQL-Ziel ist belegt, aber der Migrationsmarker fehlt.");
      }
      const repository = new PostgresHardwareCatalogRepository(client);
      for (const capability of state.capabilities || []) await repository.saveCapability(capability);
      for (const item of state.hardwareItems || []) await repository.saveHardwareItem(item);
      await client.query(
        "INSERT INTO hardware_catalog_migrations (migration_id) VALUES ($1)",
        [migrationId],
      );
      await client.query("COMMIT");
      return {
        imported: true,
        counts: {
          capabilities: (state.capabilities || []).length,
          hardwareItems: (state.hardwareItems || []).length,
        },
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      if (client !== this.pool) client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

function first(result) {
  return result.rows[0] ? clone(result.rows[0].raw_json) : null;
}

function rows(result) {
  return result.rows.map((row) => clone(row.raw_json));
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

module.exports = { PostgresHardwareCatalogRepository };
