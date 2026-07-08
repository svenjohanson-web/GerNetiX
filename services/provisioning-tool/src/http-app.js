const fs = require("node:fs");
const path = require("node:path");
const { ProvisioningError } = require("./errors");

const publicDir = path.join(__dirname, "..", "public");
const maxJsonBodyBytes = 32 * 1024 * 1024;
const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function createHttpApp(options) {
  const service = options.service;

  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { status: "ok", service: "provisioning-tool" });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/provisioning-firmware-artifact") {
      sendJson(res, 200, await service.getFirmwareArtifact(url.searchParams.get("processor_board_id") || url.searchParams.get("hardware_profile_id") || ""));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/provisioning-flash-mode") {
      sendJson(res, 200, service.getFlashMode());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/provisioning-firmware-artifacts") {
      sendJson(res, 200, service.listFirmwareArtifacts());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/provisioning-firmware-artifacts") {
      if (!service.canWriteFirmwareArtifacts || !service.canWriteFirmwareArtifacts()) {
        throw new ProvisioningError(
          "firmware_artifact_write_disabled",
          "Firmware-Artefakte werden nicht ueber die Provisioning-HMI registriert. Nutze den serverseitigen Artifact Store oder PROVISIONING_FIRMWARE_FILE_PATH.",
          403,
        );
      }
      sendJson(res, 201, service.upsertFirmwareArtifact(await readJsonBody(req)));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/provisioning-processor-boards") {
      sendJson(res, 200, await service.listProcessorBoards());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/provisioning-credentials/reset") {
      sendJson(res, 200, service.resetActiveCredential(await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/provisioning-sessions") {
      const body = await readJsonBody(req);
      sendJson(res, 201, await service.createSession(body));
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

    const completeMatch = url.pathname.match(/^\/api\/provisioning-sessions\/([^/]+)\/complete$/);
    if (req.method === "POST" && completeMatch) {
      const body = await readJsonBody(req);
      sendJson(res, 200, await service.completeSession(decodeURIComponent(completeMatch[1]), body));
      return;
    }

    const manifestMatch = url.pathname.match(/^\/api\/provisioning-sessions\/([^/]+)\/manifest$/);
    if (req.method === "GET" && manifestMatch) {
      sendJson(res, 200, service.getManifest(decodeURIComponent(manifestMatch[1])));
      return;
    }

    const usbFlashMatch = url.pathname.match(/^\/api\/provisioning-sessions\/([^/]+)\/usb-flash$/);
    if (req.method === "POST" && usbFlashMatch) {
      const body = await readJsonBody(req);
      sendJson(res, 200, await service.executeUsbFlash(decodeURIComponent(usbFlashMatch[1]), body));
      return;
    }

    const usbFlashJobMatch = url.pathname.match(/^\/api\/provisioning-sessions\/([^/]+)\/usb-flash-jobs$/);
    if (req.method === "POST" && usbFlashJobMatch) {
      const body = await readJsonBody(req);
      sendJson(res, 202, service.startUsbFlashJob(decodeURIComponent(usbFlashJobMatch[1]), body));
      return;
    }

    const flashJobMatch = url.pathname.match(/^\/api\/provisioning-flash-jobs\/([^/]+)$/);
    if (req.method === "GET" && flashJobMatch) {
      sendJson(res, 200, service.getUsbFlashJob(decodeURIComponent(flashJobMatch[1])));
      return;
    }

    if (req.method === "GET") {
      serveStatic(res, url.pathname);
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
      if (body.length > maxJsonBodyBytes) {
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

function serveStatic(res, requestPath) {
  const normalizedRequestPath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(publicDir, normalizedRequestPath));
  if (!filePath.startsWith(publicDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
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

module.exports = { createHttpApp, sendJson };
