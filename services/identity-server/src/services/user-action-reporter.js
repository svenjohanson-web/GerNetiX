function createUserActionReporter(options = {}) {
  const baseUrl = String(options.baseUrl || "").replace(/\/$/, "");
  const ingestToken = String(options.ingestToken || "");
  const fetchImpl = options.fetchImpl || fetch;
  const logger = options.logger || console;
  const timeoutMs = Number(options.timeoutMs || 700);

  return async function reportUserActionEvent(event) {
    if (!baseUrl || !ingestToken) return false;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetchImpl(`${baseUrl}/api/internal/user-action-events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-GerNetiX-System-Event-Token": ingestToken,
        },
        body: JSON.stringify(event),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Admin Tool antwortete mit HTTP ${response.status}.`);
      return true;
    } catch (error) {
      logger.warn?.(`User action event delivery failed: ${error.message || error}`);
      return false;
    } finally {
      clearTimeout(timeout);
    }
  };
}

module.exports = { createUserActionReporter };
