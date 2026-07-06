class InMemoryHardwareShopRepository {
  constructor(seed = defaultSeed()) {
    this.capabilities = new Map((seed.capabilities || []).map((item) => [item.capability_id, clone(item)]));
    this.hardwareItems = new Map((seed.hardwareItems || []).map((item) => [item.hardware_item_id, clone(item)]));
    this.offers = new Map((seed.offers || []).map((item) => [item.offer_id, clone(item)]));
    this.carts = new Map((seed.carts || []).map((item) => [item.cart_id, clone(item)]));
    this.orders = new Map((seed.orders || []).map((item) => [item.order_id, clone(item)]));
  }

  saveCapability(capability) {
    this.capabilities.set(capability.capability_id, clone(capability));
    return clone(capability);
  }

  listCapabilities() {
    return Array.from(this.capabilities.values()).map(clone);
  }

  findCapability(capabilityId) {
    return clone(this.capabilities.get(capabilityId));
  }

  saveHardwareItem(item) {
    this.hardwareItems.set(item.hardware_item_id, clone(item));
    return clone(item);
  }

  listHardwareItems(filter = {}) {
    return Array.from(this.hardwareItems.values())
      .filter((item) => !filter.item_type || item.item_type === filter.item_type)
      .filter((item) => !filter.status || item.status === filter.status)
      .map(clone);
  }

  findHardwareItem(itemId) {
    return clone(this.hardwareItems.get(itemId));
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
    capabilities: [
      capability("capability.processor_esp32", "ESP32 ProcessorBoard"),
      capability("capability.wifi", "WiFi"),
      capability("capability.ota", "OTA"),
      capability("capability.spi", "SPI"),
      capability("capability.rfid_reading", "RFID lesen"),
      capability("capability.servo_control", "Servo-Steuerung"),
      capability("capability.mechanical_locking", "Mechanische Verriegelung"),
      capability("capability.fallback_unlock", "Fallback-Entriegelung"),
      capability("capability.digital_input", "Digitaler Eingang"),
      capability("capability.digital_output", "Digitaler Ausgang"),
    ],
    hardwareItems: [
      {
        hardware_item_id: "hardware.processor_board.esp32_devkit",
        sku: "GNX-ESP32-DEVKIT",
        item_type: "processor_board",
        title: "GerNetiX ESP32 DevKit",
        summary: "ESP32-Board mit WiFi, OTA-vorbereiteter Basissoftware und Provisioning-Unterstuetzung.",
        capability_ids: ["capability.processor_esp32", "capability.wifi", "capability.ota", "capability.digital_input", "capability.digital_output"],
        support_policy: "gernetix_verified_after_provisioning",
        provisioning_profile_id: "provisioning_profile.esp32_ota_bootstrap",
        status: "active",
      },
      {
        hardware_item_id: "hardware.module.rfid_rc522",
        sku: "GNX-RFID-RC522",
        item_type: "module",
        title: "RFID RC522 Modul",
        summary: "RFID-Leser fuer Tags und Karten im SPI-Bus.",
        capability_ids: ["capability.spi", "capability.rfid_reading", "capability.item_identification"],
        support_policy: "component_support",
        provisioning_profile_id: "",
        status: "active",
      },
      {
        hardware_item_id: "hardware.actuator.micro_servo",
        sku: "GNX-SERVO-MICRO",
        item_type: "actuator",
        title: "Micro Servo",
        summary: "Kleiner Servo fuer Sperren, Klappen und mechanische Lernprojekte.",
        capability_ids: ["capability.servo_control", "capability.mechanical_locking", "capability.fallback_unlock"],
        support_policy: "component_support",
        provisioning_profile_id: "",
        status: "active",
      },
    ],
    offers: [
      {
        offer_id: "offer.esp32_starter_board",
        offer_type: "processor_board",
        title: "ESP32 Starter Board",
        summary: "Vorbereitetes ESP32-Board fuer IDE, USB-Flash und spaeteres OTA.",
        hardware_item_ids: ["hardware.processor_board.esp32_devkit"],
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
        hardware_item_ids: ["hardware.processor_board.esp32_devkit", "hardware.module.rfid_rc522", "hardware.actuator.micro_servo"],
        related_learning_project_ids: ["learning_path.maker_access_and_mechanics"],
        price: { amount_cents: 4990, currency: "EUR", tax_included: true },
        stock_state: "available",
        status: "active",
      },
    ],
  };
}

function capability(capabilityId, title) {
  return {
    capability_id: capabilityId,
    title,
    owner_domain: "Hardware",
    status: "active",
  };
}

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

module.exports = { InMemoryHardwareShopRepository, defaultSeed };
