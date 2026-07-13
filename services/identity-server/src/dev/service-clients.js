const { createInterfaceCallTelemetry } = require("../../../shared/persistence/interface-call-telemetry");

function createJsonClient(baseUrl, fallbackMessage, clientOptions = {}) {
  return async function requestJson(pathname, options = {}) {
    let response;
    const startedAt = Date.now();
    try {
      response = await fetch(`${baseUrl}${pathname}`, {
        method: options.method || "GET",
        headers: options.body ? { "Content-Type": "application/json" } : {},
        body: options.body ? JSON.stringify(options.body) : undefined,
      });
    } catch (cause) {
      clientOptions.telemetry?.record({ targetService: clientOptions.targetService, method: options.method || "GET", route: pathname, statusCode: 0, durationMs: Date.now() - startedAt, succeeded: false });
      const error = new Error(`${fallbackMessage} Der lokale Dienst hat die Verbindung beendet.`);
      error.code = "upstream_connection_failed";
      error.status = 502;
      error.cause = cause;
      throw error;
    }
    const payload = await response.json().catch(() => ({}));
    clientOptions.telemetry?.record({ targetService: clientOptions.targetService, method: options.method || "GET", route: pathname, statusCode: response.status, durationMs: Date.now() - startedAt, succeeded: response.ok });
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

function createDevServiceClients({
  aiContextBaseUrl,
  aiUsageBaseUrl,
  buildDeployBaseUrl,
  deviceManagementBaseUrl,
  hardwareCatalogBaseUrl,
  hardwareShopBaseUrl,
  projectServerBaseUrl,
  interfaceTelemetry,
}) {
  const telemetry = interfaceTelemetry || createInterfaceCallTelemetry({ sourceService: "identity-server" });
  return {
    aiContextJson: createJsonClient(aiContextBaseUrl, "AI Context request failed.", { telemetry, targetService: "ai-context-server" }),
    aiUsageJson: createJsonClient(aiUsageBaseUrl, "AI Usage request failed.", { allowPaymentRequired: true, telemetry, targetService: "ai-usage-server" }),
    buildDeployJson: createJsonClient(buildDeployBaseUrl, "Build & Deploy request failed.", { telemetry, targetService: "build-deploy-server" }),
    deviceManagementJson: createJsonClient(deviceManagementBaseUrl, "Device Management request failed.", { telemetry, targetService: "device-management-server" }),
    hardwareCatalogJson: createJsonClient(hardwareCatalogBaseUrl, "Hardware Catalog request failed.", { telemetry, targetService: "hardware-catalog" }),
    hardwareShopJson: createJsonClient(hardwareShopBaseUrl, "Hardware Shop request failed.", { telemetry, targetService: "hardware-shop" }),
    projectServerJson: createJsonClient(projectServerBaseUrl, "Project Server request failed.", { telemetry, targetService: "project-server" }),
  };
}

module.exports = {
  createDevServiceClients,
};
