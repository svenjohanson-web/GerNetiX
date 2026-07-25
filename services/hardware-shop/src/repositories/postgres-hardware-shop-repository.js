"use strict";

const { defaultSeed } = require("./in-memory-hardware-shop-repository");

class PostgresHardwareShopRepository {
  constructor(pool) {
    this.pool = pool;
  }

  static async create(options = {}) {
    const { Pool } = require("pg");
    const pool = options.pool || new Pool(options.poolOptions || options);
    const repository = new PostgresHardwareShopRepository(pool);
    await repository.ensureSchema();
    if (options.seedDefaults !== false) await repository.seedDefaults();
    return repository;
  }

  async ensureSchema() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS hardware_shop_offers (
        offer_id text PRIMARY KEY,
        offer_type text NOT NULL,
        title text NOT NULL,
        stock_state text NOT NULL,
        status text NOT NULL,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS idx_hardware_shop_offers_type_status
        ON hardware_shop_offers (offer_type, status, offer_id);

      CREATE TABLE IF NOT EXISTS hardware_shop_carts (
        cart_id text PRIMARY KEY,
        account_id text NOT NULL,
        status text NOT NULL,
        raw_json jsonb NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_hardware_shop_carts_account_status
        ON hardware_shop_carts (account_id, status, updated_at DESC);

      CREATE TABLE IF NOT EXISTS hardware_shop_orders (
        order_id text PRIMARY KEY,
        cart_id text NOT NULL,
        account_id text NOT NULL,
        status text NOT NULL,
        payment_status text NOT NULL,
        fulfillment_status text NOT NULL,
        raw_json jsonb NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_hardware_shop_orders_account_created
        ON hardware_shop_orders (account_id, created_at DESC);

      CREATE TABLE IF NOT EXISTS hardware_shop_migrations (
        migration_id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  async seedDefaults() {
    for (const offer of defaultSeed().offers || []) {
      await this.saveOffer(offer, { insertOnly: true });
    }
  }

  async saveOffer(offer, options = {}) {
    await this.pool.query(`
      INSERT INTO hardware_shop_offers
        (offer_id, offer_type, title, stock_state, status, raw_json)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (offer_id) DO ${options.insertOnly
    ? "NOTHING"
    : `UPDATE SET offer_type=EXCLUDED.offer_type, title=EXCLUDED.title,
        stock_state=EXCLUDED.stock_state, status=EXCLUDED.status,
        raw_json=EXCLUDED.raw_json, updated_at=now()`}
    `, [
      offer.offer_id,
      offer.offer_type || "hardware_item",
      offer.title,
      offer.stock_state || "available",
      offer.status || "active",
      offer,
    ]);
    return clone(offer);
  }

  async listOffers(filter = {}) {
    const conditions = [];
    const values = [];
    if (filter.status) {
      values.push(filter.status);
      conditions.push(`status=$${values.length}`);
    }
    if (filter.offer_type) {
      values.push(filter.offer_type);
      conditions.push(`offer_type=$${values.length}`);
    }
    const where = conditions.length ? ` WHERE ${conditions.join(" AND ")}` : "";
    return rows(await this.pool.query(
      `SELECT raw_json FROM hardware_shop_offers${where} ORDER BY offer_id`,
      values,
    ));
  }

  async findOffer(offerId) {
    return first(await this.pool.query(
      "SELECT raw_json FROM hardware_shop_offers WHERE offer_id=$1",
      [offerId],
    ));
  }

  async saveCart(cart) {
    await this.pool.query(`
      INSERT INTO hardware_shop_carts
        (cart_id, account_id, status, raw_json, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (cart_id) DO UPDATE SET
        account_id=EXCLUDED.account_id, status=EXCLUDED.status,
        raw_json=EXCLUDED.raw_json, updated_at=EXCLUDED.updated_at
    `, [
      cart.cart_id,
      cart.account_id,
      cart.status,
      cart,
      cart.created_at,
      cart.updated_at,
    ]);
    return clone(cart);
  }

  async findCart(cartId) {
    return first(await this.pool.query(
      "SELECT raw_json FROM hardware_shop_carts WHERE cart_id=$1",
      [cartId],
    ));
  }

  async saveOrder(order) {
    await this.pool.query(`
      INSERT INTO hardware_shop_orders
        (order_id, cart_id, account_id, status, payment_status,
         fulfillment_status, raw_json, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (order_id) DO UPDATE SET
        status=EXCLUDED.status, payment_status=EXCLUDED.payment_status,
        fulfillment_status=EXCLUDED.fulfillment_status,
        raw_json=EXCLUDED.raw_json, updated_at=EXCLUDED.updated_at
    `, [
      order.order_id,
      order.cart_id,
      order.account_id,
      order.status,
      order.payment_status,
      order.fulfillment_status,
      order,
      order.created_at,
      order.updated_at,
    ]);
    return clone(order);
  }

  async findOrder(orderId) {
    return first(await this.pool.query(
      "SELECT raw_json FROM hardware_shop_orders WHERE order_id=$1",
      [orderId],
    ));
  }

  async importLegacyState(state, migrationId = "hardware-shop-sqlite-v1") {
    const client = typeof this.pool.connect === "function" ? await this.pool.connect() : this.pool;
    try {
      await client.query("BEGIN");
      const applied = await client.query(
        "SELECT 1 FROM hardware_shop_migrations WHERE migration_id=$1",
        [migrationId],
      );
      if (applied.rowCount) {
        await client.query("ROLLBACK");
        return { imported: false, reason: "already_applied" };
      }
      const occupied = await client.query(`
        SELECT
          (SELECT count(*) FROM hardware_shop_offers)
          + (SELECT count(*) FROM hardware_shop_carts)
          + (SELECT count(*) FROM hardware_shop_orders) AS count
      `);
      if (Number(occupied.rows[0]?.count || 0) > 0) {
        throw new Error("Hardware-Shop-PostgreSQL-Ziel ist belegt, aber der Migrationsmarker fehlt.");
      }
      const repository = new PostgresHardwareShopRepository(client);
      for (const offer of state.offers || []) await repository.saveOffer(offer);
      for (const cart of state.carts || []) await repository.saveCart(cart);
      for (const order of state.orders || []) await repository.saveOrder(order);
      await client.query(
        "INSERT INTO hardware_shop_migrations (migration_id) VALUES ($1)",
        [migrationId],
      );
      await client.query("COMMIT");
      return {
        imported: true,
        counts: {
          offers: (state.offers || []).length,
          carts: (state.carts || []).length,
          orders: (state.orders || []).length,
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

module.exports = { PostgresHardwareShopRepository };
