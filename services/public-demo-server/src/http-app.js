const { timingSafeEqual } = require("node:crypto");
const fs = require("node:fs");
const nodePath = require("node:path");
const { PublicDemoError } = require("./errors");

function createHttpApp({ service, publisherToken, publicDir = nodePath.join(__dirname, "..", "public") }) {
  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    if (req.method === "GET" && path === "/health") {
      return sendJson(res, 200, { status: "ok", service: "public-demo-server" });
    }
    if (req.method === "GET" && (path === "/" || path === "/index.html" || path === "/app.js" || path === "/app.css")) {
      return serveStatic(res, publicDir, path === "/" ? "/index.html" : path);
    }
    if (req.method === "GET" && path.startsWith("/vendor/esptool-js/")) {
      return serveStatic(res, nodePath.join(__dirname, "..", "..", "identity-server", "node_modules", "esptool-js"), path.replace("/vendor/esptool-js", ""));
    }
    if (req.method === "GET" && path === "/api/public/demos") {
      return sendJson(res, 200, { items: service.listPublicDemos() });
    }
    const firmware = path.match(/^\/api\/public\/demos\/([^/]+)\/releases\/([^/]+)\/firmware$/);
    if (req.method === "GET" && firmware) {
      return sendFirmware(res, service.getFirmware(decodeURIComponent(firmware[1]), decodeURIComponent(firmware[2])));
    }
    const manifest = path.match(/^\/api\/public\/demos\/([^/]+)\/releases\/([^/]+)\/flash-manifest$/);
    if (req.method === "GET" && manifest) return sendJson(res, 200, service.getFlashManifest(decodeURIComponent(manifest[1]), decodeURIComponent(manifest[2])));
    const asset = path.match(/^\/api\/public\/demos\/([^/]+)\/releases\/([^/]+)\/assets\/(bootloader|partitions|firmware)$/);
    if (req.method === "GET" && asset) return sendFirmware(res, service.getAsset(decodeURIComponent(asset[1]), decodeURIComponent(asset[2]), asset[3]));
    const demo = path.match(/^\/api\/public\/demos\/([^/]+)$/);
    if (req.method === "GET" && demo) {
      return sendJson(res, 200, service.getPublicDemo(decodeURIComponent(demo[1])));
    }
    if (req.method === "POST" && path === "/api/internal/public-demos") {
      requirePublisherToken(req, publisherToken);
      return sendJson(res, 201, service.publishDemo(await readJsonBody(req)));
    }
    return sendJson(res, 404, { error: "not_found" });
  };
}

function serveStatic(res, publicDir, requestPath) {
  const fileName = requestPath.replace(/^\//, "");
  const filePath = nodePath.join(publicDir, fileName);
  if (!filePath.startsWith(publicDir) || !fs.existsSync(filePath)) {
    return sendJson(res, 404, { error: "not_found" });
  }
  const contentType = fileName.endsWith(".css") ? "text/css; charset=utf-8"
    : fileName.endsWith(".js") ? "application/javascript; charset=utf-8"
      : "text/html; charset=utf-8";
  res.writeHead(200, { "Content-Type": contentType, "X-Content-Type-Options": "nosniff" });
  res.end(fs.readFileSync(filePath));
}

function requirePublisherToken(req, expectedToken) {
  const actualToken = req.headers["x-public-demo-publisher-token"] || "";
  if (!expectedToken || typeof actualToken !== "string") {
    throw new PublicDemoError("forbidden", "Der Veröffentlichungszugang ist nicht freigegeben.", 403);
  }
  const expected = Buffer.from(expectedToken);
  const actual = Buffer.from(actualToken);
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new PublicDemoError("forbidden", "Der Veröffentlichungszugang ist nicht freigegeben.", 403);
  }
}

function sendFirmware(res, firmware) {
  res.writeHead(200, {
    "Content-Type": "application/octet-stream",
    "Content-Length": firmware.firmware_size_bytes,
    "Content-Disposition": `attachment; filename="${firmware.firmware_file_name}"`,
    "Cache-Control": "public, immutable, max-age=31536000",
    "X-Content-Type-Options": "nosniff",
    "X-Checksum-Sha256": firmware.firmware_sha256,
  });
  res.end(firmware.firmware_blob);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 24 * 1024 * 1024) {
        reject(new PublicDemoError("request_too_large", "Der Veröffentlichungsauftrag ist zu groß.", 413));
        req.destroy();
      }
    });
    req.on("end", () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new PublicDemoError("invalid_json", "Request Body ist kein gültiges JSON.")); }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(JSON.stringify(payload));
}

module.exports = { createHttpApp, sendJson };
