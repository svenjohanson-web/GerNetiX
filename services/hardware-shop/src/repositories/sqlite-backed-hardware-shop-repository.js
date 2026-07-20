const { SqliteStateStore, jsonColumn } = require("../../../shared");
const { InMemoryHardwareShopRepository, defaultSeed } = require("./in-memory-hardware-shop-repository");

class SqliteBackedHardwareShopRepository extends InMemoryHardwareShopRepository {
  constructor(store) {
    const loaded = store.load();
    super({
      ...defaultSeed(),
      ...loaded,
      offers: mergeOffers(defaultSeed().offers, loaded.offers || []),
    });
    this.store = store;
    this.store.ensureSchema?.(hardwareShopSchema());
  }

  static create(sqlitePath) {
    return new SqliteBackedHardwareShopRepository(new SqliteStateStore(sqlitePath, "hardware-shop", {
      defaultState: { carts: [], orders: [] },
      collectionMap: {
        offers: "offers",
        carts: "carts",
        orders: "orders",
      },
    }));
  }

  saveOffer(offer) {
    const result = super.saveOffer(offer);
    this.persist();
    return result;
  }

  saveCart(cart) {
    const result = super.saveCart(cart);
    this.persist();
    return result;
  }

  saveOrder(order) {
    const result = super.saveOrder(order);
    this.persist();
    return result;
  }

  persist() {
    const state = {
      offers: Array.from(this.offers.values()),
      carts: Array.from(this.carts.values()),
      orders: Array.from(this.orders.values()),
    };
    this.store.save(state);
    this.store.replaceCollection?.("offers", state.offers, "offer_id");
    this.store.replaceCollection?.("carts", state.carts, "cart_id");
    this.store.replaceCollection?.("orders", state.orders, "order_id");
    if (typeof this.store.replaceTable === "function") {
      this.store.replaceTable("hardware_shop_offers", state.offers, offerColumns());
      this.store.replaceTable("hardware_shop_carts", state.carts, cartColumns());
      this.store.replaceTable("hardware_shop_orders", state.orders, orderColumns());
    }
  }
}

function mergeOffers(defaultOffers, loadedOffers) {
  const byId = new Map((loadedOffers || []).map((offer) => [offer.offer_id, offer]));
  for (const offer of defaultOffers || []) {
    if (!byId.has(offer.offer_id)) byId.set(offer.offer_id, offer);
  }
  return Array.from(byId.values());
}

function hardwareShopSchema() {
  return [
    `CREATE TABLE IF NOT EXISTS hardware_shop_offers (offer_id TEXT PRIMARY KEY, offer_type TEXT, title TEXT, summary TEXT, hardware_item_ids_json TEXT, related_learning_project_ids_json TEXT, price_json TEXT, stock_state TEXT, status TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS hardware_shop_carts (cart_id TEXT PRIMARY KEY, account_id TEXT, status TEXT, items_json TEXT, created_at TEXT, updated_at TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS hardware_shop_orders (order_id TEXT PRIMARY KEY, cart_id TEXT, account_id TEXT, status TEXT, payment_status TEXT, fulfillment_status TEXT, totals_json TEXT, items_json TEXT, created_at TEXT, raw_json TEXT NOT NULL);`,
  ];
}

function columns(names) {
  return Object.fromEntries(names.map((name) => [name, name]));
}

function offerColumns() {
  return { ...columns(["offer_id", "offer_type", "title", "summary", "stock_state", "status"]), hardware_item_ids_json: jsonColumn("hardware_item_ids"), related_learning_project_ids_json: jsonColumn("related_learning_project_ids"), price_json: jsonColumn("price"), raw_json: jsonColumn((row) => row) };
}

function cartColumns() {
  return { ...columns(["cart_id", "account_id", "status", "created_at", "updated_at"]), items_json: jsonColumn("items"), raw_json: jsonColumn((row) => row) };
}

function orderColumns() {
  return { ...columns(["order_id", "cart_id", "account_id", "status", "payment_status", "fulfillment_status", "created_at"]), totals_json: jsonColumn("totals"), items_json: jsonColumn("items"), raw_json: jsonColumn((row) => row) };
}

module.exports = { SqliteBackedHardwareShopRepository };
