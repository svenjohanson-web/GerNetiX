const { HardwareShopError } = require("./errors");
const { assertDelegatedResource, readBearerToken, verifyDelegation, verifyInternalToken } = require("../../shared/internal-api-auth");

const prefix = "/api/hardware-shop";

function createHttpApp(options) {
  const service = options.service;
  const signingKey = options.internalApiSigningKey || "";

  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    if (req.method === "GET" && path === "/health") {
      sendJson(res, 200, { status: "ok", service: "hardware-shop" });
      return;
    }

    if (req.method === "GET" && path === `${prefix}/offers`) {
      sendJson(res, 200, { items: await service.listOffers(Object.fromEntries(url.searchParams.entries())) });
      return;
    }

    const offer = path.match(new RegExp(`^${prefix}/offers/([^/]+)$`));
    if (req.method === "GET" && offer) {
      sendJson(res, 200, await service.getOffer(decodeURIComponent(offer[1])));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/match`) {
      sendJson(res, 200, { items: await service.matchOffers(await readJsonBody(req)) });
      return;
    }

    if (req.method === "POST" && path === `${prefix}/carts`) {
      const body = await readJsonBody(req);
      requireAccount(req, signingKey, "shop.cart.write", body.account_id);
      sendJson(res, 201, await service.createCart(body));
      return;
    }

    const cart = path.match(new RegExp(`^${prefix}/carts/([^/]+)$`));
    if (req.method === "GET" && cart) {
      requireService(req, signingKey, "shop.cart.read");
      const result = await service.getCart(decodeURIComponent(cart[1]));
      requireDelegation(req, signingKey, "shop.cart.read", result.account_id);
      sendJson(res, 200, result);
      return;
    }

    const cartItems = path.match(new RegExp(`^${prefix}/carts/([^/]+)/items$`));
    if (req.method === "POST" && cartItems) {
      requireService(req, signingKey, "shop.cart.write");
      const cartId = decodeURIComponent(cartItems[1]);
      const current = await service.getCart(cartId);
      requireDelegation(req, signingKey, "shop.cart.write", current.account_id);
      sendJson(res, 200, await service.addCartItem(cartId, await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/orders`) {
      requireService(req, signingKey, "shop.order.write");
      const body = await readJsonBody(req);
      const current = await service.getCart(body.cart_id);
      requireDelegation(req, signingKey, "shop.order.write", current.account_id);
      sendJson(res, 201, await service.createOrder(body));
      return;
    }

    const order = path.match(new RegExp(`^${prefix}/orders/([^/]+)$`));
    if (req.method === "GET" && order) {
      requireService(req, signingKey, "shop.order.read");
      const result = await service.getOrder(decodeURIComponent(order[1]));
      requireDelegation(req, signingKey, "shop.order.read", result.account_id);
      sendJson(res, 200, result);
      return;
    }

    const purchaseContext = path.match(new RegExp(`^${prefix}/orders/([^/]+)/purchase-context$`));
    if (req.method === "GET" && purchaseContext) {
      requireService(req, signingKey, "shop.purchase_context.read");
      const orderId = decodeURIComponent(purchaseContext[1]);
      const current = await service.getOrder(orderId);
      requireDelegation(req, signingKey, "shop.purchase_context.read", current.account_id);
      sendJson(res, 200, await service.purchaseContext(orderId));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/admin/offers`) {
      requireService(req, signingKey, "shop.offer.admin");
      sendJson(res, 201, await service.upsertOffer(await readJsonBody(req)));
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  };
}

function requireAccount(req, signingKey, scope, accountId) {
  requireService(req, signingKey, scope);
  requireDelegation(req, signingKey, scope, accountId);
}

function requireService(req, signingKey, scope) {
  return verifyInternalToken(readBearerToken(req), signingKey, {
    audience: "hardware-shop", requiredScopes: [scope],
  });
}

function requireDelegation(req, signingKey, scope, accountId) {
  const delegation = verifyDelegation(req.headers["x-gernetix-delegation"], signingKey, {
    audience: "hardware-shop", requiredScopes: [scope],
  });
  assertDelegatedResource(delegation, { accountId: String(accountId || "") });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new HardwareShopError("request_too_large", "Request ist zu gross.", 413));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new HardwareShopError("invalid_json", "Request Body ist kein gueltiges JSON."));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

module.exports = { createHttpApp, sendJson };
