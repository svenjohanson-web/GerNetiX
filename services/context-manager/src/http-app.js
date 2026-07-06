const fs = require("node:fs");
const path = require("node:path");
const { ContextManagerError } = require("./errors");

const prefix = "/api/context";
const publicDir = path.resolve(__dirname, "..", "public");
const docsDir = path.resolve(__dirname, "..", "..", "..", "docs");
const architectureFiles = new Set([
  "system-process-application-uml.svg",
  "system-process-application-uml.md",
]);

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

    if (req.method === "POST" && path === `${prefix}/analyze`) {
      sendJson(res, 201, service.analyzeScope(await readJsonBody(req)));
      return;
    }

    if (req.method === "GET" && path === `${prefix}/suggestions`) {
      sendJson(res, 200, service.listSuggestions(Object.fromEntries(url.searchParams.entries())));
      return;
    }

    const suggestionAction = path.match(new RegExp(`^${prefix}/suggestions/([^/]+)/(accept|reject)$`));
    if (req.method === "POST" && suggestionAction) {
      const id = decodeURIComponent(suggestionAction[1]);
      const action = suggestionAction[2];
      sendJson(res, action === "accept" ? 201 : 200, action === "accept"
        ? service.acceptSuggestion(id, await readJsonBody(req))
        : service.rejectSuggestion(id));
      return;
    }

    const suggestion = path.match(new RegExp(`^${prefix}/suggestions/([^/]+)$`));
    if (req.method === "PATCH" && suggestion) {
      sendJson(res, 200, service.updateSuggestion(decodeURIComponent(suggestion[1]), await readJsonBody(req)));
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

    if (req.method === "GET" && path.startsWith("/context-manager/architecture/")) {
      serveArchitecture(path, res);
      return;
    }

    if (req.method === "GET" && (path === "/" || path === "/context-manager" || path.startsWith("/context-manager/"))) {
      serveStatic(path, res);
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  };
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

module.exports = { createHttpApp, sendJson };
