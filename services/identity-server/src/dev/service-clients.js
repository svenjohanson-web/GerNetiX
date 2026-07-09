function createJsonClient(baseUrl, fallbackMessage, clientOptions = {}) {
  return async function requestJson(pathname, options = {}) {
    const response = await fetch(`${baseUrl}${pathname}`, {
      method: options.method || "GET",
      headers: options.body ? { "Content-Type": "application/json" } : {},
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
    const payload = await response.json().catch(() => ({}));
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
}) {
  return {
    aiContextJson: createJsonClient(aiContextBaseUrl, "AI Context request failed."),
    aiUsageJson: createJsonClient(aiUsageBaseUrl, "AI Usage request failed.", { allowPaymentRequired: true }),
    buildDeployJson: createJsonClient(buildDeployBaseUrl, "Build & Deploy request failed."),
    deviceManagementJson: createJsonClient(deviceManagementBaseUrl, "Device Management request failed."),
    hardwareCatalogJson: createJsonClient(hardwareCatalogBaseUrl, "Hardware Catalog request failed."),
    hardwareShopJson: createJsonClient(hardwareShopBaseUrl, "Hardware Shop request failed."),
    projectServerJson: createJsonClient(projectServerBaseUrl, "Project Server request failed."),
  };
}

module.exports = {
  createDevServiceClients,
};
