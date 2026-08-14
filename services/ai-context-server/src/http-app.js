const { AiContextError } = require("./errors");
const {
  verifyInternalToken,
  verifyDelegation,
  assertDelegatedResource,
  readBearerToken,
} = require("../../shared/internal-api-auth");

const prefix = "/api/ai-context";

function createHttpApp(options) {
  const service = options.service;
  const signingKey = options.internalApiSigningKey || "";

  return async function routeRequest(req, res) {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const path = url.pathname;

      if (req.method === "GET" && path === "/health") {
        sendJson(res, 200, { status: "ok", service: "ai-context-server" });
        return;
      }

      if (req.method === "GET" && path === `${prefix}/policy`) {
        requireService(req, signingKey, "ai.context.admin");
        sendJson(res, 200, { policy: await service.getPolicy() });
        return;
      }

      if (req.method === "PUT" && path === `${prefix}/policy`) {
        requireService(req, signingKey, "ai.context.admin");
        sendJson(res, 200, { policy: await service.updatePolicy(await readJsonBody(req)) });
        return;
      }

      if (req.method === "GET" && path === `${prefix}/grants`) {
        const filter = Object.fromEntries(url.searchParams.entries());
        if (filter.account_id) requireDelegatedAccount(req, signingKey, filter.account_id, "ai.context.read", filter.project_id);
        else requireService(req, signingKey, "ai.context.admin");
        sendJson(res, 200, { items: await service.listGrants(filter) });
        return;
      }

      if (req.method === "GET" && path === `${prefix}/sources`) {
        requireService(req, signingKey, "ai.context.admin");
        sendJson(res, 200, { items: await service.listSources(Object.fromEntries(url.searchParams.entries())) });
        return;
      }

      if (req.method === "GET" && path === `${prefix}/prompt-foundations`) {
        requireService(req, signingKey, "ai.context.read");
        sendJson(res, 200, { items: await service.listPromptFoundations(Object.fromEntries(url.searchParams.entries())) });
        return;
      }

      if (req.method === "GET" && path === `${prefix}/architecture-components`) {
        requireService(req, signingKey, "ai.context.read");
        sendJson(res, 200, { items: await service.listArchitectureComponents(Object.fromEntries(url.searchParams.entries())) });
        return;
      }

      if (req.method === "GET" && path === `${prefix}/architecture-components/search`) {
        requireService(req, signingKey, "ai.context.read");
        sendJson(res, 200, await service.searchArchitectureComponents(url.searchParams.get("q"), url.searchParams.get("limit")));
        return;
      }

      if (req.method === "GET" && path === `${prefix}/help-articles`) {
        requireService(req, signingKey, "ai.context.read");
        sendJson(res, 200, { items: await service.listHelpArticles(Object.fromEntries(url.searchParams.entries())) });
        return;
      }

      if (req.method === "GET" && path === `${prefix}/help-articles/search`) {
        requireService(req, signingKey, "ai.context.read");
        sendJson(res, 200, await service.searchHelpArticles(url.searchParams.get("q"), url.searchParams.get("limit")));
        return;
      }

      if (req.method === "GET" && path === `${prefix}/clarification-cases`) {
        const filter = Object.fromEntries(url.searchParams.entries());
        if (filter.account_id) requireDelegatedAccount(req, signingKey, filter.account_id, "ai.context.read");
        else requireService(req, signingKey, "ai.context.admin");
        sendJson(res, 200, await service.listClarificationCases(filter));
        return;
      }

      if (req.method === "POST" && path === `${prefix}/clarification-cases`) {
        requireService(req, signingKey, "ai.context.write");
        const input = await readJsonBody(req);
        if (input.account_id) requireDelegatedAccount(req, signingKey, input.account_id, "ai.context.write", input.project_id);
        sendJson(res, 201, { clarificationCase: await service.recordClarificationCase(input) });
        return;
      }

      const clarificationAction = path.match(new RegExp(`^${prefix}/clarification-cases/([^/]+)/actions$`));
      if (req.method === "POST" && clarificationAction) {
        requireService(req, signingKey, "ai.context.admin");
        sendJson(res, 200, { clarificationCase: await service.resolveClarificationCase(decodeURIComponent(clarificationAction[1]), await readJsonBody(req)) });
        return;
      }

      if (req.method === "GET" && path === `${prefix}/intent-examples`) {
        const filter = Object.fromEntries(url.searchParams.entries());
        if (filter.account_id) requireDelegatedAccount(req, signingKey, filter.account_id, "ai.context.read");
        else requireService(req, signingKey, "ai.context.read");
        sendJson(res, 200, { items: await service.listIntentExamples(filter) });
        return;
      }

      if (req.method === "GET" && path === `${prefix}/intent-examples/search`) {
        const accountId = url.searchParams.get("account_id") || "";
        if (accountId) requireDelegatedAccount(req, signingKey, accountId, "ai.context.read");
        else requireService(req, signingKey, "ai.context.read");
        sendJson(res, 200, await service.searchIntentExamples(url.searchParams.get("q"), url.searchParams.get("limit"), accountId));
        return;
      }

      if (req.method === "POST" && path === `${prefix}/prompt-foundations`) {
        requireService(req, signingKey, "ai.context.admin");
        sendJson(res, 201, { promptFoundation: await service.upsertPromptFoundation(await readJsonBody(req)) });
        return;
      }

      if (req.method === "POST" && path === `${prefix}/architecture-components`) {
        requireService(req, signingKey, "ai.context.admin");
        sendJson(res, 201, { architectureComponent: await service.upsertArchitectureComponent(await readJsonBody(req)) });
        return;
      }

      if (req.method === "POST" && path === `${prefix}/help-articles`) {
        requireService(req, signingKey, "ai.context.admin");
        sendJson(res, 201, { helpArticle: await service.upsertHelpArticle(await readJsonBody(req)) });
        return;
      }

      if (req.method === "POST" && path === `${prefix}/sources`) {
        requireService(req, signingKey, "ai.context.admin");
        sendJson(res, 201, { source: await service.upsertSource(await readJsonBody(req)) });
        return;
      }

      if (req.method === "POST" && path === `${prefix}/grants`) {
        requireService(req, signingKey, "ai.context.admin");
        sendJson(res, 201, { grant: await service.createGrant(await readJsonBody(req)) });
        return;
      }

      const revoke = path.match(new RegExp(`^${prefix}/grants/([^/]+)/revoke$`));
      if (req.method === "POST" && revoke) {
        requireService(req, signingKey, "ai.context.admin");
        sendJson(res, 200, { grant: await service.revokeGrant(decodeURIComponent(revoke[1]), await readJsonBody(req)) });
        return;
      }

      if (req.method === "POST" && path === `${prefix}/preflight`) {
        requireService(req, signingKey, "ai.context.use");
        const input = await readJsonBody(req);
        requireDelegatedAccount(req, signingKey, input.account_id, "ai.context.use", input.project_id, "ai_assistant");
        const result = await service.preflight(input);
        sendJson(res, result.allowed ? 200 : 403, result);
        return;
      }

      if (req.method === "GET" && path === `${prefix}/audit-events`) {
        requireService(req, signingKey, "ai.context.admin");
        sendJson(res, 200, { items: await service.listAuditEvents(Object.fromEntries(url.searchParams.entries())) });
        return;
      }

      if (req.method === "GET" && path === `${prefix}/storage/summary`) {
        requireService(req, signingKey, "ai.context.admin");
        sendJson(res, 200, { summary: await service.storageSummary() });
        return;
      }

      if (req.method === "GET" && path === `${prefix}/sqlite/summary`) {
        requireService(req, signingKey, "ai.context.admin");
        sendJson(res, 200, { summary: await service.storageSummary() });
        return;
      }

      sendJson(res, 404, { error: "not_found" });
    } catch (error) {
      const status = error.status || 500;
      sendJson(res, status, {
        error: error.code || "internal_error",
        message: error.message || "Interner Fehler.",
        details: error.details || {},
      });
    }
  };
}

function requireService(req, signingKey, scope) {
  return verifyInternalToken(readBearerToken(req), signingKey, {
    audience: "ai-context-server",
    requiredScopes: [scope],
  });
}

function requireDelegatedAccount(req, signingKey, accountId, scope, projectId = "", entitlement = "") {
  if (!accountId) throw new AiContextError("delegated_account_required", "Ein delegierter Kontokontext ist erforderlich.", 403);
  requireService(req, signingKey, scope);
  const claims = verifyDelegation(req.headers["x-gernetix-delegation"], signingKey, {
    audience: "ai-context-server",
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
        reject(new AiContextError("request_too_large", "Request ist zu gross.", 413));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new AiContextError("invalid_json", "Request Body ist kein gueltiges JSON."));
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
