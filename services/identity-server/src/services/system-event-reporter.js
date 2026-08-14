const { issueInternalToken } = require("../../../shared/internal-api-auth");

function createSystemEventReporter(options = {}) {
  const baseUrl = String(options.baseUrl || "").replace(/\/$/, "");
  const signingKey = String(options.internalApiSigningKey || "");
  const fetchImpl = options.fetchImpl || fetch;
  const logger = options.logger || console;
  const timeoutMs = Number(options.timeoutMs || 700);

  return async function reportSystemEvent(event) {
    const safeEvent = {
      ...event,
      occurred_at: event.occurred_at || new Date().toISOString(),
      details: event.details && typeof event.details === "object" ? event.details : {},
    };
    logger.warn?.("GerNetiX system event", safeEvent);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      if (!baseUrl || !signingKey) return false;
      const token = issueInternalToken({ iss: "identity-server", sub: "identity-server", aud: "admin-tool", scopes: ["operations.system_events.write"] }, signingKey);
      const response = await fetchImpl(`${baseUrl}/api/internal/system-events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(safeEvent),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Admin Tool antwortete mit HTTP ${response.status}.`);
      return true;
    } catch (error) {
      logger.warn?.(`System event delivery failed: ${error.message || error}`);
      return false;
    } finally {
      clearTimeout(timeout);
    }
  };
}

module.exports = { createSystemEventReporter };
