const { TelemetryError } = require("./errors");
const { assertDelegatedResource, readBearerToken, verifyDelegation, verifyInternalToken } = require("../../shared/internal-api-auth");

const prefix = "/api/telemetry";

function createHttpApp({ service, internalApiSigningKey }) {
  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;
    if (req.method === "GET" && path === "/health") return sendJson(res, 200, { status: "ok", service: "telemetry-server" });
    if (!path.startsWith(`${prefix}/internal/`)) return sendJson(res, 404, { error: "not_found" });

    if (req.method === "POST" && path === `${prefix}/internal/ingest`) {
      requireServiceToken(req, internalApiSigningKey, "telemetry.ingest");
      return sendJson(res, 202, await service.ingest(await readJsonBody(req)));
    }
    if (req.method === "POST" && path === `${prefix}/internal/retention/run`) {
      requireServiceToken(req, internalApiSigningKey, "telemetry.retention.run");
      return sendJson(res, 200, await service.prune());
    }

    const project = path.match(/^\/api\/telemetry\/internal\/accounts\/([^/]+)\/projects\/([^/]+)\/(measurements|events|retention|data)$/);
    if (!project) return sendJson(res, 404, { error: "not_found" });
    const [, accountId, projectId, resource] = project.map(decodeURIComponent);
    const scope = req.method === "PUT" ? "telemetry.retention.write"
      : req.method === "DELETE" ? "telemetry.data.delete"
        : "telemetry.read";
    requireServiceToken(req, internalApiSigningKey, scope);
    const delegation = verifyDelegation(req.headers["x-gernetix-delegation"], internalApiSigningKey, {
      audience: "telemetry-server",
      requiredScopes: [scope],
    });
    assertDelegatedResource(delegation, { accountId, projectId });
    const query = Object.fromEntries(url.searchParams.entries());
    if (req.method === "GET" && resource === "measurements") return sendJson(res, 200, { items: await service.listMeasurements(accountId, projectId, query) });
    if (req.method === "GET" && resource === "events") return sendJson(res, 200, { items: await service.listEvents(accountId, projectId, query) });
    if (req.method === "GET" && resource === "retention") return sendJson(res, 200, await service.getRetentionPolicy(accountId, projectId));
    if (req.method === "PUT" && resource === "retention") return sendJson(res, 200, await service.setRetentionPolicy(accountId, projectId, await readJsonBody(req)));
    if (req.method === "DELETE" && resource === "data") return sendJson(res, 200, { deleted: await service.deleteProjectData(accountId, projectId) });
    return sendJson(res, 405, { error: "method_not_allowed" });
  };
}

function requireServiceToken(req, secret, scope) {
  return verifyInternalToken(readBearerToken(req), secret, {
    audience: "telemetry-server",
    requiredScopes: [scope],
  });
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; if (body.length > 1024 * 1024) { reject(new TelemetryError("request_too_large", "Request ist zu gross.", 413)); req.destroy(); } });
    req.on("end", () => { try { resolve(body ? JSON.parse(body) : {}); } catch { reject(new TelemetryError("invalid_json", "Request Body ist kein gültiges JSON.")); } });
    req.on("error", reject);
  });
}
function sendJson(res, status, payload) { res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" }); res.end(JSON.stringify(payload)); }

module.exports = { createHttpApp, sendJson };
