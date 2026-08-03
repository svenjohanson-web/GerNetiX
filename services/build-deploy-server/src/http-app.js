const { BuildDeployError } = require("./errors");
const crypto = require("node:crypto");
const { isAllowedArtifactName } = require("./modules/artifact-contract");

function createHttpApp(options) {
  const service = options.service;
  const artifactStore = options.artifactStore || service.artifactStore;
  const artifactUploadIngress = options.artifactUploadIngress || service.artifactUploadIngress;
  const artifactUploadToken = options.artifactUploadToken || service.artifactUploadToken || "";

  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { status: "ok", service: "build-deploy-server", coordination: service.coordinationHealth() });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/ota/preflight") {
      sendJson(res, 200, service.otaPreflight());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/policy") {
      sendJson(res, 200, service.policySummary());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/build-jobs") {
      const body = await readJsonBody(req);
      const job = await service.submitJob(body);
      sendJson(res, 202, job);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/build-cache/clean") {
      const body = await readJsonBody(req);
      sendJson(res, 200, await service.cleanProjectCache(body));
      return;
    }

    const uploadMatch = url.pathname.match(/^\/api\/internal\/build-artifacts\/([^/]+)\/([^/]+)$/);
    if (req.method === "PUT" && uploadMatch) {
      authorizeArtifactUpload(req, artifactUploadIngress, artifactUploadToken);
      const artifactName = decodeURIComponent(uploadMatch[2]);
      if (!isAllowedArtifactName(artifactName)) {
        sendJson(res, 404, { error: "not_found" });
        return;
      }
      sendJson(res, 201, await artifactUploadIngress.stage(decodeURIComponent(uploadMatch[1]), artifactName, req));
      return;
    }

    const finalizeMatch = url.pathname.match(/^\/api\/internal\/build-artifacts\/([^/]+)\/finalize$/);
    if (req.method === "POST" && finalizeMatch) {
      authorizeArtifactUpload(req, artifactUploadIngress, artifactUploadToken);
      const body = await readJsonBody(req);
      sendJson(res, 201, await artifactUploadIngress.finalize(decodeURIComponent(finalizeMatch[1]), body.artifacts));
      return;
    }

    const jobMatch = url.pathname.match(/^\/api\/build-jobs\/([^/]+)$/);
    if (req.method === "GET" && jobMatch) {
      sendJson(res, 200, await service.getSharedJob(decodeURIComponent(jobMatch[1])));
      return;
    }

    const cancelJobMatch = url.pathname.match(/^\/api\/build-jobs\/([^/]+)\/cancel$/);
    if (req.method === "POST" && cancelJobMatch) {
      sendJson(res, 202, await service.cancelJob(decodeURIComponent(cancelJobMatch[1])));
      return;
    }

    const symbolizeMatch = url.pathname.match(/^\/api\/build-jobs\/([^/]+)\/symbolize$/);
    if (req.method === "POST" && symbolizeMatch) {
      const body = await readJsonBody(req);
      sendJson(res, 200, await service.symbolizeCrash(decodeURIComponent(symbolizeMatch[1]), body));
      return;
    }

    const artifactMatch = url.pathname.match(/^\/artifacts\/([^/]+)\/([^/]+)$/);
    if (req.method === "GET" && artifactMatch) {
      await serveArtifact(res, artifactStore, decodeURIComponent(artifactMatch[1]), decodeURIComponent(artifactMatch[2]));
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  };
}

async function serveArtifact(res, artifactStore, jobId, fileName) {
  const safeFileName = sanitizeArtifactName(fileName);
  if (!safeFileName) {
    sendJson(res, 404, { error: "not_found" });
    return;
  }

  const artifact = await artifactStore?.getArtifact(jobId, safeFileName);
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
  return isAllowedArtifactName(value) ? value : "";
}

function authorizeArtifactUpload(req, ingress, configuredToken) {
  if (!ingress || !configuredToken) throw new BuildDeployError("not_found", "Nicht gefunden.", 404);
  const supplied = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  const expectedDigest = crypto.createHash("sha256").update(configuredToken).digest();
  const suppliedDigest = crypto.createHash("sha256").update(supplied).digest();
  if (!supplied || !crypto.timingSafeEqual(expectedDigest, suppliedDigest)) {
    throw new BuildDeployError("artifact_upload_unauthorized", "Artefakt-Upload ist nicht autorisiert.", 401);
  }
}

module.exports = { authorizeArtifactUpload, createHttpApp, sendJson };
