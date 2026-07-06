const { ContextManagerError } = require("./errors");

const prefix = "/api/context";

function createHttpApp(options) {
  const service = options.service;

  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    if (req.method === "GET" && path === "/health") {
      sendJson(res, 200, { status: "ok", service: "context-manager" });
      return;
    }

    if (req.method === "GET" && path === `${prefix}/current`) {
      sendJson(res, 200, service.currentContext(Object.fromEntries(url.searchParams.entries())));
      return;
    }

    if (req.method === "PUT" && path === `${prefix}/current`) {
      sendJson(res, 200, service.upsertScope(await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/requirement-slices`) {
      sendJson(res, 201, service.upsertRequirementSlice(await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/artifact-references`) {
      sendJson(res, 201, service.upsertArtifactReference(await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/runtime-references`) {
      sendJson(res, 201, service.upsertRuntimeReference(await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/decisions`) {
      sendJson(res, 201, service.recordDecision(await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/events`) {
      sendJson(res, 201, service.recordEvent(await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/packs`) {
      sendJson(res, 201, service.createContextPack(await readJsonBody(req)));
      return;
    }

    const pack = path.match(new RegExp(`^${prefix}/packs/([^/]+)$`));
    if (req.method === "GET" && pack) {
      sendJson(res, 200, service.getContextPack(decodeURIComponent(pack[1])));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/redact`) {
      sendJson(res, 200, service.redact(await readJsonBody(req)));
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
        reject(new ContextManagerError("request_too_large", "Request ist zu gross.", 413));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new ContextManagerError("invalid_json", "Request Body ist kein gueltiges JSON."));
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
