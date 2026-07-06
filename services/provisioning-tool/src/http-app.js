const { ProvisioningError } = require("./errors");

function createHttpApp(options) {
  const service = options.service;

  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { status: "ok", service: "provisioning-tool" });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/provisioning-sessions") {
      const body = await readJsonBody(req);
      sendJson(res, 201, service.createSession(body));
      return;
    }

    const sessionMatch = url.pathname.match(/^\/api\/provisioning-sessions\/([^/]+)$/);
    if (req.method === "GET" && sessionMatch) {
      sendJson(res, 200, service.getSession(decodeURIComponent(sessionMatch[1])));
      return;
    }

    if (req.method === "POST" && sessionMatch) {
      const body = await readJsonBody(req);
      sendJson(res, 200, await service.completeSession(decodeURIComponent(sessionMatch[1]), body));
      return;
    }

    const manifestMatch = url.pathname.match(/^\/api\/provisioning-sessions\/([^/]+)\/manifest$/);
    if (req.method === "GET" && manifestMatch) {
      sendJson(res, 200, service.getManifest(decodeURIComponent(manifestMatch[1])));
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
        reject(new ProvisioningError("request_too_large", "Request ist zu gross.", 413));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new ProvisioningError("invalid_json", "Request Body ist kein gueltiges JSON."));
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
