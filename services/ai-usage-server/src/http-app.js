const { AiUsageError } = require("./errors");
const {
  verifyInternalToken,
  verifyDelegation,
  assertDelegatedResource,
  readBearerToken,
} = require("../../shared/internal-api-auth");

const prefix = "/api/ai-usage";

function createHttpApp(options) {
  const service = options.service;
  const signingKey = options.internalApiSigningKey || "";

  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    if (req.method === "GET" && path === "/health") {
      sendJson(res, 200, { status: "ok", service: "ai-usage-server" });
      return;
    }

    if (req.method === "GET" && path === `${prefix}/credit-packages`) {
      requireService(req, signingKey, "ai.usage.read");
      sendJson(res, 200, { items: await service.listCreditPackages() });
      return;
    }

    const credits = path.match(new RegExp(`^${prefix}/accounts/([^/]+)/credits$`));
    if (req.method === "GET" && credits) {
      const accountId = decodeURIComponent(credits[1]);
      requireDelegatedAccount(req, signingKey, accountId, "ai.usage.read");
      sendJson(res, 200, await service.getCreditBalance(accountId));
      return;
    }

    const grant = path.match(new RegExp(`^${prefix}/accounts/([^/]+)/credits/grant$`));
    if (req.method === "POST" && grant) {
      const accountId = decodeURIComponent(grant[1]);
      // Credit grants are a back-office operation; user delegation is not sufficient.
      requireService(req, signingKey, "ai.usage.admin");
      sendJson(res, 200, await service.grantCredits(accountId, await readJsonBody(req)));
      return;
    }

    const hold = path.match(new RegExp(`^${prefix}/accounts/([^/]+)/credits/hold$`));
    if (req.method === "POST" && hold) {
      const accountId = decodeURIComponent(hold[1]);
      requireService(req, signingKey, "ai.usage.admin");
      sendJson(res, 200, await service.holdCredits(accountId, await readJsonBody(req)));
      return;
    }

    const rating = path.match(new RegExp(`^${prefix}/accounts/([^/]+)/rating$`));
    if (req.method === "GET" && rating) {
      const accountId = decodeURIComponent(rating[1]);
      requireDelegatedAccount(req, signingKey, accountId, "ai.usage.read");
      sendJson(res, 200, await service.getAccountRating(accountId));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/preflight`) {
      requireService(req, signingKey, "ai.usage.consume");
      const input = await readJsonBody(req);
      requireDelegatedAccount(req, signingKey, String(input.account_id || ""), "ai.usage.consume", input.project_id, "ai_assistant");
      const result = await service.preflight(input);
      sendJson(res, result.allowed ? 200 : 402, result);
      return;
    }

    const complete = path.match(new RegExp(`^${prefix}/events/([^/]+)/complete$`));
    if (req.method === "POST" && complete) {
      requireService(req, signingKey, "ai.usage.consume");
      const eventId = decodeURIComponent(complete[1]);
      const event = await service.requireUsageEvent(eventId);
      requireDelegatedAccount(req, signingKey, event.account_id, "ai.usage.consume", event.project_id, "ai_assistant");
      sendJson(res, 200, await service.completeUsageEvent(eventId, await readJsonBody(req)));
      return;
    }

    const fail = path.match(new RegExp(`^${prefix}/events/([^/]+)/fail$`));
    if (req.method === "POST" && fail) {
      requireService(req, signingKey, "ai.usage.consume");
      const eventId = decodeURIComponent(fail[1]);
      const event = await service.requireUsageEvent(eventId);
      requireDelegatedAccount(req, signingKey, event.account_id, "ai.usage.consume", event.project_id, "ai_assistant");
      sendJson(res, 200, await service.failUsageEvent(eventId, await readJsonBody(req)));
      return;
    }

    if (req.method === "GET" && path === `${prefix}/events`) {
      const query = Object.fromEntries(url.searchParams.entries());
      requireDelegatedAccount(req, signingKey, String(query.account_id || query.accountId || ""), "ai.usage.read");
      sendJson(res, 200, { items: await service.listUsageEvents(query) });
      return;
    }

    if (req.method === "GET" && path === `${prefix}/admin/dashboard`) {
      requireService(req, signingKey, "ai.usage.admin");
      sendJson(res, 200, await service.adminDashboard());
      return;
    }

    if (req.method === "GET" && path === `${prefix}/admin/audit-events`) {
      requireService(req, signingKey, "ai.usage.admin");
      sendJson(res, 200, { items: await service.listAdminAuditEvents() });
      return;
    }

    if (req.method === "POST" && path === `${prefix}/admin/cost-controls`) {
      requireService(req, signingKey, "ai.usage.admin");
      sendJson(res, 201, await service.recordCostControlAction(await readJsonBody(req)));
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  };
}

function requireService(req, signingKey, scope) {
  return verifyInternalToken(readBearerToken(req), signingKey, {
    audience: "ai-usage-server",
    requiredScopes: [scope],
  });
}

function requireDelegatedAccount(req, signingKey, accountId, scope, projectId = "", entitlement = "") {
  if (!accountId) throw new AiUsageError("delegated_account_required", "Ein delegierter Kontokontext ist erforderlich.", 403);
  requireService(req, signingKey, scope);
  const claims = verifyDelegation(req.headers["x-gernetix-delegation"], signingKey, {
    audience: "ai-usage-server",
    requiredScopes: [scope],
  });
  return assertDelegatedResource(claims, { accountId, projectId, entitlement });
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
