"use strict";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);

function loadConfig(environment = process.env) {
  const baseUrl = assertSafeBaseUrl(environment.GERNETIX_BROWSER_BASE_URL || "http://127.0.0.1:14300");
  const sessionCookieName = required(environment.GERNETIX_BROWSER_SESSION_COOKIE_NAME || "gernetix_demo_session", "GERNETIX_BROWSER_SESSION_COOKIE_NAME");
  const sessionCookieValue = required(environment.GERNETIX_BROWSER_SESSION_COOKIE_VALUE, "GERNETIX_BROWSER_SESSION_COOKIE_VALUE");
  const timeoutMs = integer(environment.GERNETIX_BROWSER_TIMEOUT_MS || "30000", "GERNETIX_BROWSER_TIMEOUT_MS", 1_000, 120_000);
  const workers = integer(environment.GERNETIX_BROWSER_WORKERS || "1", "GERNETIX_BROWSER_WORKERS", 1, 4);

  return Object.freeze({
    baseUrl,
    sessionCookieName,
    sessionCookieValue,
    timeoutMs,
    workers,
  });
}

function assertSafeBaseUrl(value) {
  let url;
  try {
    url = new URL(String(value || ""));
  } catch {
    throw new Error("GERNETIX_BROWSER_BASE_URL must be an absolute URL");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Browser system tests require HTTP or HTTPS");
  if (!LOOPBACK_HOSTS.has(url.hostname)) throw new Error(`Refusing non-loopback browser target: ${url.hostname}`);
  if (url.username || url.password) throw new Error("Browser target must not contain credentials");
  if (url.search || url.hash) throw new Error("Browser target must not contain query or fragment");
  url.pathname = url.pathname.replace(/\/+$/, "") || "/";
  return url;
}

function required(value, name) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${name}_required`);
  return normalized;
}

function integer(value, name, minimum, maximum) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer between ${minimum} and ${maximum}`);
  }
  return parsed;
}

module.exports = { LOOPBACK_HOSTS, assertSafeBaseUrl, loadConfig };
