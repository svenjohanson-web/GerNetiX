const fs = require("node:fs");
const path = require("node:path");
const { AdminToolError } = require("./errors");
const componentMetamodel = require("../../identity-server/public/app/development-component-metamodel");

const publicDir = path.join(__dirname, "..", "public");
const operatorShellDir = path.join(__dirname, "..", "..", "shared", "public");

function createHttpApp(options) {
  const service = options.service;

  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { status: "ok", service: "admin-tool" });
      return;
    }

    if (req.method === "GET" && ["/", "/admin", "/admin/"].includes(url.pathname)) {
      serveStatic(res, publicDir, "/index.html");
      return;
    }

    if (req.method === "GET" && url.pathname === "/admin/operator-shell.css") {
      serveStatic(res, operatorShellDir, "/operator-shell.css");
      return;
    }

    if (req.method === "GET" && url.pathname.startsWith("/admin/")) {
      serveStatic(res, publicDir, url.pathname.replace(/^\/admin/, "") || "/index.html");
      return;
    }

    if (url.pathname.startsWith("/api/admin/")) {
      const actor = trustedAdminActor(req, service);
      if (service.serviceClients?.adminToolAccessToken && !actor) {
        sendJson(res, 403, { error: "admin_access_denied" });
        return;
      }
      req.gernetixAdminActor = actor;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/overview") {
      sendJson(res, 200, await service.overview());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/component-metamodel") {
      sendJson(res, 200, {
        component_types: Object.entries(componentMetamodel.componentTypes).map(([id, item]) => ({ id, ...item })),
        relationship_rules: componentMetamodel.relationshipRules,
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/monitoring") {
      sendJson(res, 200, await service.monitoring());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/system-events") {
      sendJson(res, 200, service.systemEvents({
        severity: url.searchParams.get("severity") || "",
        source_service: url.searchParams.get("source_service") || "",
        target_service: url.searchParams.get("target_service") || "",
        limit: url.searchParams.get("limit") || "",
      }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/system-events") {
      sendJson(res, 201, { event: service.recordSystemEvent(await readJsonBody(req)) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/devices") {
      sendJson(res, 200, { items: await service.listDevices() });
      return;
    }

    const deviceMatch = url.pathname.match(/^\/api\/admin\/devices\/([^/]+)$/);
    if (req.method === "GET" && deviceMatch) {
      sendJson(res, 200, await service.getDevice(decodeURIComponent(deviceMatch[1]), readContext(url, {}, req)));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/customer-data-access/consents") {
      const body = await readJsonBody(req);
      sendJson(res, 201, service.createConsent(body));
      return;
    }

    const revokeMatch = url.pathname.match(/^\/api\/admin\/customer-data-access\/consents\/([^/]+)\/revoke$/);
    if (req.method === "POST" && revokeMatch) {
      sendJson(res, 200, service.revokeConsent(decodeURIComponent(revokeMatch[1])));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/customer-data-access/audit-events") {
      sendJson(res, 200, {
        items: service.listAuditEvents({ account_id: url.searchParams.get("account_id") || "" }),
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/learning-feedback") {
      sendJson(res, 200, { items: await service.listLearningFeedback(readContext(url, {}, req)) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/ai-usage/summary") {
      sendJson(res, 200, await service.aiUsageSummary(readContext(url, {}, req)));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/accounts") {
      sendJson(res, 200, await service.accountSheet(readContext(url, {}, req)));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/ai-context/summary") {
      sendJson(res, 200, await service.aiContextAccessSummary(readContext(url, {}, req)));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/resources") {
      sendJson(res, 200, await service.resourceSummary(readContext(url, {}, req)));
      return;
    }
    const resourcePolicy = url.pathname.match(/^\/api\/admin\/resources\/policies\/([^/]+)$/);
    if (req.method === "PUT" && resourcePolicy) {
      const body = await readJsonBody(req);
      sendJson(res, 200, await service.updateResourcePolicy(decodeURIComponent(resourcePolicy[1]), body, readContext(url, body, req)));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/internal/security-events") {
      if (!service.serviceClients?.securityMonitorToken || req.headers["x-gernetix-security-monitor-token"] !== service.serviceClients.securityMonitorToken) {
        sendJson(res, 403, { error: "security_monitor_access_denied" }); return;
      }
      sendJson(res, 202, await service.recordSecurityEvent(await readJsonBody(req)));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/ai-clarification-cases") {
      sendJson(res, 200, await service.aiClarificationCases({
        status: url.searchParams.get("status") || "",
        priority: url.searchParams.get("priority") || "",
      }, readContext(url, {}, req)));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/ai-help-articles") {
      sendJson(res, 200, await service.helpKnowledge(readContext(url, {}, req)));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/email-config") {
      sendJson(res, 200, await service.emailConfig(readContext(url, {}, req)));
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/admin/email-config") {
      const body = await readJsonBody(req);
      sendJson(res, 200, await service.updateEmailConfig(body, readContext(url, body, req)));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/email-config/test") {
      sendJson(res, 200, await service.testEmailConfig(readContext(url, {}, req)));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/ai-help-articles") {
      const body = await readJsonBody(req);
      sendJson(res, 200, await service.upsertHelpKnowledge(body, readContext(url, body, req)));
      return;
    }

    const clarificationAction = url.pathname.match(/^\/api\/admin\/ai-clarification-cases\/([^/]+)\/actions$/);
    if (req.method === "POST" && clarificationAction) {
      const body = await readJsonBody(req);
      sendJson(res, 200, await service.resolveAiClarificationCase(decodeURIComponent(clarificationAction[1]), body, readContext(url, body, req)));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/ai-cost-controls/actions") {
      const body = await readJsonBody(req);
      sendJson(res, 201, await service.recordAiCostControlAction(body, readContext(url, body, req)));
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/llm-config") {
      sendJson(res, 200, { config: service.llmConfig() });
      return;
    }

    if (req.method === "PUT" && url.pathname === "/api/admin/llm-config") {
      const body = await readJsonBody(req);
      sendJson(res, 200, { config: service.updateLlmConfig(body) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/llm-models") {
      sendJson(res, 200, await service.listLlmModels({
        provider: url.searchParams.get("provider") || "",
        apiProvider: url.searchParams.get("api_provider") || "",
        apiBaseUrl: url.searchParams.get("base_url") || "",
      }));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/llm-config/test") {
      sendJson(res, 200, await service.testLlmConfig());
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  };
}

function serveStatic(res, rootDir, requestPath) {
  const normalizedRequestPath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(rootDir, normalizedRequestPath));

  if (!filePath.startsWith(rootDir)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, {
      "Content-Type": contentType(filePath),
      "Cache-Control": "no-store",
    });
    res.end(content);
  });
}

function contentType(filePath) {
  const extension = path.extname(filePath);
  if (extension === ".html") return "text/html; charset=utf-8";
  if (extension === ".css") return "text/css; charset=utf-8";
  if (extension === ".js") return "text/javascript; charset=utf-8";
  return "application/octet-stream";
}

function readContext(url, body = {}, req = null) {
  const trustedActor = req?.gernetixAdminActor;
  return {
    actor: {
      actor_id: trustedActor?.actor_id || body.actor_id || url.searchParams.get("actor_id") || "admin-1",
      role: trustedActor?.role || body.role || url.searchParams.get("role") || "administrator",
      capabilities: trustedActor?.capabilities || parseCapabilities(body.capabilities || url.searchParams.get("capabilities")),
    },
    purpose: body.purpose || url.searchParams.get("purpose") || "admin_review",
    legal_basis: body.legal_basis || url.searchParams.get("legal_basis") || "",
    security_reason: body.security_reason || url.searchParams.get("security_reason") || "",
  };
}

function trustedAdminActor(req, service) {
  if (!service.serviceClients?.adminToolAccessToken) return null;
  if (req.headers["x-gernetix-admin-access-token"] !== service.serviceClients.adminToolAccessToken) return null;
  try {
    const actor = JSON.parse(Buffer.from(String(req.headers["x-gernetix-admin-actor"] || ""), "base64url").toString("utf8"));
    if (!actor?.actor_id || !actor?.role || !Array.isArray(actor.capabilities)) return null;
    return { actor_id: String(actor.actor_id), role: String(actor.role), capabilities: actor.capabilities.map(String) };
  } catch {
    return null;
  }
}

function parseCapabilities(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  return String(value).split(",").map((item) => item.trim()).filter(Boolean);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(new AdminToolError("request_too_large", "Request ist zu gross.", 413));
        req.destroy();
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new AdminToolError("invalid_json", "Request Body ist kein gueltiges JSON."));
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
