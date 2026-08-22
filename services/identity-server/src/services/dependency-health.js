"use strict";

function healthUrl(baseUrl) {
  return new URL("/health", `${String(baseUrl || "").replace(/\/+$/, "")}/`).toString();
}

function errorCode(error) {
  if (error?.code) return String(error.code).toLowerCase();
  const causeCode = error?.cause?.code;
  if (causeCode) return String(causeCode).toLowerCase();
  return error?.name === "AbortError" ? "timeout" : "dependency_unreachable";
}

function createDependencyHealthChecker({ dependencies, fetchImpl = globalThis.fetch, timeoutMs = 800, cacheTtlMs = 5000 }) {
  const targets = dependencies.map((dependency) => ({
    id: dependency.id,
    name: dependency.name,
    health_url: healthUrl(dependency.baseUrl),
  }));
  let cached = null;
  let inFlight = null;

  async function checkTarget(target) {
    const startedAt = Date.now();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    timer.unref?.();
    try {
      const response = await fetchImpl(target.health_url, {
        method: "GET",
        headers: { accept: "application/json" },
        signal: controller.signal,
      });
      const latencyMs = Date.now() - startedAt;
      if (!response.ok) {
        return { ...target, reachable: false, latency_ms: latencyMs, status_code: response.status, error_code: `http_${response.status}`, message: `Healthcheck antwortet mit HTTP ${response.status}.` };
      }
      return { ...target, reachable: true, latency_ms: latencyMs, status_code: response.status };
    } catch (error) {
      const code = controller.signal.aborted ? "timeout" : errorCode(error);
      return {
        ...target,
        reachable: false,
        latency_ms: Date.now() - startedAt,
        error_code: code,
        message: code === "timeout" ? `Healthcheck nach ${timeoutMs}ms abgebrochen.` : String(error?.message || "Dienst nicht erreichbar."),
      };
    } finally {
      clearTimeout(timer);
    }
  }

  async function run() {
    const items = await Promise.all(targets.map(checkTarget));
    const unreachable = items.filter((item) => !item.reachable).length;
    cached = {
      status: unreachable ? "degraded" : "ok",
      checked_at: new Date().toISOString(),
      total: items.length,
      reachable: items.length - unreachable,
      unreachable,
      items,
    };
    return cached;
  }

  return async function checkDependencies({ force = false } = {}) {
    if (!force && cached && Date.now() - Date.parse(cached.checked_at) < cacheTtlMs) return cached;
    if (!inFlight) inFlight = run().finally(() => { inFlight = null; });
    return inFlight;
  };
}

module.exports = { createDependencyHealthChecker, healthUrl };
