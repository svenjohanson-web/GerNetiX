const { AiUsageError } = require("./errors");

const prefix = "/api/ai-usage";

function createHttpApp(options) {
  const service = options.service;

  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    if (req.method === "GET" && path === "/health") {
      sendJson(res, 200, { status: "ok", service: "ai-usage-server" });
      return;
    }

    const credits = path.match(new RegExp(`^${prefix}/accounts/([^/]+)/credits$`));
    if (req.method === "GET" && credits) {
      sendJson(res, 200, service.getCreditBalance(decodeURIComponent(credits[1])));
      return;
    }

    const grant = path.match(new RegExp(`^${prefix}/accounts/([^/]+)/credits/grant$`));
    if (req.method === "POST" && grant) {
      sendJson(res, 200, service.grantCredits(decodeURIComponent(grant[1]), await readJsonBody(req)));
      return;
    }

    const hold = path.match(new RegExp(`^${prefix}/accounts/([^/]+)/credits/hold$`));
    if (req.method === "POST" && hold) {
      sendJson(res, 200, service.holdCredits(decodeURIComponent(hold[1]), await readJsonBody(req)));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/preflight`) {
      const result = service.preflight(await readJsonBody(req));
      sendJson(res, result.allowed ? 200 : 402, result);
      return;
    }

    const complete = path.match(new RegExp(`^${prefix}/events/([^/]+)/complete$`));
    if (req.method === "POST" && complete) {
      sendJson(res, 200, service.completeUsageEvent(decodeURIComponent(complete[1]), await readJsonBody(req)));
      return;
    }

    const fail = path.match(new RegExp(`^${prefix}/events/([^/]+)/fail$`));
    if (req.method === "POST" && fail) {
      sendJson(res, 200, service.failUsageEvent(decodeURIComponent(fail[1]), await readJsonBody(req)));
      return;
    }

    if (req.method === "GET" && path === `${prefix}/events`) {
      sendJson(res, 200, { items: service.listUsageEvents(Object.fromEntries(url.searchParams.entries())) });
      return;
    }

    if (req.method === "GET" && path === `${prefix}/admin/dashboard`) {
      sendJson(res, 200, service.adminDashboard());
      return;
    }

    if (req.method === "GET" && path === `${prefix}/admin/audit-events`) {
      sendJson(res, 200, { items: service.listAdminAuditEvents() });
      return;
    }

    if (req.method === "POST" && path === `${prefix}/admin/cost-controls`) {
      sendJson(res, 201, service.recordCostControlAction(await readJsonBody(req)));
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
      if (body.length > 1024 * 1024) {
        reject(new AiUsageError("request_too_large", "Request ist zu gross.", 413));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new AiUsageError("invalid_json", "Request Body ist kein gueltiges JSON."));
      }
    });
    req.on("error", reject);
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

module.exports = { createHttpApp, sendJson };
