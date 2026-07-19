function createSystemEventReporter(options = {}) {
  const baseUrl = String(options.baseUrl || "").replace(/\/$/, "");
  const ingestToken = String(options.ingestToken || "");
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
      const internalIngest = Boolean(ingestToken);
      const response = await fetchImpl(`${baseUrl}${internalIngest ? "/api/internal/system-events" : "/api/admin/system-events"}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(internalIngest ? { "X-GerNetiX-System-Event-Token": ingestToken } : {}),
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
