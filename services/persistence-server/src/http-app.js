const { PersistenceServerError } = require("./errors");

const prefix = "/api/persistence";

function createHttpApp(options) {
  const service = options.service;

  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    if (req.method === "GET" && path === "/health") {
      sendJson(res, 200, { status: "ok", service: "persistence-server" });
      return;
    }

    const snapshotMatch = path.match(new RegExp(`^${prefix}/snapshots/([^/]+)$`));
    if (req.method === "GET" && snapshotMatch) {
      sendJson(res, 200, service.getSnapshot(decodeURIComponent(snapshotMatch[1])));
      return;
    }
    if (req.method === "PUT" && snapshotMatch) {
      sendJson(res, 200, service.putSnapshot(decodeURIComponent(snapshotMatch[1]), await readJsonBody(req)));
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
      if (body.length > 1024 * 1024 * 20) {
        reject(new PersistenceServerError("request_too_large", "Request ist zu gross.", 413));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new PersistenceServerError("invalid_json", "Request Body ist kein gueltiges JSON."));
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
