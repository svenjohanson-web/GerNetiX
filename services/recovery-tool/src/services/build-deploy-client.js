const { RecoveryToolError } = require("../errors");
const { issueInternalToken } = require("../../../shared/internal-api-auth");

class BuildDeployClient {
  constructor(options = {}) {
    this.baseUrl = String(options.baseUrl || "http://127.0.0.1:4400").replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl || fetch;
    this.timeoutMs = Number(options.timeoutMs || 15000);
    this.signingKey = String(options.signingKey || "");
  }

  async submit(buildRequest) {
    return this.callJson("POST", "/api/build-jobs", buildRequest, "build.job.request", contextFor(buildRequest));
  }

  async get(jobId, context) {
    return this.callJson("GET", `/api/build-jobs/${encodeURIComponent(jobId)}`, undefined, "build.job.read", context);
  }

  artifactUrl(jobId, fileName) {
    return `${this.baseUrl}/artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(fileName)}`;
  }

  async callJson(method, pathname, body, scope, context) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${pathname}`, {
        method,
        headers: { "Content-Type": "application/json", ...this.authHeaders(scope, context) },
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

  authHeaders(scope, context) {
    const scopes = [scope];
    const common = { iss: "recovery-tool", sub: "recovery-tool", aud: "build-deploy-server", scopes };
    return {
      Authorization: `Bearer ${issueInternalToken(common, this.signingKey)}`,
      "X-GerNetiX-Delegation": issueInternalToken({ ...common, kind: "delegated_user_action", context }, this.signingKey),
    };
  }
}

function contextFor(input = {}) {
  return {
    account_id: String(input.account_id || ""),
    project_ids: input.project_id ? [String(input.project_id)] : [],
    entitlements: [],
  };
}

module.exports = { BuildDeployClient };
