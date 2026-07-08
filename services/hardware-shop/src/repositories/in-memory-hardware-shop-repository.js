class InMemoryHardwareShopRepository {
  constructor(seed = defaultSeed()) {
    this.offers = new Map((seed.offers || []).map((item) => [item.offer_id, clone(item)]));
    this.carts = new Map((seed.carts || []).map((item) => [item.cart_id, clone(item)]));
    this.orders = new Map((seed.orders || []).map((item) => [item.order_id, clone(item)]));
  }

  saveOffer(offer) {
    this.offers.set(offer.offer_id, clone(offer));
    return clone(offer);
  }

  listOffers(filter = {}) {
    return Array.from(this.offers.values())
      .filter((offer) => !filter.status || offer.status === filter.status)
      .filter((offer) => !filter.offer_type || offer.offer_type === filter.offer_type)
      .map(clone);
  }

  findOffer(offerId) {
    return clone(this.offers.get(offerId));
  }

  saveCart(cart) {
    this.carts.set(cart.cart_id, clone(cart));
    return clone(cart);
  }

  findCart(cartId) {
    return clone(this.carts.get(cartId));
  }

  saveOrder(order) {
    this.orders.set(order.order_id, clone(order));
    return clone(order);
  }

  findOrder(orderId) {
    return clone(this.orders.get(orderId));
  }
}

function defaultSeed() {
  return {
    offers: [
      {
        offer_id: "offer.esp32_starter_board",
        offer_type: "processor_board",
        title: "ESP32 Starter Board",
        summary: "Vorbereitetes ESP32-Board fuer IDE, USB-Flash und spaeteres OTA.",
        hardware_item_ids: ["hardware.processor_board.generic_esp_wroom32"],
        related_learning_project_ids: ["learning_project.esp32_ota_bootstrap"],
        price: { amount_cents: 2490, currency: "EUR", tax_included: true },
        stock_state: "available",
        status: "active",
      },
      {
        offer_id: "offer.book_vault_hardware_bundle",
        offer_type: "hardware_bundle",
        title: "Buchtresor Hardware-Bundle",
        summary: "ESP32, RFID, Tags, Servo und Mechanik-Grundteile fuer das Buchtresor-Projekt.",
        hardware_item_ids: ["hardware.processor_board.generic_esp_wroom32", "hardware.module.rfid_rc522", "hardware.actuator.micro_servo"],
        related_learning_project_ids: ["learning_path.maker_access_and_mechanics"],
        price: { amount_cents: 4990, currency: "EUR", tax_included: true },
        stock_state: "available",
        status: "active",
      },
    ],
  };
}

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

module.exports = { InMemoryHardwareShopRepository, defaultSeed };
