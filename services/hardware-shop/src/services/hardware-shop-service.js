const crypto = require("node:crypto");
const { HardwareShopError } = require("../errors");

class HardwareShopService {
  constructor(options) {
    this.repository = options.repository;
  }

  listCapabilities() {
    return this.repository.listCapabilities();
  }

  upsertCapability(input = {}) {
    const capability = {
      capability_id: input.capability_id || required(input.id, "capability_id"),
      title: required(input.title, "title"),
      owner_domain: input.owner_domain || "Hardware",
      status: input.status || "active",
      summary: input.summary || "",
    };
    return this.repository.saveCapability(capability);
  }

  listHardwareItems(query = {}) {
    return this.repository.listHardwareItems({
      item_type: query.item_type || query.itemType || "",
      status: query.status || "active",
    });
  }

  getHardwareItem(itemId) {
    const item = this.repository.findHardwareItem(itemId);
    if (!item) throw new HardwareShopError("hardware_item_not_found", "HardwareItem wurde nicht gefunden.", 404);
    return item;
  }

  listProcessorBoards() {
    return this.repository.listHardwareItems({ item_type: "processor_board", status: "active" });
  }

  upsertHardwareItem(input = {}) {
    const capabilityIds = normalizeList(input.capability_ids || input.capabilities);
    for (const capabilityId of capabilityIds) this.requireCapability(capabilityId);
    const item = {
      hardware_item_id: input.hardware_item_id || input.id || createId("hardware"),
      sku: required(input.sku, "sku"),
      item_type: input.item_type || "module",
      title: required(input.title, "title"),
      summary: input.summary || "",
      capability_ids: capabilityIds,
      support_policy: input.support_policy || "community_usable_no_gernetix_hardware_entitlement",
      provisioning_profile_id: input.provisioning_profile_id || "",
      status: input.status || "active",
    };
    return this.repository.saveHardwareItem(item);
  }

  listOffers(query = {}) {
    return this.repository.listOffers({
      status: query.status || "active",
      offer_type: query.offer_type || query.offerType || "",
    }).map((offer) => this.decorateOffer(offer));
  }

  getOffer(offerId) {
    return this.decorateOffer(this.requireOffer(offerId));
  }

  upsertOffer(input = {}) {
    const hardwareItemIds = normalizeList(input.hardware_item_ids || input.hardwareItems);
    for (const itemId of hardwareItemIds) this.getHardwareItem(itemId);
    const offer = {
      offer_id: input.offer_id || input.id || createId("offer"),
      offer_type: input.offer_type || "hardware_item",
      title: required(input.title, "title"),
      summary: input.summary || "",
      hardware_item_ids: hardwareItemIds,
      related_learning_project_ids: normalizeList(input.related_learning_project_ids || input.learning_project_ids),
      price: normalizePrice(input.price),
      stock_state: input.stock_state || "available",
      status: input.status || "active",
    };
    return this.decorateOffer(this.repository.saveOffer(offer));
  }

  matchOffers(input = {}) {
    const requiredCapabilities = normalizeList(input.required_capability_ids || input.requiredCapabilities);
    const ownedCapabilities = new Set(normalizeList(input.owned_capability_ids || input.ownedCapabilities));
    const effectiveRequired = requiredCapabilities.filter((capabilityId) => !ownedCapabilities.has(capabilityId));
    return this.listOffers({ status: "active" })
      .map((offer) => scoreOffer(offer, effectiveRequired))
      .sort((left, right) => Number(right.selectable) - Number(left.selectable) || right.match_score - left.match_score);
  }

  createCart(input = {}) {
    const now = new Date().toISOString();
    const cart = {
      cart_id: createId("cart"),
      account_id: required(input.account_id, "account_id"),
      items: [],
      status: "open",
      created_at: now,
      updated_at: now,
    };
    return this.enrichCart(this.repository.saveCart(cart));
  }

  getCart(cartId) {
    const cart = this.repository.findCart(cartId);
    if (!cart) throw new HardwareShopError("cart_not_found", "Warenkorb wurde nicht gefunden.", 404);
    return this.enrichCart(cart);
  }

  addCartItem(cartId, input = {}) {
    const cart = this.repository.findCart(cartId);
    if (!cart) throw new HardwareShopError("cart_not_found", "Warenkorb wurde nicht gefunden.", 404);
    if (cart.status !== "open") throw new HardwareShopError("cart_closed", "Warenkorb ist nicht mehr offen.", 409);
    const offer = this.requireOffer(required(input.offer_id, "offer_id"));
    const quantity = Number(input.quantity || 1);
    if (!Number.isInteger(quantity) || quantity <= 0) throw new HardwareShopError("invalid_quantity", "Menge muss eine positive Ganzzahl sein.");
    const next = {
      ...cart,
      items: mergeItems(cart.items, { offer_id: offer.offer_id, quantity }),
      updated_at: new Date().toISOString(),
    };
    return this.enrichCart(this.repository.saveCart(next));
  }

  createOrder(input = {}) {
    const cart = this.repository.findCart(required(input.cart_id, "cart_id"));
    if (!cart) throw new HardwareShopError("cart_not_found", "Warenkorb wurde nicht gefunden.", 404);
    if (!cart.items.length) throw new HardwareShopError("empty_cart", "Warenkorb ist leer.");
    const enriched = this.enrichCart(cart);
    const now = new Date().toISOString();
    const order = {
      order_id: createId("order"),
      account_id: cart.account_id,
      cart_id: cart.cart_id,
      status: input.payment_status === "paid" ? "paid" : "created",
      payment_status: input.payment_status || "mock_pending",
      fulfillment_status: "not_fulfilled",
      items: enriched.items,
      totals: enriched.totals,
      purchase_context: createPurchaseContext(enriched),
      created_at: now,
      updated_at: now,
    };
    this.repository.saveCart({ ...cart, status: "ordered", updated_at: now });
    return this.repository.saveOrder(order);
  }

  getOrder(orderId) {
    const order = this.repository.findOrder(orderId);
    if (!order) throw new HardwareShopError("order_not_found", "Bestellung wurde nicht gefunden.", 404);
    return order;
  }

  purchaseContext(orderId) {
    return this.getOrder(orderId).purchase_context;
  }

  decorateOffer(offer) {
    const items = offer.hardware_item_ids.map((itemId) => this.getHardwareItem(itemId));
    const capabilityIds = unique(items.flatMap((item) => item.capability_ids));
    return {
      ...offer,
      hardware_items: items,
      capability_ids: capabilityIds,
      provisionable: items.some((item) => Boolean(item.provisioning_profile_id)),
      support_basis: items.some((item) => item.support_policy === "gernetix_verified_after_provisioning")
        ? "gernetix_purchase_context"
        : "component_or_community_context",
    };
  }

  enrichCart(cart) {
    const items = cart.items.map((item) => {
      const offer = this.getOffer(item.offer_id);
      return {
        ...item,
        offer,
        line_total_cents: offer.price.amount_cents * item.quantity,
      };
    });
    return {
      ...cart,
      items,
      totals: {
        amount_cents: items.reduce((sum, item) => sum + item.line_total_cents, 0),
        currency: items[0] ? items[0].offer.price.currency : "EUR",
      },
    };
  }

  requireOffer(offerId) {
    const offer = this.repository.findOffer(offerId);
    if (!offer) throw new HardwareShopError("offer_not_found", "Shop-Angebot wurde nicht gefunden.", 404);
    return offer;
  }

  requireCapability(capabilityId) {
    const capability = this.repository.findCapability(capabilityId);
    if (!capability) throw new HardwareShopError("capability_not_found", "TechnicalCapability wurde nicht gefunden.", 404);
    return capability;
  }
}

function scoreOffer(offer, requiredCapabilities) {
  const missing = requiredCapabilities.filter((capabilityId) => !offer.capability_ids.includes(capabilityId));
  const covered = requiredCapabilities.length - missing.length;
  return {
    offer,
    selectable: missing.length === 0 && offer.stock_state === "available",
    match_score: requiredCapabilities.length ? covered / requiredCapabilities.length : 1,
    missing_capability_ids: missing,
  };
}

function createPurchaseContext(cart) {
  return {
    account_id: cart.account_id,
    purchased_offer_ids: cart.items.map((item) => item.offer_id),
    hardware_item_ids: unique(cart.items.flatMap((item) => item.offer.hardware_item_ids)),
    capability_ids: unique(cart.items.flatMap((item) => item.offer.capability_ids)),
    support_basis: cart.items.some((item) => item.offer.support_basis === "gernetix_purchase_context")
      ? "gernetix_purchase_context"
      : "component_or_community_context",
    provisioning_profile_ids: unique(cart.items.flatMap((item) => item.offer.hardware_items.map((hardwareItem) => hardwareItem.provisioning_profile_id).filter(Boolean))),
  };
}

function mergeItems(items, nextItem) {
  const existing = items.find((item) => item.offer_id === nextItem.offer_id);
  if (!existing) return [...items, nextItem];
  return items.map((item) => item.offer_id === nextItem.offer_id
    ? { ...item, quantity: item.quantity + nextItem.quantity }
    : item);
}

function normalizePrice(price = {}) {
  return {
    amount_cents: Number(price.amount_cents || price.amountCents || 0),
    currency: price.currency || "EUR",
    tax_included: price.tax_included !== false,
  };
}

function normalizeList(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  return String(value || "").split(",").map((item) => item.trim()).filter(Boolean);
}

function unique(values) {
  return Array.from(new Set(values));
}

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new HardwareShopError("missing_required_field", `Pflichtfeld fehlt: ${field}`);
  return normalized;
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

module.exports = { HardwareShopService };
