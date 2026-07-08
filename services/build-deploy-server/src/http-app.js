const fs = require("node:fs");
const path = require("node:path");
const { BuildDeployError } = require("./errors");

function createHttpApp(options) {
  const service = options.service;
  const artifactDir = options.artifactDir;

  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { status: "ok", service: "build-deploy-server" });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/build-jobs") {
      const body = await readJsonBody(req);
      const job = await service.submitJob(body);
      sendJson(res, 202, job);
      return;
    }

    const jobMatch = url.pathname.match(/^\/api\/build-jobs\/([^/]+)$/);
    if (req.method === "GET" && jobMatch) {
      sendJson(res, 200, service.getJob(decodeURIComponent(jobMatch[1])));
      return;
    }

    const artifactMatch = url.pathname.match(/^\/artifacts\/([^/]+)\/([^/]+)$/);
    if (req.method === "GET" && artifactMatch) {
      serveArtifact(res, artifactDir, decodeURIComponent(artifactMatch[1]), decodeURIComponent(artifactMatch[2]));
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  };
}

function serveArtifact(res, artifactDir, jobId, fileName) {
  const safeJobId = sanitizeName(jobId);
  const safeFileName = sanitizeArtifactName(fileName);
  if (!safeFileName) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }

  const filePath = path.join(artifactDir, safeJobId, safeFileName);
  if (!filePath.startsWith(artifactDir)) {
    sendJson(res, 403, { error: "forbidden" });
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      sendJson(res, 404, { error: "not_found" });
      return;
    }
    res.writeHead(200, {
      "Content-Type": safeFileName === "build.log" ? "text/plain; charset=utf-8" : "application/octet-stream",
      "Cache-Control": "no-store",
    });
    res.end(content);
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10 * 1024 * 1024) {
        reject(new BuildDeployError("request_too_large", "Request ist zu gross.", 413));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new BuildDeployError("invalid_json", "Request Body ist kein gueltiges JSON."));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function sanitizeName(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function sanitizeArtifactName(value) {
  return ["firmware.bin", "firmware.elf", "firmware.hex", "firmware.map", "build.log"].includes(value) ? value : "";
}

module.exports = { createHttpApp, sendJson };
