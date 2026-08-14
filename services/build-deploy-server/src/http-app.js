const { BuildDeployError } = require("./errors");
const crypto = require("node:crypto");
const { isAllowedArtifactName } = require("./modules/artifact-contract");
const {
  assertDelegatedResource,
  readBearerToken,
  verifyDelegation,
  verifyInternalToken,
} = require("../../shared/internal-api-auth");

function createHttpApp(options) {
  const service = options.service;
  const artifactStore = options.artifactStore || service.artifactStore;
  const artifactUploadIngress = options.artifactUploadIngress || service.artifactUploadIngress;
  const artifactUploadToken = options.artifactUploadToken || service.artifactUploadToken || "";
  const internalApiSigningKey = options.internalApiSigningKey || "";

  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { status: "ok", service: "build-deploy-server", coordination: service.coordinationHealth() });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/ota/preflight") {
      authorizeService(req, internalApiSigningKey, "build.ota.preflight");
      sendJson(res, 200, service.otaPreflight());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/policy") {
      authorizeService(req, internalApiSigningKey, "build.policy.read");
      sendJson(res, 200, service.policySummary());
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/build-jobs") {
      const body = await readJsonBody(req);
      const delegation = authorizeDelegated(req, internalApiSigningKey, "build.job.request");
      assertDelegatedResource(delegation, { projectId: body.project_id || "" });
      const job = await service.submitJob({ ...body, account_id: delegation.context.account_id });
      sendJson(res, 202, job);
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/build-cache/clean") {
      const body = await readJsonBody(req);
      const delegation = authorizeDelegated(req, internalApiSigningKey, "build.cache.clean");
      assertDelegatedResource(delegation, { projectId: body.project_id || "" });
      sendJson(res, 200, await service.cleanProjectCache(body));
      return;
    }

    const uploadMatch = url.pathname.match(/^\/api\/internal\/build-artifacts\/([^/]+)\/([^/]+)$/);
    if (req.method === "PUT" && uploadMatch) {
      const jobId = decodeURIComponent(uploadMatch[1]);
      const artifactName = decodeURIComponent(uploadMatch[2]);
      if (!isAllowedArtifactName(artifactName)) {
        sendJson(res, 404, { error: "not_found" });
        return;
      }
      authorizeArtifactUpload(req, artifactUploadIngress, artifactUploadToken, internalApiSigningKey, {
        scope: "artifact.upload", jobId, artifactNames: [artifactName],
      });
      sendJson(res, 201, await artifactUploadIngress.stage(jobId, artifactName, req));
      return;
    }

    const finalizeMatch = url.pathname.match(/^\/api\/internal\/build-artifacts\/([^/]+)\/finalize$/);
    if (req.method === "POST" && finalizeMatch) {
      const body = await readJsonBody(req);
      const jobId = decodeURIComponent(finalizeMatch[1]);
      authorizeArtifactUpload(req, artifactUploadIngress, artifactUploadToken, internalApiSigningKey, {
        scope: "artifact.finalize", jobId, artifactNames: body.artifacts,
      });
      sendJson(res, 201, await artifactUploadIngress.finalize(jobId, body.artifacts));
      return;
    }

    const jobMatch = url.pathname.match(/^\/api\/build-jobs\/([^/]+)$/);
    if (req.method === "GET" && jobMatch) {
      const job = await service.getSharedJob(decodeURIComponent(jobMatch[1]));
      authorizeJob(req, internalApiSigningKey, "build.job.read", job);
      sendJson(res, 200, job);
      return;
    }

    const cancelJobMatch = url.pathname.match(/^\/api\/build-jobs\/([^/]+)\/cancel$/);
    if (req.method === "POST" && cancelJobMatch) {
      const jobId = decodeURIComponent(cancelJobMatch[1]);
      authorizeJob(req, internalApiSigningKey, "build.job.cancel", await service.getSharedJob(jobId));
      sendJson(res, 202, await service.cancelJob(jobId));
      return;
    }

    const symbolizeMatch = url.pathname.match(/^\/api\/build-jobs\/([^/]+)\/symbolize$/);
    if (req.method === "POST" && symbolizeMatch) {
      const jobId = decodeURIComponent(symbolizeMatch[1]);
      authorizeJob(req, internalApiSigningKey, "build.job.symbolize", await service.getSharedJob(jobId));
      const body = await readJsonBody(req);
      sendJson(res, 200, await service.symbolizeCrash(jobId, body));
      return;
    }

    const artifactMatch = url.pathname.match(/^\/artifacts\/([^/]+)\/([^/]+)$/);
    if (req.method === "GET" && artifactMatch) {
      const jobId = decodeURIComponent(artifactMatch[1]);
      const fileName = decodeURIComponent(artifactMatch[2]);
      if (!sanitizeArtifactName(fileName)) {
        sendJson(res, 404, { error: "not_found" });
        return;
      }
      const job = await service.getSharedJob(jobId);
      authorizeArtifactDownload(req, url, internalApiSigningKey, job, fileName);
      await serveArtifact(res, artifactStore, jobId, fileName);
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  };
}

function authorizeService(req, signingKey, scope) {
  return verifyInternalToken(readBearerToken(req), signingKey, {
    audience: "build-deploy-server",
    requiredScopes: [scope],
  });
}

function authorizeDelegated(req, signingKey, scope) {
  authorizeService(req, signingKey, scope);
  return verifyDelegation(req.headers["x-gernetix-delegation"], signingKey, {
    audience: "build-deploy-server",
    requiredScopes: [scope],
  });
}

function authorizeArtifactDownload(req, url, signingKey, job, fileName) {
  const grantToken = url.searchParams.get("grant");
  if (!grantToken) return authorizeJob(req, signingKey, "artifact.download", job);
  const grant = verifyInternalToken(grantToken, signingKey, {
    audience: "build-deploy-server",
    requiredScopes: ["artifact.download"],
  });
  if (grant.kind !== "artifact_download_grant"
    || !(grant.context?.job_ids || []).includes(String(job?.job_id || ""))
    || !(grant.context?.artifact_names || []).includes(fileName)
    || (job?.account_id && grant.context?.account_id !== job.account_id)
    || (job?.project_id && !(grant.context?.project_ids || []).includes(job.project_id))) {
    throw new BuildDeployError("artifact_download_unauthorized", "Artefakt-Download ist nicht autorisiert.", 403);
  }
  return grant;
}

function authorizeJob(req, signingKey, scope, job = {}) {
  if (!job.account_id) throw new BuildDeployError("build_job_owner_missing", "BuildJob besitzt keine belastbare Accountbindung.", 403);
  const delegation = authorizeDelegated(req, signingKey, scope);
  assertDelegatedResource(delegation, { accountId: job.account_id, projectId: job.project_id || "" });
  return delegation;
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

function authorizeArtifactUpload(req, ingress, configuredToken, signingKey = "", binding = {}) {
  if (!ingress || (!configuredToken && !signingKey)) throw new BuildDeployError("not_found", "Nicht gefunden.", 404);
  const supplied = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (signingKey) {
    try {
      const grant = verifyInternalToken(supplied, signingKey, {
        audience: "build-deploy-server",
        requiredScopes: [binding.scope],
      });
      const names = Array.isArray(binding.artifactNames) ? binding.artifactNames : [];
      if (grant.kind !== "artifact_worker_grant"
        || !(grant.context?.job_ids || []).includes(binding.jobId)
        || !(grant.context?.worker_ids || []).includes(grant.sub)
        || !names.every((name) => (grant.context?.artifact_names || []).includes(name))) {
        throw new Error("worker grant binding mismatch");
      }
      return grant;
    } catch (error) {
      if (!configuredToken) throw new BuildDeployError("artifact_upload_unauthorized", "Artefakt-Upload ist nicht autorisiert.", 401);
    }
  }
  if (!configuredToken) throw new BuildDeployError("artifact_upload_unauthorized", "Artefakt-Upload ist nicht autorisiert.", 401);
  const expectedDigest = crypto.createHash("sha256").update(configuredToken).digest();
  const suppliedDigest = crypto.createHash("sha256").update(supplied).digest();
  if (!supplied || !crypto.timingSafeEqual(expectedDigest, suppliedDigest)) {
    throw new BuildDeployError("artifact_upload_unauthorized", "Artefakt-Upload ist nicht autorisiert.", 401);
  }
}

module.exports = { authorizeArtifactUpload, createHttpApp, sendJson };
