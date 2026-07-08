const assert = require("node:assert/strict");
const test = require("node:test");

const { createDefaultHardwareShop } = require("../src");

test("lists seeded capabilities, boards and offers", () => {
  const service = createDefaultHardwareShop();

  assert.equal(service.listCapabilities().some((item) => item.capability_id === "capability.wifi"), true);
  assert.equal(service.listProcessorBoards()[0].hardware_item_id, "hardware.processor_board.esp32_devkit");
  assert.equal(service.listProcessorBoards()[0].factory_firmware_artifact.source, "sqlite");
  assert.equal(service.listOffers().length >= 2, true);
});

test("matches book vault bundle by required capabilities", () => {
  const service = createDefaultHardwareShop();
  const matches = service.matchOffers({
    required_capability_ids: ["capability.rfid_reading", "capability.servo_control", "capability.mechanical_locking"],
  });

  assert.equal(matches[0].offer.offer_id, "offer.book_vault_hardware_bundle");
  assert.equal(matches[0].selectable, true);
  assert.equal(matches[0].missing_capability_ids.length, 0);
});

test("accounts for owned capabilities when matching", () => {
  const service = createDefaultHardwareShop();
  const matches = service.matchOffers({
    required_capability_ids: ["capability.processor_esp32", "capability.wifi", "capability.rfid_reading"],
    owned_capability_ids: ["capability.processor_esp32", "capability.wifi"],
  });

  assert.equal(matches[0].offer.offer_id, "offer.book_vault_hardware_bundle");
  assert.equal(matches[0].selectable, true);
});

test("creates cart, order and purchase context for device support", () => {
  const service = createDefaultHardwareShop();
  const cart = service.createCart({ account_id: "acct-1" });
  const updated = service.addCartItem(cart.cart_id, {
    offer_id: "offer.esp32_starter_board",
    quantity: 2,
  });
  const order = service.createOrder({ cart_id: cart.cart_id, payment_status: "paid" });
  const context = service.purchaseContext(order.order_id);

  assert.equal(updated.totals.amount_cents, 4980);
  assert.equal(order.status, "paid");
  assert.equal(context.support_basis, "gernetix_purchase_context");
  assert.equal(context.provisioning_profile_ids[0], "provisioning_profile.esp32_ota_bootstrap");
});

test("admin can add hardware item and offer with known capabilities", () => {
  const service = createDefaultHardwareShop();
  const item = service.upsertHardwareItem({
    hardware_item_id: "hardware.sensor.button",
    sku: "GNX-BUTTON",
    item_type: "sensor",
    title: "Button Modul",
    capability_ids: ["capability.digital_input"],
  });
  const offer = service.upsertOffer({
    offer_id: "offer.button_module",
    title: "Button Modul",
    hardware_item_ids: [item.hardware_item_id],
    price: { amount_cents: 390 },
  });

  assert.equal(offer.capability_ids[0], "capability.digital_input");
});
