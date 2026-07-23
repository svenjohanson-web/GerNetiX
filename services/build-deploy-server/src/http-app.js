const { BuildDeployError } = require("./errors");

function createHttpApp(options) {
  const service = options.service;
  const artifactStore = options.artifactStore || service.artifactStore;

  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { status: "ok", service: "build-deploy-server" });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/ota/preflight") {
      sendJson(res, 200, service.otaPreflight());
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
      serveArtifact(res, artifactStore, decodeURIComponent(artifactMatch[1]), decodeURIComponent(artifactMatch[2]));
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  };
}

function serveArtifact(res, artifactStore, jobId, fileName) {
  const safeFileName = sanitizeArtifactName(fileName);
  if (!safeFileName) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }

  const artifact = artifactStore?.getArtifact(jobId, safeFileName);
  if (!artifact) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }
  res.writeHead(200, {
    "Content-Type": artifact.content_type,
    "Content-Length": artifact.size_bytes,
    "X-Content-SHA256": artifact.sha256,
    "Cache-Control": "no-store",
  });
  res.end(artifact.content_blob);
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

function sanitizeArtifactName(value) {
  return ["firmware.bin", "firmware.elf", "firmware.hex", "firmware.map", "build.log"].includes(value) ? value : "";
}

module.exports = { createHttpApp, sendJson };
