const fs = require("node:fs");
const path = require("node:path");

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico": "image/x-icon",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".puml": "text/plain; charset=utf-8",
};

function serveStatic(res, rootDir, requestPath) {
  const normalizedRequestPath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(rootDir, normalizedRequestPath));

  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentTypes[path.extname(filePath)] || "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(content);
  });
}

function normalizeAppPath(pathname) {
  const stripped = pathname.replace(/^\/app\/?/, "/");
  if (stripped === "/" || stripped === "") return "/index.html";
  if (/^\/auth\/?$/.test(stripped)) return "/auth/index.html";
  if (/^\/(auth|dashboard|learn|learning-project|development-platform(?:\/hardware)?|ide|projects|devices|device-management(?:\/(?:provisioning|inventory|recovery))?|builds|downloads|shop|billing|community|help|account-setup)\/?$/.test(stripped)) return "/index.html";
  return stripped;
}

function parseCookies(cookieHeader) {
  return Object.fromEntries(
    cookieHeader
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf("=");
        if (separatorIndex < 0) return [part, ""];
        return [
          decodeURIComponent(part.slice(0, separatorIndex)),
          decodeURIComponent(part.slice(separatorIndex + 1)),
        ];
      }),
  );
}

function setSessionCookie(res, token, expiresAt) {
  res.setHeader("Set-Cookie", [
    `gernetix_demo_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${new Date(expiresAt).toUTCString()}`,
  ]);
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", [
    "gernetix_demo_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0",
  ]);
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sendDevJson(res, status, payload) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(status === 204 ? "" : JSON.stringify(payload));
}

function redirect(res, location) {
  res.writeHead(302, { Location: location });
  res.end();
}

function authRoute(next = "/app/dashboard/") {
  return `/app/auth/?next=${encodeURIComponent(next)}`;
}

function readJsonBody(req, maxBytes = 64 * 1024) {
  return new Promise((resolve, reject) => {
    let body = "";
    let sizeBytes = 0;
    let rejected = false;
    req.on("data", (chunk) => {
      if (rejected) return;
      sizeBytes += Buffer.isBuffer(chunk) ? chunk.length : Buffer.byteLength(chunk, "utf8");
      if (sizeBytes > maxBytes) {
        rejected = true;
        const error = new Error("Request Body ist zu gross.");
        error.code = "request_too_large";
        error.status = 413;
        reject(error);
        return;
      }
      body += chunk;
    });
    req.on("end", () => {
      if (rejected) return;
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function sanitizeNextPath(value) {
  const next = String(value || "").trim();
  if (!next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return "";
  try {
    const base = new URL("https://gernetix.invalid/");
    const target = new URL(next, base);
    if (target.origin !== base.origin) return "";
    return `${target.pathname}${target.search}${target.hash}`;
  } catch {
    return "";
  }
}

module.exports = {
  authRoute,
  clearSessionCookie,
  normalizeAppPath,
  parseCookies,
  readJsonBody,
  redirect,
  sanitizeNextPath,
  sendDevJson,
  sendJson,
  serveStatic,
  setSessionCookie,
};
