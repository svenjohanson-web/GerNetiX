const { CommunityAiAssistantError } = require("./errors");
const { verifyInternalToken, verifyDelegation, assertDelegatedResource, readBearerToken } = require("../../shared/internal-api-auth");

const prefix = "/api/community-ai";

function createHttpApp(options) {
  const service = options.service;
  const internalAuthSecret = String(options.internalAuthSecret || "");

  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const path = url.pathname;

    if (req.method === "GET" && path === "/health") {
      sendJson(res, 200, { status: "ok", service: "community-ai-assistant" });
      return;
    }

    if (req.method === "POST" && path === `${prefix}/query`) {
      authorizeService(req, internalAuthSecret, "community.ai.query");
      sendJson(res, 200, await service.answerQuestion(await authorizedInput(req, internalAuthSecret, "community.ai.query")));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/similar-content`) {
      authorizeService(req, internalAuthSecret, "community.ai.query");
      sendJson(res, 200, await service.similarContent(await authorizedInput(req, internalAuthSecret, "community.ai.query")));
      return;
    }

    if (req.method === "POST" && path === `${prefix}/summaries`) {
      authorizeService(req, internalAuthSecret, "community.ai.query");
      sendJson(res, 200, await service.summarize(await authorizedInput(req, internalAuthSecret, "community.ai.query")));
      return;
    }

    if (req.method === "GET" && path === `${prefix}/admin/metrics`) {
      authorizeService(req, internalAuthSecret, "community.ai.admin");
      sendJson(res, 200, service.adminMetrics());
      return;
    }

    if (req.method === "POST" && path === `${prefix}/admin/config`) {
      authorizeService(req, internalAuthSecret, "community.ai.admin");
      sendJson(res, 200, service.updateConfig(await readJsonBody(req)));
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  };
}

function authorizeService(req, secret, scope) {
  return verifyInternalToken(readBearerToken(req), secret, { audience: "community-ai-assistant", requiredScopes: [scope] });
}

async function authorizedInput(req, secret, scope) {
  const body = await readJsonBody(req);
  const delegation = verifyDelegation(req.headers["x-gernetix-delegation"], secret, {
    audience: "community-ai-assistant", requiredScopes: [scope],
  });
  const context = delegation.context;
  const requestedProjectId = String(body.project_id || "");
  assertDelegatedResource(delegation, {
    accountId: context.account_id,
    ...(requestedProjectId ? { projectId: requestedProjectId } : {}),
    entitlement: "ai_assistant",
  });
  return {
    ...body,
    account_id: context.account_id,
    user_id: context.account_id,
    project_id: requestedProjectId,
    _internal_auth_context: context,
  };
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new CommunityAiAssistantError("request_too_large", "Request ist zu gross.", 413));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new CommunityAiAssistantError("invalid_json", "Request Body ist kein gueltiges JSON."));
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
