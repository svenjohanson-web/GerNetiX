"use strict";

const DEFAULT_CONTROL_URL = "http://127.0.0.1:58474";
const DEFAULT_REQUEST_TIMEOUT_MS = 2_000;
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "[::1]"]);
const IDENTIFIER_PATTERN = /^[a-z0-9][a-z0-9_-]{0,63}$/;

function assertLoopbackControlUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "http:") {
    throw new Error("Toxiproxy control URL must use HTTP on loopback");
  }
  if (!LOOPBACK_HOSTS.has(url.hostname)) {
    throw new Error(`Refusing non-loopback Toxiproxy control host: ${url.hostname}`);
  }
  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    throw new Error("Toxiproxy control URL must contain only a loopback origin");
  }
  return url.origin;
}

function assertIdentifier(value, label) {
  if (typeof value !== "string" || !IDENTIFIER_PATTERN.test(value)) {
    throw new Error(`${label} is not a safe Toxiproxy identifier`);
  }
  return value;
}

function createToxiproxyClient(options = {}) {
  const baseUrl = assertLoopbackControlUrl(options.baseUrl || DEFAULT_CONTROL_URL);
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  const requestTimeoutMs = options.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;

  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required");
  if (!Number.isInteger(requestTimeoutMs) || requestTimeoutMs < 100 || requestTimeoutMs > 10_000) {
    throw new Error("requestTimeoutMs must be an integer between 100 and 10000");
  }

  async function request(path, requestOptions = {}) {
    const response = await fetchImpl(`${baseUrl}${path}`, {
      ...requestOptions,
      headers: requestOptions.body ? { "content-type": "application/json" } : undefined,
      signal: AbortSignal.timeout(requestTimeoutMs),
    });
    const acceptedStatuses = requestOptions.acceptedStatuses || [];
    if (!response.ok && !acceptedStatuses.includes(response.status)) {
      throw new Error(`Toxiproxy control request failed with HTTP ${response.status}`);
    }
    if (response.status === 204 || response.status === 404) return null;
    const contentType = response.headers?.get?.("content-type") || "";
    return contentType.includes("application/json") ? response.json() : null;
  }

  return Object.freeze({
    async addToxic(proxyName, toxic) {
      const proxy = assertIdentifier(proxyName, "proxyName");
      const name = assertIdentifier(toxic?.name, "toxic.name");
      if (toxic?.type !== "latency") throw new Error("Only the latency toxic type is allowed");
      if (toxic.stream !== "downstream") throw new Error("Only downstream toxics are allowed");
      if (toxic.toxicity !== 1) throw new Error("Toxicity must be exactly 1");
      const latency = toxic.attributes?.latency;
      const jitter = toxic.attributes?.jitter;
      if (!Number.isInteger(latency) || latency < 1 || latency > 10_000) {
        throw new Error("Latency must be an integer between 1 and 10000 milliseconds");
      }
      if (!Number.isInteger(jitter) || jitter < 0 || jitter > latency) {
        throw new Error("Jitter must be an integer between 0 and latency");
      }
      return request(`/proxies/${proxy}/toxics`, {
        method: "POST",
        body: JSON.stringify({ name, type: "latency", stream: "downstream", toxicity: 1, attributes: { latency, jitter } }),
      });
    },

    async removeToxic(proxyName, toxicName) {
      const proxy = assertIdentifier(proxyName, "proxyName");
      const toxic = assertIdentifier(toxicName, "toxicName");
      return request(`/proxies/${proxy}/toxics/${toxic}`, { method: "DELETE", acceptedStatuses: [404] });
    },

    async setProxyEnabled(proxyName, enabled) {
      const proxy = assertIdentifier(proxyName, "proxyName");
      if (typeof enabled !== "boolean") throw new Error("enabled must be boolean");
      return request(`/proxies/${proxy}`, { method: "POST", body: JSON.stringify({ enabled }) });
    },
  });
}

module.exports = {
  DEFAULT_CONTROL_URL,
  DEFAULT_REQUEST_TIMEOUT_MS,
  assertLoopbackControlUrl,
  createToxiproxyClient,
};
