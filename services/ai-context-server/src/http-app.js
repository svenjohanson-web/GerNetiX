const { AiContextError } = require("./errors");

const prefix = "/api/ai-context";

function createHttpApp(options) {
  const service = options.service;

  return async function routeRequest(req, res) {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      const path = url.pathname;

      if (req.method === "GET" && path === "/health") {
        sendJson(res, 200, { status: "ok", service: "ai-context-server" });
        return;
      }

      if (req.method === "GET" && path === `${prefix}/policy`) {
        sendJson(res, 200, { policy: await service.getPolicy() });
        return;
      }

      if (req.method === "PUT" && path === `${prefix}/policy`) {
        sendJson(res, 200, { policy: await service.updatePolicy(await readJsonBody(req)) });
        return;
      }

      if (req.method === "GET" && path === `${prefix}/grants`) {
        sendJson(res, 200, { items: await service.listGrants(Object.fromEntries(url.searchParams.entries())) });
        return;
      }

      if (req.method === "GET" && path === `${prefix}/sources`) {
        sendJson(res, 200, { items: await service.listSources(Object.fromEntries(url.searchParams.entries())) });
        return;
      }

      if (req.method === "GET" && path === `${prefix}/prompt-foundations`) {
        sendJson(res, 200, { items: await service.listPromptFoundations(Object.fromEntries(url.searchParams.entries())) });
        return;
      }

      if (req.method === "GET" && path === `${prefix}/architecture-components`) {
        sendJson(res, 200, { items: await service.listArchitectureComponents(Object.fromEntries(url.searchParams.entries())) });
        return;
      }

      if (req.method === "GET" && path === `${prefix}/architecture-components/search`) {
        sendJson(res, 200, await service.searchArchitectureComponents(url.searchParams.get("q"), url.searchParams.get("limit")));
        return;
      }

      if (req.method === "GET" && path === `${prefix}/help-articles`) {
        sendJson(res, 200, { items: await service.listHelpArticles(Object.fromEntries(url.searchParams.entries())) });
        return;
      }

      if (req.method === "GET" && path === `${prefix}/help-articles/search`) {
        sendJson(res, 200, await service.searchHelpArticles(url.searchParams.get("q"), url.searchParams.get("limit")));
        return;
      }

      if (req.method === "GET" && path === `${prefix}/clarification-cases`) {
        sendJson(res, 200, await service.listClarificationCases(Object.fromEntries(url.searchParams.entries())));
        return;
      }

      if (req.method === "POST" && path === `${prefix}/clarification-cases`) {
        sendJson(res, 201, { clarificationCase: await service.recordClarificationCase(await readJsonBody(req)) });
        return;
      }

      const clarificationAction = path.match(new RegExp(`^${prefix}/clarification-cases/([^/]+)/actions$`));
      if (req.method === "POST" && clarificationAction) {
        sendJson(res, 200, { clarificationCase: await service.resolveClarificationCase(decodeURIComponent(clarificationAction[1]), await readJsonBody(req)) });
        return;
      }

      if (req.method === "GET" && path === `${prefix}/intent-examples`) {
        sendJson(res, 200, { items: await service.listIntentExamples(Object.fromEntries(url.searchParams.entries())) });
        return;
      }

      if (req.method === "GET" && path === `${prefix}/intent-examples/search`) {
        sendJson(res, 200, await service.searchIntentExamples(url.searchParams.get("q"), url.searchParams.get("limit"), url.searchParams.get("account_id")));
        return;
      }

      if (req.method === "POST" && path === `${prefix}/prompt-foundations`) {
        sendJson(res, 201, { promptFoundation: await service.upsertPromptFoundation(await readJsonBody(req)) });
        return;
      }

      if (req.method === "POST" && path === `${prefix}/architecture-components`) {
        sendJson(res, 201, { architectureComponent: await service.upsertArchitectureComponent(await readJsonBody(req)) });
        return;
      }

      if (req.method === "POST" && path === `${prefix}/help-articles`) {
        sendJson(res, 201, { helpArticle: await service.upsertHelpArticle(await readJsonBody(req)) });
        return;
      }

      if (req.method === "POST" && path === `${prefix}/sources`) {
        sendJson(res, 201, { source: await service.upsertSource(await readJsonBody(req)) });
        return;
      }

      if (req.method === "POST" && path === `${prefix}/grants`) {
        sendJson(res, 201, { grant: await service.createGrant(await readJsonBody(req)) });
        return;
      }

      const revoke = path.match(new RegExp(`^${prefix}/grants/([^/]+)/revoke$`));
      if (req.method === "POST" && revoke) {
        sendJson(res, 200, { grant: await service.revokeGrant(decodeURIComponent(revoke[1]), await readJsonBody(req)) });
        return;
      }

      if (req.method === "POST" && path === `${prefix}/preflight`) {
        const result = await service.preflight(await readJsonBody(req));
        sendJson(res, result.allowed ? 200 : 403, result);
        return;
      }

      if (req.method === "GET" && path === `${prefix}/audit-events`) {
        sendJson(res, 200, { items: await service.listAuditEvents(Object.fromEntries(url.searchParams.entries())) });
        return;
      }

      if (req.method === "GET" && path === `${prefix}/storage/summary`) {
        sendJson(res, 200, { summary: await service.storageSummary() });
        return;
      }

      if (req.method === "GET" && path === `${prefix}/sqlite/summary`) {
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
