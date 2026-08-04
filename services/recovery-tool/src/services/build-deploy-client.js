const { RecoveryToolError } = require("../errors");

class BuildDeployClient {
  constructor(options = {}) {
    this.baseUrl = String(options.baseUrl || "http://127.0.0.1:4400").replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl || fetch;
    this.timeoutMs = Number(options.timeoutMs || 15000);
  }

  async submit(buildRequest) {
    return this.callJson("POST", "/api/build-jobs", buildRequest);
  }

  async get(jobId) {
    return this.callJson("GET", `/api/build-jobs/${encodeURIComponent(jobId)}`);
  }

  artifactUrl(jobId, fileName) {
    return `${this.baseUrl}/artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(fileName)}`;
  }

  async callJson(method, pathname, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${pathname}`, {
        method,
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new RecoveryToolError("hardware_discovery_build_service_failed", payload.message || payload.error || `Build-&-Deploy antwortet mit HTTP ${response.status}.`, 502, payload.details || {});
      return payload;
    } catch (error) {
      if (error.name === "AbortError") throw new RecoveryToolError("hardware_discovery_build_timeout", "Build-&-Deploy hat das Zeitlimit ueberschritten.", 504);
      if (error instanceof RecoveryToolError) throw error;
      throw new RecoveryToolError("hardware_discovery_build_unreachable", "Build-&-Deploy ist fuer das Hardware-Labor nicht erreichbar.", 503, { reason: error.message });
    } finally {
      clearTimeout(timer);
    }
  }
}

module.exports = { BuildDeployClient };
