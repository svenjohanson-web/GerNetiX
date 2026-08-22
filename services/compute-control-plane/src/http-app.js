"use strict";

const { ComputeError } = require("./errors");
const { safeEqual } = require("./worker-token-service");
const { readBearerToken, verifyInternalToken } = require("../../shared/internal-api-auth");

const prefix = "/api/compute";

function createHttpApp({ service, tokenService, internalApiSigningKey, internalToken, workerBootstrapToken, providers, projectRuntimeGrants = null, projectPatchWriter = null }) {
  const signingKey = internalApiSigningKey || internalToken || "";
  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const path = url.pathname;
    if (req.method === "GET" && path === "/health") return sendJson(res, 200, { status: "ok", service: "compute-control-plane" });

    if (req.method === "POST" && path === `${prefix}/workers/register`) {
      requireToken(req.headers["x-gernetix-worker-bootstrap-token"], workerBootstrapToken, "worker_bootstrap");
      const worker = await service.registerWorker(await readJsonBody(req));
      return sendJson(res, 201, { worker, worker_credential: tokenService.issue(worker) });
    }

    if (path.startsWith(`${prefix}/workers/`)) {
      const identity = tokenService.verify(bearer(req));
      if (req.method === "POST" && path === `${prefix}/workers/heartbeat`) return sendJson(res, 200, await service.heartbeat(identity, await readJsonBody(req)));
      if (req.method === "POST" && path === `${prefix}/workers/drain`) { const body = await readJsonBody(req); return sendJson(res, 200, await service.drain(identity, body.draining !== false)); }
      if (req.method === "POST" && path === `${prefix}/workers/leases/next`) return sendJson(res, 200, await service.leaseNext(identity));
      if (req.method === "POST" && path === `${prefix}/workers/project-runtime/patch`) {
        if (!projectRuntimeGrants) throw new ComputeError("project_runtime_not_configured", "Project Runtime ist nicht konfiguriert.", 503);
        return sendJson(res, 200, await projectRuntimeGrants.applyPatch(await readJsonBody(req), projectPatchWriter));
      }
      const lease = path.match(/^\/api\/compute\/workers\/jobs\/([^/]+)\/leases\/([^/]+)\/(renew|complete|fail)$/);
      if (req.method === "POST" && lease) {
        const [, jobId, leaseId, action] = lease.map(decodeURIComponent);
        if (action === "renew") return sendJson(res, 200, await service.renewLease(identity, jobId, leaseId));
        if (action === "complete") return sendJson(res, 200, await service.complete(identity, jobId, leaseId, await readJsonBody(req)));
        return sendJson(res, 200, await service.fail(identity, jobId, leaseId, await readJsonBody(req)));
      }
      return sendJson(res, 404, { error: "not_found" });
    }

    if (!path.startsWith(`${prefix}/internal/`)) return sendJson(res, 404, { error: "not_found" });
    verifyInternalToken(readBearerToken(req), signingKey, {
      audience: "compute-control-plane",
      requiredScopes: [internalScope(req.method, path)],
    });
    if (req.method === "POST" && path === `${prefix}/internal/jobs`) return sendJson(res, 201, await service.submitJob(await readJsonBody(req)));
    if (req.method === "GET" && path === `${prefix}/internal/jobs`) return sendJson(res, 200, { items: await service.listJobs({ status: url.searchParams.get("status") || "" }) });
    const job = path.match(/^\/api\/compute\/internal\/jobs\/([^/]+)$/);
    if (job && req.method === "GET") return sendJson(res, 200, await service.getJob(decodeURIComponent(job[1])));
    if (job && req.method === "DELETE") return sendJson(res, 200, await service.cancel(decodeURIComponent(job[1])));
    if (path === `${prefix}/internal/policy` && req.method === "GET") return sendJson(res, 200, await service.getPolicy());
    if (path === `${prefix}/internal/policy` && req.method === "PUT") return sendJson(res, 200, await service.savePolicy(await readJsonBody(req)));
    if (path === `${prefix}/internal/operations-summary` && req.method === "GET") return sendJson(res, 200, await service.operationsSummary());
    if (path === `${prefix}/internal/project-runtime/grants` && req.method === "POST") {
      if (!projectRuntimeGrants) throw new ComputeError("project_runtime_not_configured", "Project Runtime ist nicht konfiguriert.", 503);
      return sendJson(res, 201, projectRuntimeGrants.issue(await readJsonBody(req)));
    }
    if (path === `${prefix}/internal/capacity/providers` && req.method === "GET") return sendJson(res, 200, { items: providers.list() });
    const provider = path.match(/^\/api\/compute\/internal\/capacity\/providers\/([^/]+)\/plan$/);
    if (provider && req.method === "POST") { const body = await readJsonBody(req); const storedPolicy = await service.getPolicy(); return sendJson(res, 200, providers.plan(decodeURIComponent(provider[1]), body.recommendation || {}, { ...(body.policy || {}), ...storedPolicy, region: body.policy?.region })); }
    return sendJson(res, 404, { error: "not_found" });
  };
}

function internalScope(method, path) {
  if (path === `${prefix}/internal/jobs`) return method === "POST" ? "compute.job.submit" : "compute.job.list";
  if (/^\/api\/compute\/internal\/jobs\/[^/]+$/.test(path)) return method === "DELETE" ? "compute.job.cancel" : "compute.job.read";
  if (path === `${prefix}/internal/policy`) return method === "PUT" ? "compute.policy.write" : "compute.policy.read";
  if (path === `${prefix}/internal/operations-summary`) return "compute.operations.read";
  if (path === `${prefix}/internal/project-runtime/grants`) return "compute.runtime_grant.issue";
  if (path === `${prefix}/internal/capacity/providers`) return "compute.capacity.read";
  if (/^\/api\/compute\/internal\/capacity\/providers\/[^/]+\/plan$/.test(path)) return "compute.capacity.plan";
  return "compute.route.unknown";
}

function bearer(req) { const match = String(req.headers.authorization || "").match(/^Bearer\s+(.+)$/i); return match?.[1] || ""; }
function requireToken(actual, expected, scope) { if (!expected) throw new ComputeError(`${scope}_token_missing`, "Interne Authentifizierung ist nicht konfiguriert.", 503); if (!safeEqual(actual, expected)) throw new ComputeError(`${scope}_access_denied`, "Interne Authentifizierung fehlgeschlagen.", 403); }
function readJsonBody(req) { return new Promise((resolve, reject) => { let body = ""; req.on("data", (chunk) => { body += chunk; if (body.length > 1024 * 1024) { reject(new ComputeError("request_too_large", "Request ist zu groß.", 413)); req.destroy(); } }); req.on("end", () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new ComputeError("invalid_json", "Request Body ist kein gültiges JSON.", 400)); } }); req.on("error", reject); }); }
function sendJson(res, status, payload) { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }); res.end(JSON.stringify(payload)); }

module.exports = { createHttpApp, sendJson };
