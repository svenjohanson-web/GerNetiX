const fs = require("node:fs");
const path = require("node:path");
const { ContextManagerError } = require("./errors");
const {
  readBearerToken,
  verifyInternalToken,
} = require("../../shared/internal-api-auth");

const prefix = "/api/context";
const audience = "context-manager";
const scopes = Object.freeze({
  read: "context_manager.read",
  write: "context_manager.write",
  analyze: "context_manager.analyze",
});
const publicDir = path.resolve(__dirname, "..", "public");
const docsDir = path.resolve(__dirname, "..", "..", "..", "docs");
const architectureFiles = new Set([
  "system-process-application-uml.svg",
  "system-process-application-uml.md",
]);

function createHttpApp(options) {
  const service = options.service;
  const internalApiSigningKey = options.internalApiSigningKey;

  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    if (req.method === "GET" && path === "/health") {
      sendJson(res, 200, { status: "ok", service: "context-manager" });
      return;
    }

    if (req.method === "GET" && path === `${prefix}/current`) {
      requireInternalAccess(req, internalApiSigningKey, scopes.read);
      sendJson(res, 200, service.currentContext(Object.fromEntries(url.searchParams.entries())));
      return;
    }

    if (req.method === "PUT" && path === `${prefix}/current`) {
      requireInternalAccess(req, internalApiSigningKey, scopes.write);
      await sendPersistedJson(res, 200, service, service.upsertScope(await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/requirement-slices`) {
      requireInternalAccess(req, internalApiSigningKey, scopes.write);
      await sendPersistedJson(res, 201, service, service.upsertRequirementSlice(await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/artifact-references`) {
      requireInternalAccess(req, internalApiSigningKey, scopes.write);
      await sendPersistedJson(res, 201, service, service.upsertArtifactReference(await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/runtime-references`) {
      requireInternalAccess(req, internalApiSigningKey, scopes.write);
      await sendPersistedJson(res, 201, service, service.upsertRuntimeReference(await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/decisions`) {
      requireInternalAccess(req, internalApiSigningKey, scopes.write);
      await sendPersistedJson(res, 201, service, service.recordDecision(await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/events`) {
      requireInternalAccess(req, internalApiSigningKey, scopes.write);
      await sendPersistedJson(res, 201, service, service.recordEvent(await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/analyze`) {
      requireInternalAccess(req, internalApiSigningKey, scopes.analyze);
      await sendPersistedJson(res, 201, service, service.analyzeScope(await readJsonBody(req)));
      return;
    }

    if (req.method === "GET" && path === `${prefix}/suggestions`) {
      requireInternalAccess(req, internalApiSigningKey, scopes.read);
      sendJson(res, 200, service.listSuggestions(Object.fromEntries(url.searchParams.entries())));
      return;
    }

    const suggestionAction = path.match(new RegExp(`^${prefix}/suggestions/([^/]+)/(accept|reject)$`));
    if (req.method === "POST" && suggestionAction) {
      requireInternalAccess(req, internalApiSigningKey, scopes.write);
      const id = decodeURIComponent(suggestionAction[1]);
      const action = suggestionAction[2];
      await sendPersistedJson(res, action === "accept" ? 201 : 200, service, action === "accept"
        ? service.acceptSuggestion(id, await readJsonBody(req))
        : service.rejectSuggestion(id));
      return;
    }

    const suggestion = path.match(new RegExp(`^${prefix}/suggestions/([^/]+)$`));
    if (req.method === "PATCH" && suggestion) {
      requireInternalAccess(req, internalApiSigningKey, scopes.write);
      await sendPersistedJson(res, 200, service, service.updateSuggestion(decodeURIComponent(suggestion[1]), await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/packs`) {
      requireInternalAccess(req, internalApiSigningKey, scopes.analyze);
      await sendPersistedJson(res, 201, service, service.createContextPack(await readJsonBody(req)));
      return;
    }

    const pack = path.match(new RegExp(`^${prefix}/packs/([^/]+)$`));
    if (req.method === "GET" && pack) {
      requireInternalAccess(req, internalApiSigningKey, scopes.read);
      sendJson(res, 200, service.getContextPack(decodeURIComponent(pack[1])));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/redact`) {
      requireInternalAccess(req, internalApiSigningKey, scopes.analyze);
      sendJson(res, 200, service.redact(await readJsonBody(req)));
      return;
    }

    if (req.method === "GET" && path.startsWith("/context-manager/architecture/")) {
      requireOperatorUiAccess(req, internalApiSigningKey);
      serveArchitecture(path, res);
      return;
    }

    if (req.method === "GET" && (path === "/" || path === "/context-manager" || path.startsWith("/context-manager/"))) {
      requireOperatorUiAccess(req, internalApiSigningKey);
      serveStatic(path, res);
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  };
}

function requireInternalAccess(req, internalApiSigningKey, requiredScope) {
  return verifyInternalToken(readBearerToken(req), internalApiSigningKey, {
    audience,
    requiredScopes: [requiredScope],
  });
}

function requireLoopbackOperator(req) {
  const remoteAddress = String(req.socket?.remoteAddress || "");
  if (remoteAddress !== "127.0.0.1" && remoteAddress !== "::1" && remoteAddress !== "::ffff:127.0.0.1") {
    const error = new ContextManagerError("operator_access_denied", "Context Manager HMI ist nur lokal erreichbar.", 403);
    throw error;
  }
}

function requireOperatorUiAccess(req, internalApiSigningKey) {
  const remoteAddress = String(req.socket?.remoteAddress || "");
  if (remoteAddress === "127.0.0.1" || remoteAddress === "::1" || remoteAddress === "::ffff:127.0.0.1") return;
  try {
    requireInternalAccess(req, internalApiSigningKey, scopes.read);
  } catch {
    requireLoopbackOperator(req);
  }
}

function serveArchitecture(requestPath, res) {
  const fileName = decodeURIComponent(requestPath.replace(/^\/context-manager\/architecture\/?/, ""));
  if (!architectureFiles.has(fileName)) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }
  const filePath = path.resolve(docsDir, fileName);
  if (!filePath.startsWith(`${docsDir}${path.sep}`)) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }
  try {
    const body = fs.readFileSync(filePath);
    res.writeHead(200, {
      "Content-Type": contentType(filePath),
      "Cache-Control": "no-store",
    });
    res.end(body);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(res, 404, { error: "not_found" });
      return;
    }
    throw error;
  }
}

function serveStatic(requestPath, res) {
  const routePath = requestPath === "/" || requestPath === "/context-manager" ? "/context-manager/" : requestPath;
  const relativePath = routePath === "/context-manager/"
    ? "index.html"
    : decodeURIComponent(routePath.replace(/^\/context-manager\/?/, ""));
  const filePath = path.resolve(publicDir, relativePath);

  if (!filePath.startsWith(`${publicDir}${path.sep}`) && filePath !== path.join(publicDir, "index.html")) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }

  try {
    const body = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": contentType(filePath) });
    res.end(body);
  } catch (error) {
    if (error.code === "ENOENT") {
      sendJson(res, 404, { error: "not_found" });
      return;
    }
    throw error;
  }
}

function contentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  if (extension === ".svg") return "image/svg+xml; charset=utf-8";
  if (extension === ".md") return "text/markdown; charset=utf-8";
  if (extension === ".json") return "application/json; charset=utf-8";
  return "application/octet-stream";
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

async function sendPersistedJson(res, status, service, payload) {
  await service.repository?.flush?.();
  sendJson(res, status, payload);
}

module.exports = { createHttpApp, sendJson, scopes };
