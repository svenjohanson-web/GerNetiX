const assert = require("node:assert/strict");
const test = require("node:test");

const { createDefaultHardwareShop } = require("../src");

test("lists catalog capabilities, boards and shop offers", async () => {
  const service = createDefaultHardwareShop();

  assert.equal((await service.listCapabilities()).some((item) => item.capability_id === "capability.wifi"), true);
  assert.equal((await service.listProcessorBoards()).some((item) => item.hardware_item_id === "hardware.processor_board.generic_esp_wroom32"), true);
  assert.equal((await service.listProcessorBoards()).find((item) => item.hardware_item_id === "hardware.processor_board.generic_esp_wroom32").factory_firmware_artifact.source, "sqlite");
  assert.equal((await service.listOffers()).length >= 2, true);
});

test("matches book vault bundle by required capabilities", async () => {
  const service = createDefaultHardwareShop();
  const matches = await service.matchOffers({
    required_capability_ids: ["capability.rfid_reading", "capability.servo_control", "capability.mechanical_locking"],
  });

  assert.equal(matches[0].offer.offer_id, "offer.book_vault_hardware_bundle");
  assert.equal(matches[0].selectable, true);
  assert.equal(matches[0].missing_capability_ids.length, 0);
});

test("accounts for owned capabilities when matching", async () => {
  const service = createDefaultHardwareShop();
  const matches = await service.matchOffers({
    required_capability_ids: ["capability.processor_esp32", "capability.wifi", "capability.rfid_reading"],
    owned_capability_ids: ["capability.processor_esp32", "capability.wifi"],
  });

  assert.equal(matches[0].offer.offer_id, "offer.book_vault_hardware_bundle");
  assert.equal(matches[0].selectable, true);
});

test("creates cart, order and purchase context for device support", async () => {
  const service = createDefaultHardwareShop();
  const cart = await service.createCart({ account_id: "acct-1" });
  const updated = await service.addCartItem(cart.cart_id, {
    offer_id: "offer.esp32_starter_board",
    quantity: 2,
  });
  const order = await service.createOrder({ cart_id: cart.cart_id, payment_status: "paid" });
  const context = service.purchaseContext(order.order_id);

  assert.equal(updated.totals.amount_cents, 4980);
  assert.equal(order.status, "paid");
  assert.equal(context.support_basis, "gernetix_purchase_context");
  assert.equal(context.provisioning_profile_ids[0], "provisioning_profile.esp32_ota_bootstrap");
});

test("admin can add offer for known catalog item", async () => {
  const service = createDefaultHardwareShop();
  const offer = await service.upsertOffer({
    offer_id: "offer.esp_wroom32_board",
    title: "Generisches ESP-WROOM-32 Board",
    hardware_item_ids: ["hardware.processor_board.generic_esp_wroom32"],
    price: { amount_cents: 390 },
  });

  assert.equal(offer.capability_ids.includes("capability.processor_esp32"), true);
});
