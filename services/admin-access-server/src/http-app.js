const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { issueInternalToken } = require("../../shared/internal-api-auth");

const ownPublicDir = path.join(__dirname, "..", "public");
const adminToolPublicDir = path.join(__dirname, "..", "..", "admin-tool", "public");
const operatorShellDir = path.join(__dirname, "..", "..", "shared", "public");
const contextAudience = "context-manager";

function createHttpApp({ service, config }) {
  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/health") return sendJson(res, 200, { status: "ok", service: "admin-access-server" });

    if (req.method === "POST" && url.pathname === "/api/admin-access/login") {
      const result = await service.login(await readJsonBody(req));
      if (!result) return sendJson(res, 401, { error: "invalid_credentials", message: "Benutzername oder Passwort ist nicht korrekt." });
      const secure = config.cookieSecure || requestIsSecure(req);
      setSessionCookie(res, result.token, result.expires_at, secure);
      setCsrfCookie(res, createCsrfToken(), result.expires_at, secure);
      return sendJson(res, 200, { admin: result.admin, expires_at: result.expires_at });
    }
    if (url.pathname === "/api/admin-access/session") {
      const session = await service.session(readSessionToken(req));
      return session ? sendJson(res, 200, session) : sendJson(res, 401, { error: "not_authenticated" });
    }
    if (req.method === "POST" && url.pathname === "/api/admin-access/logout") {
      await service.logout(readSessionToken(req));
      const secure = config.cookieSecure || requestIsSecure(req);
      clearSessionCookie(res, secure);
      clearCsrfCookie(res, secure);
      return sendJson(res, 204, {});
    }
    if (url.pathname === "/api/admin-access/admins") {
      const token = readSessionToken(req);
      if (req.method === "GET") {
        const admins = await service.listAdmins(token);
        return admins ? sendJson(res, 200, { items: admins }) : sendJson(res, 401, { error: "not_authenticated" });
      }
      if (req.method === "POST") {
        try {
          const admin = await service.createAdministrator(token, await readJsonBody(req));
          return admin ? sendJson(res, 201, { admin }) : sendJson(res, 403, { error: "admin_role_required" });
        } catch (error) { return sendJson(res, 400, { error: "invalid_admin", message: error.message }); }
      }
    }

    if (url.pathname === "/api/context" || url.pathname.startsWith("/api/context/")) {
      return proxyContextRequest(req, res, url, service, config);
    }
    if (url.pathname.startsWith("/api/admin/")) return proxyAdminRequest(req, res, url, service, config);

    const session = await service.session(readSessionToken(req));
    if (req.method === "GET" && ["/", "/admin", "/admin/"].includes(url.pathname)) return serveStatic(res, ownPublicDir, "/index.html");
    if (req.method === "GET" && ["/admin/login.css", "/admin/login.js", "/admin/access.js", "/admin/manifest.webmanifest", "/admin/sw.js"].includes(url.pathname)) return serveStatic(res, ownPublicDir, url.pathname.replace("/admin", ""));
    if (req.method === "GET" && url.pathname === "/admin/console") return redirect(res, "/admin/console/");
    if (req.method === "GET" && url.pathname === "/admin/console/") {
      if (!session) return redirect(res, "/admin/");
      return serveStatic(res, adminToolPublicDir, "/index.html");
    }
    if (req.method === "GET" && url.pathname === "/admin/access/") {
      if (!session) return redirect(res, "/admin/");
      return serveStatic(res, ownPublicDir, "/access.html");
    }
    if (req.method === "GET" && url.pathname === "/admin/operator-shell.css") {
      if (!session) return sendJson(res, 401, { error: "not_authenticated" });
      return serveStatic(res, operatorShellDir, "/operator-shell.css");
    }
    if (req.method === "GET" && url.pathname === "/context-manager") return redirect(res, "/context-manager/");
    if ((req.method === "GET" || req.method === "HEAD") && url.pathname.startsWith("/context-manager/")) {
      return proxyContextAsset(req, res, url, service, config);
    }
    if (req.method === "GET" && url.pathname.startsWith("/admin/") && url.pathname !== "/admin/") {
      if (!session) return sendJson(res, 401, { error: "not_authenticated" });
      return serveStatic(res, adminToolPublicDir, url.pathname.replace(/^\/admin/, "") || "/index.html");
    }
    return sendJson(res, 404, { error: "not_found" });
  };
}

async function proxyAdminRequest(req, res, url, service, config) {
  const actor = await service.actorFor(readSessionToken(req));
  if (!actor) return sendJson(res, 401, { error: "not_authenticated" });
  if (!canAccessAdminRoute(actor, url.pathname)) {
    return sendJson(res, 403, { error: "admin_role_required" });
  }
  if (!config.internalApiSigningKey) return sendJson(res, 503, { error: "admin_backend_not_configured" });
  const target = new URL(`${url.pathname}${url.search}`, config.adminToolBaseUrl);
  let body = ["GET", "HEAD"].includes(req.method) ? undefined : await readRawBody(req);
  if (req.method === "POST" && url.pathname === "/api/admin/identity/support-recovery") {
    let parsed;
    try { parsed = body?.length ? JSON.parse(body.toString("utf8")) : {}; } catch { return sendJson(res, 400, { error: "invalid_json" }); }
    const reauthenticated = await service.reauthenticate(readSessionToken(req), String(parsed.admin_password || ""));
    if (!reauthenticated) return sendJson(res, 403, { error: "admin_reauthentication_failed", message: "Das Admin-Passwort ist nicht korrekt." });
    delete parsed.admin_password;
    body = Buffer.from(JSON.stringify(parsed));
  }
  const scopes = ["admin.gateway.proxy"];
  const serviceToken = issueInternalToken({ iss: "admin-access-server", sub: "admin-access-server", aud: "admin-tool", scopes }, config.internalApiSigningKey);
  const delegation = issueInternalToken({ iss: "admin-access-server", sub: actor.actor_id, aud: "admin-tool", kind: "delegated_admin_action", scopes, context: { role: actor.role, capabilities: actor.capabilities || [] } }, config.internalApiSigningKey);
  const response = await fetch(target, {
    method: req.method,
    headers: {
      "content-type": req.headers["content-type"] || "application/json",
      Authorization: `Bearer ${serviceToken}`,
      "X-GerNetiX-Admin-Delegation": delegation,
    },
    ...(body ? { body } : {}),
  });
  const responseBody = Buffer.from(await response.arrayBuffer());
  res.writeHead(response.status, { "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(responseBody);
}

async function proxyContextRequest(req, res, url, service, config) {
  const sessionToken = readSessionToken(req);
  const actor = await service.actorFor(sessionToken);
  if (!actor) return sendJson(res, 401, { error: "not_authenticated" });
  const requiredScope = contextRouteScope(req.method, url.pathname);
  if (!requiredScope) return sendJson(res, 404, { error: "not_found" });
  if (!(actor.capabilities || []).includes(requiredScope)) {
    return sendJson(res, 403, { error: "context_capability_required" });
  }
  if (!["GET", "HEAD"].includes(req.method) && !validCsrfRequest(req)) {
    return sendJson(res, 403, { error: "csrf_invalid" });
  }
  if (!config.internalApiSigningKey || !config.contextManagerBaseUrl) {
    return sendJson(res, 503, { error: "context_backend_not_configured" });
  }
  const target = new URL(`${url.pathname}${url.search}`, config.contextManagerBaseUrl);
  let body = ["GET", "HEAD"].includes(req.method) ? undefined : await readRawBody(req);
  if (req.method === "POST" && url.pathname === "/api/context/events" && body?.length) {
    body = Buffer.from(JSON.stringify({ ...parseJsonBuffer(body), actor_id: actor.actor_id }));
  }
  const token = issueContextToken(config.internalApiSigningKey, actor, requiredScope);
  await service.auditContextRequest(sessionToken, "context_request", `${req.method} ${url.pathname}`);
  let response;
  try {
    response = await fetch(target, {
      method: req.method,
      headers: {
        "content-type": req.headers["content-type"] || "application/json",
        Authorization: `Bearer ${token}`,
      },
      ...(body ? { body } : {}),
    });
  } catch {
    await service.auditContextRequest(sessionToken, "context_result", `502 ${req.method} ${url.pathname}`);
    return sendJson(res, 502, { error: "context_backend_unavailable" });
  }
  await service.auditContextRequest(sessionToken, "context_result", `${response.status} ${req.method} ${url.pathname}`);
  return proxyResponse(res, response, false);
}

async function proxyContextAsset(req, res, url, service, config) {
  const actor = await service.actorFor(readSessionToken(req));
  if (!actor) return sendJson(res, 401, { error: "not_authenticated" });
  if (!(actor.capabilities || []).includes("context_manager.read")) {
    return sendJson(res, 403, { error: "context_capability_required" });
  }
  if (!config.internalApiSigningKey || !config.contextManagerBaseUrl) {
    return sendJson(res, 503, { error: "context_backend_not_configured" });
  }
  const target = new URL(`${url.pathname}${url.search}`, config.contextManagerBaseUrl);
  let response;
  try {
    response = await fetch(target, {
      method: req.method,
      headers: { Authorization: `Bearer ${issueContextToken(config.internalApiSigningKey, actor, "context_manager.read")}` },
    });
  } catch {
    return sendJson(res, 502, { error: "context_backend_unavailable" });
  }
  return proxyResponse(res, response, true);
}

function issueContextToken(signingKey, actor, scope) {
  return issueInternalToken({
    iss: "admin-access-server",
    sub: actor.actor_id,
    aud: contextAudience,
    scopes: [scope],
  }, signingKey);
}

function contextRouteScope(method, pathname) {
  const route = `${String(method || "").toUpperCase()} ${pathname}`;
  if (route === "GET /api/context/current" || route === "GET /api/context/suggestions"
    || /^GET \/api\/context\/packs\/[^/]+$/.test(route)) return "context_manager.read";
  if (route === "PUT /api/context/current"
    || /^POST \/api\/context\/(requirement-slices|artifact-references|runtime-references|decisions|events)$/.test(route)
    || /^PATCH \/api\/context\/suggestions\/[^/]+$/.test(route)
    || /^POST \/api\/context\/suggestions\/[^/]+\/(accept|reject)$/.test(route)) return "context_manager.write";
  if (/^POST \/api\/context\/(analyze|packs|redact)$/.test(route)) return "context_manager.analyze";
  return "";
}

function validCsrfRequest(req) {
  const cookie = parseCookies(req.headers.cookie || "").gernetix_admin_csrf || "";
  const header = String(req.headers["x-gernetix-csrf"] || "");
  if (!cookie || cookie.length < 32 || cookie.length !== header.length) return false;
  return crypto.timingSafeEqual(Buffer.from(cookie), Buffer.from(header));
}

function createCsrfToken() { return crypto.randomBytes(32).toString("base64url"); }

function parseJsonBuffer(body) {
  try { return JSON.parse(body.toString("utf8")); }
  catch { throw Object.assign(new Error("Request Body ist kein gueltiges JSON."), { status: 400, code: "invalid_json" }); }
}

async function proxyResponse(res, response, browserAsset) {
  const responseBody = Buffer.from(await response.arrayBuffer());
  const headers = {
    "Content-Type": response.headers.get("content-type") || "application/octet-stream",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  };
  if (browserAsset) headers["Content-Security-Policy"] = "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'";
  res.writeHead(response.status, headers);
  res.end(responseBody);
}

function canAccessAdminRoute(actor, pathname) {
  if (actor.role === "administrator") return true;
  const capabilities = new Set(actor.capabilities || []);
  if (pathname === "/api/admin/identity/support-recovery") return capabilities.has("admin_identity_recovery");
  if (!pathname.startsWith("/api/admin/community/")) return false;
  if (pathname === "/api/admin/community/overview") return false;
  if (pathname.startsWith("/api/admin/community/support-threads")) return capabilities.has("admin_community_support");
  return capabilities.has("admin_community_moderation");
}

function readSessionToken(req) { return parseCookies(req.headers.cookie || "").gernetix_admin_session || ""; }
function parseCookies(header) { return Object.fromEntries(String(header).split(";").map((item) => item.trim().split(/=(.*)/s)).filter(([key]) => key).map(([key, value]) => [key, decodeURIComponent(value || "")])); }
function requestIsSecure(req) { return String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https"; }
function setSessionCookie(res, token, expiresAt, secure) { res.setHeader("Set-Cookie", `gernetix_admin_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Expires=${new Date(expiresAt).toUTCString()}${secure ? "; Secure" : ""}`); }
function clearSessionCookie(res, secure) { res.setHeader("Set-Cookie", `gernetix_admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`); }
function appendCookie(res, value) { const current = res.getHeader("Set-Cookie"); res.setHeader("Set-Cookie", current ? [...(Array.isArray(current) ? current : [current]), value] : value); }
function setCsrfCookie(res, token, expiresAt, secure) { appendCookie(res, `gernetix_admin_csrf=${encodeURIComponent(token)}; Path=/; SameSite=Strict; Expires=${new Date(expiresAt).toUTCString()}${secure ? "; Secure" : ""}`); }
function clearCsrfCookie(res, secure) { appendCookie(res, `gernetix_admin_csrf=; Path=/; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`); }
function redirect(res, location) { res.writeHead(302, { Location: location, "Cache-Control": "no-store" }); res.end(); }

function serveStatic(res, rootDir, requestPath) {
  const filePath = path.normalize(path.join(rootDir, requestPath === "/" ? "/index.html" : requestPath));
  if (!filePath.startsWith(rootDir)) { res.writeHead(403); return res.end("Forbidden"); }
  fs.readFile(filePath, (error, content) => {
    if (error) { res.writeHead(404); return res.end("Not found"); }
    res.writeHead(200, { "Content-Type": contentType(filePath), "Cache-Control": "no-store" }); res.end(content);
  });
}
function contentType(filePath) { const ext = path.extname(filePath); return ext === ".html" ? "text/html; charset=utf-8" : ext === ".css" ? "text/css; charset=utf-8" : ext === ".js" ? "text/javascript; charset=utf-8" : ext === ".webmanifest" ? "application/manifest+json; charset=utf-8" : "application/octet-stream"; }
function readRawBody(req) { return new Promise((resolve, reject) => { const chunks = []; let length = 0; req.on("data", (chunk) => { length += chunk.length; if (length > 1024 * 1024) { reject(Object.assign(new Error("Request ist zu gross."), { status: 413 })); req.destroy(); } else chunks.push(chunk); }); req.on("end", () => resolve(Buffer.concat(chunks))); req.on("error", reject); }); }
async function readJsonBody(req) { const body = await readRawBody(req); try { return body.length ? JSON.parse(body.toString("utf8")) : {}; } catch { throw Object.assign(new Error("Request Body ist kein gueltiges JSON."), { status: 400, code: "invalid_json" }); } }
function sendJson(res, status, payload) { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(status === 204 ? "" : JSON.stringify(payload)); }

module.exports = { contextRouteScope, createHttpApp, sendJson };
