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

    const stateMatch = path.match(new RegExp(`^${prefix}/state/([^/]+)$`));
    if (req.method === "GET" && stateMatch) {
      sendJson(res, 200, service.getState(decodeURIComponent(stateMatch[1])));
      return;
    }
    if (req.method === "PUT" && stateMatch) {
      sendJson(res, 200, service.putState(decodeURIComponent(stateMatch[1]), await readJsonBody(req)));
      return;
    }

    if (req.method === "GET" && path === `${prefix}/export`) {
      sendJson(res, 200, service.exportDatabase());
      return;
    }

    if (req.method === "POST" && path === `${prefix}/backup`) {
      const body = await readJsonBody(req);
      sendJson(res, 200, service.backupDatabase(body.target_path || body.targetPath));
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
