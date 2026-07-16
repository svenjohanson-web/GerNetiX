const fs = require("node:fs");
const path = require("node:path");

const ownPublicDir = path.join(__dirname, "..", "public");
const adminToolPublicDir = path.join(__dirname, "..", "..", "admin-tool", "public");
const operatorShellDir = path.join(__dirname, "..", "..", "shared", "public");

function createHttpApp({ service, config }) {
  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/health") return sendJson(res, 200, { status: "ok", service: "admin-access-server" });

    if (req.method === "POST" && url.pathname === "/api/admin-access/login") {
      const result = service.login(await readJsonBody(req));
      if (!result) return sendJson(res, 401, { error: "invalid_credentials", message: "Benutzername oder Passwort ist nicht korrekt." });
      setSessionCookie(res, result.token, result.expires_at, config.cookieSecure || requestIsSecure(req));
      return sendJson(res, 200, { admin: result.admin, expires_at: result.expires_at });
    }
    if (url.pathname === "/api/admin-access/session") {
      const session = service.session(readSessionToken(req));
      return session ? sendJson(res, 200, session) : sendJson(res, 401, { error: "not_authenticated" });
    }
    if (req.method === "POST" && url.pathname === "/api/admin-access/logout") {
      service.logout(readSessionToken(req));
      clearSessionCookie(res, config.cookieSecure || requestIsSecure(req));
      return sendJson(res, 204, {});
    }
    if (url.pathname === "/api/admin-access/admins") {
      const token = readSessionToken(req);
      if (req.method === "GET") {
        const admins = service.listAdmins(token);
        return admins ? sendJson(res, 200, { items: admins }) : sendJson(res, 401, { error: "not_authenticated" });
      }
      if (req.method === "POST") {
        try {
          const admin = service.createAdministrator(token, await readJsonBody(req));
          return admin ? sendJson(res, 201, { admin }) : sendJson(res, 403, { error: "admin_role_required" });
        } catch (error) { return sendJson(res, 400, { error: "invalid_admin", message: error.message }); }
      }
    }

    if (url.pathname.startsWith("/api/admin/")) return proxyAdminRequest(req, res, url, service, config);

    const session = service.session(readSessionToken(req));
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
    if (req.method === "GET" && url.pathname.startsWith("/admin/") && url.pathname !== "/admin/") {
      if (!session) return sendJson(res, 401, { error: "not_authenticated" });
      return serveStatic(res, adminToolPublicDir, url.pathname.replace(/^\/admin/, "") || "/index.html");
    }
    return sendJson(res, 404, { error: "not_found" });
  };
}

async function proxyAdminRequest(req, res, url, service, config) {
  const actor = service.actorFor(readSessionToken(req));
  if (!actor) return sendJson(res, 401, { error: "not_authenticated" });
  if (actor.role !== "administrator") return sendJson(res, 403, { error: "admin_role_required" });
  if (!config.adminToolAccessToken) return sendJson(res, 503, { error: "admin_backend_not_configured" });
  const target = new URL(`${url.pathname}${url.search}`, config.adminToolBaseUrl);
  const body = ["GET", "HEAD"].includes(req.method) ? undefined : await readRawBody(req);
  const response = await fetch(target, {
    method: req.method,
    headers: {
      "content-type": req.headers["content-type"] || "application/json",
      "x-gernetix-admin-access-token": config.adminToolAccessToken,
      "x-gernetix-admin-actor": Buffer.from(JSON.stringify(actor)).toString("base64url"),
    },
    ...(body ? { body } : {}),
  });
  const responseBody = Buffer.from(await response.arrayBuffer());
  res.writeHead(response.status, { "Content-Type": response.headers.get("content-type") || "application/json; charset=utf-8", "Cache-Control": "no-store" });
  res.end(responseBody);
}

function readSessionToken(req) { return parseCookies(req.headers.cookie || "").gernetix_admin_session || ""; }
function parseCookies(header) { return Object.fromEntries(String(header).split(";").map((item) => item.trim().split(/=(.*)/s)).filter(([key]) => key).map(([key, value]) => [key, decodeURIComponent(value || "")])); }
function requestIsSecure(req) { return String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim() === "https"; }
function setSessionCookie(res, token, expiresAt, secure) { res.setHeader("Set-Cookie", `gernetix_admin_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Expires=${new Date(expiresAt).toUTCString()}${secure ? "; Secure" : ""}`); }
function clearSessionCookie(res, secure) { res.setHeader("Set-Cookie", `gernetix_admin_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure ? "; Secure" : ""}`); }
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

module.exports = { createHttpApp, sendJson };
