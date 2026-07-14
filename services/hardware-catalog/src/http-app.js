const { HardwareCatalogError } = require("./errors");

const prefix = "/api/hardware-catalog";

function createHttpApp(options) {
  const service = options.service;

  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    if (req.method === "GET" && path === "/health") {
      sendJson(res, 200, { status: "ok", service: "hardware-catalog" });
      return;
    }

    if (req.method === "GET" && path === `${prefix}/capabilities`) {
      sendJson(res, 200, { items: service.listCapabilities() });
      return;
    }

    const capability = path.match(new RegExp(`^${prefix}/capabilities/([^/]+)$`));
    if (req.method === "GET" && capability) {
      sendJson(res, 200, service.getCapability(decodeURIComponent(capability[1])));
      return;
    }

    if (req.method === "GET" && path === `${prefix}/hardware-items`) {
      sendJson(res, 200, { items: service.listHardwareItems(Object.fromEntries(url.searchParams.entries())) });
      return;
    }

    const hardwareItem = path.match(new RegExp(`^${prefix}/hardware-items/([^/]+)$`));
    if (req.method === "GET" && hardwareItem) {
      sendJson(res, 200, service.getHardwareItem(decodeURIComponent(hardwareItem[1])));
      return;
    }

    if (req.method === "GET" && path === `${prefix}/processor-boards`) {
      sendJson(res, 200, { items: service.listProcessorBoards() });
      return;
    }

    if (req.method === "GET" && path === `${prefix}/sensors`) {
      sendJson(res, 200, { items: service.listSensors() });
      return;
    }

    if (req.method === "POST" && path === `${prefix}/admin/capabilities`) {
      sendJson(res, 201, service.upsertCapability(await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/admin/hardware-items`) {
      sendJson(res, 201, service.upsertHardwareItem(await readJsonBody(req)));
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
        reject(new HardwareCatalogError("request_too_large", "Request ist zu gross.", 413));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new HardwareCatalogError("invalid_json", "Request Body ist kein gueltiges JSON."));
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
