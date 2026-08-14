const { RecoveryToolError } = require("../errors");
const { issueInternalToken } = require("../../../shared/internal-api-auth");

class AiUsageClient {
  constructor(options = {}) {
    this.baseUrl = String(options.baseUrl || "").replace(/\/$/, "");
    this.fetchImpl = options.fetchImpl || fetch;
    this.timeoutMs = Number(options.timeoutMs || 10000);
    this.signingKey = String(options.signingKey || "");
  }

  async preflight(payload, delegationContext) {
    return this.request("/preflight", payload, "hardware_lab_ai_usage_preflight_failed", delegationContext);
  }

  async complete(eventId, payload, delegationContext) {
    return this.request(`/events/${encodeURIComponent(eventId)}/complete`, payload, "hardware_lab_ai_usage_completion_failed", delegationContext);
  }

  async fail(eventId, payload, delegationContext) {
    return this.request(`/events/${encodeURIComponent(eventId)}/fail`, payload, "hardware_lab_ai_usage_failure_booking_failed", delegationContext);
  }

  async request(path, payload, errorCode, delegationContext) {
    if (!this.baseUrl) throw new RecoveryToolError("hardware_lab_ai_usage_not_configured", "Die verpflichtende KI-Nutzungspruefung ist nicht konfiguriert.", 503);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...this.authHeaders(delegationContext) },
        signal: controller.signal,
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new RecoveryToolError(errorCode, body.message || body.error || `AI Usage antwortet mit HTTP ${response.status}.`, response.status >= 500 ? 502 : response.status, body);
      return body;
    } catch (error) {
      if (error.name === "AbortError") throw new RecoveryToolError(errorCode, "AI Usage hat das Zeitlimit ueberschritten.", 504);
      throw error;
    } finally {
      clearTimeout(timer);
    }
  }

  authHeaders(context = {}) {
    const scopes = ["ai.usage.consume"];
    const common = { iss: "recovery-tool", sub: "recovery-tool", aud: "ai-usage-server", scopes };
    return {
      Authorization: `Bearer ${issueInternalToken(common, this.signingKey)}`,
      "X-GerNetiX-Delegation": issueInternalToken({ ...common, kind: "delegated_user_action", context }, this.signingKey),
    };
  }
}

module.exports = { AiUsageClient };
