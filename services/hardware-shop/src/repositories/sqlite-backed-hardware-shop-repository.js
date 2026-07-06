const { SqliteSnapshotStore } = require("../../../shared");
const { InMemoryHardwareShopRepository, defaultSeed } = require("./in-memory-hardware-shop-repository");

class SqliteBackedHardwareShopRepository extends InMemoryHardwareShopRepository {
  constructor(store) {
    super({ ...defaultSeed(), ...store.load() });
    this.store = store;
  }

  static create(sqlitePath) {
    return new SqliteBackedHardwareShopRepository(new SqliteSnapshotStore(sqlitePath, "hardware-shop", {
      defaultState: { carts: [], orders: [] },
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
    this.store.save({
      capabilities: Array.from(this.capabilities.values()),
      hardwareItems: Array.from(this.hardwareItems.values()),
      offers: Array.from(this.offers.values()),
      carts: Array.from(this.carts.values()),
      orders: Array.from(this.orders.values()),
    });
  }
}

module.exports = { SqliteBackedHardwareShopRepository };
