const { HardwareShopError } = require("./errors");

const prefix = "/api/hardware-shop";

function createHttpApp(options) {
  const service = options.service;

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
      sendJson(res, 201, await service.createCart(await readJsonBody(req)));
      return;
    }

    const cart = path.match(new RegExp(`^${prefix}/carts/([^/]+)$`));
    if (req.method === "GET" && cart) {
      sendJson(res, 200, await service.getCart(decodeURIComponent(cart[1])));
      return;
    }

    const cartItems = path.match(new RegExp(`^${prefix}/carts/([^/]+)/items$`));
    if (req.method === "POST" && cartItems) {
      sendJson(res, 200, await service.addCartItem(decodeURIComponent(cartItems[1]), await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/orders`) {
      sendJson(res, 201, await service.createOrder(await readJsonBody(req)));
      return;
    }

    const order = path.match(new RegExp(`^${prefix}/orders/([^/]+)$`));
    if (req.method === "GET" && order) {
      sendJson(res, 200, service.getOrder(decodeURIComponent(order[1])));
      return;
    }

    const purchaseContext = path.match(new RegExp(`^${prefix}/orders/([^/]+)/purchase-context$`));
    if (req.method === "GET" && purchaseContext) {
      sendJson(res, 200, service.purchaseContext(decodeURIComponent(purchaseContext[1])));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/admin/offers`) {
      sendJson(res, 201, await service.upsertOffer(await readJsonBody(req)));
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  };
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
