const { AdminToolError } = require("./errors");

function createHttpApp(options) {
  const service = options.service;

  return async function routeRequest(req, res) {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, { status: "ok", service: "admin-tool" });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/overview") {
      sendJson(res, 200, await service.overview());
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/devices") {
      sendJson(res, 200, { items: await service.listDevices() });
      return;
    }

    const deviceMatch = url.pathname.match(/^\/api\/admin\/devices\/([^/]+)$/);
    if (req.method === "GET" && deviceMatch) {
      sendJson(res, 200, await service.getDevice(decodeURIComponent(deviceMatch[1]), readContext(url)));
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
      sendJson(res, 200, { items: await service.listLearningFeedback(readContext(url)) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/ai-usage/summary") {
      sendJson(res, 200, await service.aiUsageSummary(readContext(url)));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/admin/ai-cost-controls/actions") {
      const body = await readJsonBody(req);
      sendJson(res, 201, await service.recordAiCostControlAction(body, readContext(url, body)));
      return;
    }

    sendJson(res, 404, { error: "not_found" });
  };
}

function readContext(url, body = {}) {
  return {
    actor: {
      actor_id: body.actor_id || url.searchParams.get("actor_id") || "admin-1",
      role: body.role || url.searchParams.get("role") || "administrator",
      capabilities: parseCapabilities(body.capabilities || url.searchParams.get("capabilities")),
    },
    purpose: body.purpose || url.searchParams.get("purpose") || "admin_review",
    legal_basis: body.legal_basis || url.searchParams.get("legal_basis") || "",
    security_reason: body.security_reason || url.searchParams.get("security_reason") || "",
  };
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
