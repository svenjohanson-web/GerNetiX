"use strict";

function requestPath(req) {
  try {
    return new URL(req.url || "/", "http://localhost").pathname;
  } catch {
    return "/";
  }
}

function createRequestHandler({
  routeRequest,
  sendJson,
  reportError = console.error,
  reportSlowRequest = () => {},
  slowRequestMs = 1500,
  now = () => process.hrtime.bigint(),
}) {
  if (typeof routeRequest !== "function" || typeof sendJson !== "function") {
    throw new TypeError("routeRequest and sendJson are required");
  }
  const configuredSlowRequestMs = Number(slowRequestMs);
  const slowThresholdMs = Number.isFinite(configuredSlowRequestMs) && configuredSlowRequestMs >= 0
    ? configuredSlowRequestMs
    : 1500;

  return function handleRequest(req, res) {
    const startedAt = now();
    res.once("finish", () => {
      const durationMs = Number(now() - startedAt) / 1e6;
      if (durationMs < slowThresholdMs) return;
      try {
        reportSlowRequest({
          method: String(req.method || "GET").toUpperCase(),
          path: requestPath(req),
          status: res.statusCode,
          duration_ms: Math.round(durationMs),
        });
      } catch {
        // Observability must never interrupt the HTTP response lifecycle.
      }
    });

    return Promise.resolve().then(() => routeRequest(req, res)).catch((error) => {
      reportError(error);
      sendJson(res, error.status || 500, {
        error: error.code || "internal_server_error",
        message: error.message || "Interner Serverfehler.",
      });
    });
  };
}

module.exports = { createRequestHandler, requestPath };
