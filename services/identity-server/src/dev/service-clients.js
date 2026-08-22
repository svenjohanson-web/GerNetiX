const { createInterfaceCallTelemetry } = require("../../../shared/persistence/interface-call-telemetry");
const { issueInternalToken } = require("../../../shared/internal-api-auth");

function createJsonClient(baseUrl, fallbackMessage, clientOptions = {}) {
  return async function requestJson(pathname, options = {}) {
    let response;
    const startedAt = Date.now();
    const action = actionContext(options.headers);
    try {
      const generatedHeaders = clientOptions.headersForRequest ? clientOptions.headersForRequest(pathname, options) : {};
      response = await fetch(`${baseUrl}${pathname}`, {
        method: options.method || "GET",
        headers: { ...(clientOptions.headers || {}), ...generatedHeaders, ...(options.headers || {}), ...(options.body ? { "Content-Type": "application/json" } : {}) },
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
    } catch (cause) {
      clientOptions.telemetry?.record({ targetService: clientOptions.targetService, method: options.method || "GET", route: pathname, statusCode: 0, durationMs: Date.now() - startedAt, succeeded: false, ...action });
      const error = new Error(`${fallbackMessage} Der lokale Dienst hat die Verbindung beendet.`);
      error.code = "upstream_connection_failed";
      error.status = 502;
      error.cause = cause;
      throw error;
    }
    const payload = await response.json().catch(() => ({}));
    clientOptions.telemetry?.record({ targetService: clientOptions.targetService, method: options.method || "GET", route: pathname, statusCode: response.status, durationMs: Date.now() - startedAt, succeeded: response.ok, ...action });
    const allowedStatus = clientOptions.allowPaymentRequired && options.allowPaymentRequired && response.status === 402;
    if (!response.ok && !allowedStatus) {
      const error = new Error(payload.message || payload.error || fallbackMessage);
      error.status = response.status;
      error.payload = payload;
      throw error;
    }
    return payload;
  };
}

function actionContext(headers = {}) {
  const normalized = Object.fromEntries(Object.entries(headers || {}).map(([key, value]) => [String(key).toLowerCase(), value]));
  return {
    actionId: normalized["x-gernetix-action-id"] || "",
    actionType: normalized["x-gernetix-action-type"] || "",
  };
}

function createDevServiceClients({
  aiContextBaseUrl,
  aiUsageBaseUrl,
  buildDeployBaseUrl,
  buildWorkerPoolBaseUrl = "",
  communityPlatformBaseUrl = "",
  deviceManagementBaseUrl,
  hardwareCatalogBaseUrl,
  hardwareShopBaseUrl,
  projectServerBaseUrl,
  telemetryBaseUrl = "",
  internalApiSigningKey = "",
  interfaceTelemetry,
}) {
  const telemetry = interfaceTelemetry || createInterfaceCallTelemetry({ sourceService: "identity-server" });
  const projectServiceOptions = { targetService: "project-server" };
  const aiUsageServiceOptions = { targetService: "ai-usage-server" };
  const securedClient = (baseUrl, fallbackMessage, targetService) => createJsonClient(baseUrl, fallbackMessage, {
    telemetry,
    targetService,
    headersForRequest: (pathname, options) => internalHeaders({ pathname, options, targetService, signingKey: internalApiSigningKey }),
  });
  return {
    aiContextJson: securedClient(aiContextBaseUrl, "AI Context request failed.", "ai-context-server"),
    aiUsageJson: securedClient(aiUsageBaseUrl, "AI Usage request failed.", aiUsageServiceOptions.targetService),
    buildDeployJson: securedClient(buildDeployBaseUrl, "Build & Deploy request failed.", "build-deploy-server"),
    buildWorkerPoolJson: securedClient(buildWorkerPoolBaseUrl || buildDeployBaseUrl, "Build Worker request failed.", "build-deploy-server"),
    communityJson: securedClient(communityPlatformBaseUrl || "http://127.0.0.1:5200", "Community request failed.", "community-platform"),
    deviceManagementJson: securedClient(deviceManagementBaseUrl, "Device Management request failed.", "device-management-server"),
    hardwareCatalogJson: securedClient(hardwareCatalogBaseUrl, "Hardware Catalog request failed.", "hardware-catalog"),
    hardwareShopJson: securedClient(hardwareShopBaseUrl, "Hardware Shop request failed.", "hardware-shop"),
    projectServerJson: securedClient(projectServerBaseUrl, "Project Server request failed.", projectServiceOptions.targetService),
    telemetryJson: securedClient(telemetryBaseUrl || "http://127.0.0.1:5600", "Telemetry Server request failed.", "telemetry-server"),
  };
}

function internalHeaders({ pathname, options, targetService, signingKey }) {
  if (!signingKey) return {};
  const internalAuth = options.internalAuth || {};
  const scopes = Array.isArray(internalAuth.scopes) ? internalAuth.scopes : scopesFor(targetService, pathname, options.method);
  const serviceToken = issueInternalToken({
    iss: "identity-server", sub: "identity-server", aud: targetService, scopes,
  }, signingKey);
  const headers = { Authorization: `Bearer ${serviceToken}` };
  const delegationContext = internalAuth.delegation || inferredDelegation(targetService, pathname, options);
  if (delegationContext) {
    const delegation = issueInternalToken({
      iss: "identity-server", sub: "identity-server", aud: targetService,
      kind: "delegated_user_action", scopes,
      context: delegationContext,
    }, signingKey);
    headers[targetService === "project-server" ? "X-GerNetiX-Project-Delegation" : "X-GerNetiX-Delegation"] = delegation;
  }
  return headers;
}

function scopesFor(targetService, pathname, method = "GET") {
  const write = String(method).toUpperCase() !== "GET";
  if (targetService === "project-server") return [write ? "project.write" : "project.read"];
  if (targetService === "ai-usage-server") {
    if (pathname.includes("/preflight") || /\/events\/[^/]+\/(complete|fail)$/.test(pathname)) return ["ai.usage.consume"];
    if (pathname.includes("/admin/")) return ["ai.usage.admin"];
    return ["ai.usage.read"];
  }
  if (targetService === "ai-context-server") {
    if (pathname.includes("/preflight")) return ["ai.context.use"];
    if (pathname.includes("/policy") || pathname.includes("/sources") || pathname.includes("/grants") || pathname.includes("/audit-events") || pathname.includes("/storage/") || pathname.includes("/sqlite/") || write) return ["ai.context.admin"];
    return ["ai.context.read"];
  }
  if (targetService === "build-deploy-server") {
    if (pathname === "/api/ota/preflight") return ["build.ota.preflight"];
    if (pathname === "/api/policy") return ["build.policy.read"];
    if (pathname === "/api/build-jobs" && write) return ["build.job.request"];
    if (pathname === "/api/build-cache/clean") return ["build.cache.clean"];
    if (/\/cancel$/.test(pathname)) return ["build.job.cancel"];
    if (/\/symbolize$/.test(pathname)) return ["build.job.symbolize"];
    return ["build.job.read"];
  }
  if (targetService === "device-management-server") {
    if (pathname.includes("/admin/devices")) return ["device.admin.read"];
    if (pathname.includes("/customer-data-access/")) return [String(method).toUpperCase() === "GET" ? "customer_data_access.read" : "customer_data_access.write"];
    if (pathname.includes("/board-configurations")) return [`account_board.${write ? "write" : "read"}`];
    if (pathname.includes("/purchase-contexts")) return [`purchase_context.${write ? "write" : "read"}`];
    if (pathname.includes("/hardware-unit-claims") || pathname.includes("/claimable-hardware-units")) return [`hardware_claim.${write ? "write" : "read"}`];
    if (/\/accounts\/[^/]+\/devices/.test(pathname) || pathname.includes("/ota-targets")) return [`device.account.${write ? "write" : "read"}`];
    if (pathname.includes("/provisioning/")) return ["device.provision"];
    if (pathname.includes("/pairing/")) return ["device.pair"];
    if (pathname.endsWith("/devices/register")) return ["device.register"];
    if (pathname.endsWith("/connectivity/status") || pathname.endsWith("/heartbeat")) return ["device.status.write"];
    return ["device.status.read"];
  }
  if (targetService === "community-platform") {
    return [write ? "community.write" : "community.read"];
  }
  if (targetService === "hardware-catalog") return [write ? "hardware_catalog.admin" : "hardware_catalog.read"];
  if (targetService === "hardware-shop") {
    if (pathname.includes("/admin/")) return ["shop.offer.admin"];
    if (pathname.includes("/purchase-context")) return ["shop.purchase_context.read"];
    if (pathname.includes("/orders")) return [`shop.order.${write ? "write" : "read"}`];
    if (pathname.includes("/carts")) return [`shop.cart.${write ? "write" : "read"}`];
    return ["shop.offer.read"];
  }
  if (targetService === "telemetry-server") {
    if (pathname.endsWith("/ingest")) return ["telemetry.ingest"];
    if (pathname.endsWith("/retention/run")) return ["telemetry.retention.run"];
    if (pathname.endsWith("/retention") && write) return ["telemetry.retention.write"];
    if (pathname.endsWith("/data") && write) return ["telemetry.data.delete"];
    return ["telemetry.read"];
  }
  return [];
}

function inferredDelegation(targetService, pathname, options = {}) {
  if (targetService === "community-platform") {
    const normalized = Object.fromEntries(Object.entries(options.headers || {}).map(([key, value]) => [String(key).toLowerCase(), value]));
    const accountId = String(normalized["x-gernetix-community-actor"] || "");
    return accountId ? { account_id: accountId, project_ids: [], entitlements: [] } : null;
  }
  if (targetService === "telemetry-server") {
    const match = pathname.match(/\/accounts\/([^/]+)\/projects\/([^/]+)\//);
    return match ? {
      account_id: decodeURIComponent(match[1]),
      project_ids: [decodeURIComponent(match[2])],
      entitlements: [],
    } : null;
  }
  if (targetService !== "device-management-server") return null;
  const accountPath = pathname.match(/\/accounts\/([^/]+)\//);
  let accountId = accountPath ? decodeURIComponent(accountPath[1]) : "";
  if (!accountId && pathname.includes("/customer-data-access/audit-events")) {
    accountId = new URL(pathname, "http://internal").searchParams.get("accountId") || "";
  }
  if (!accountId) accountId = String(options.body?.account_id || "");
  return accountId ? { account_id: accountId, project_ids: [], entitlements: [] } : null;
}

module.exports = {
  actionContext,
  createDevServiceClients,
};
