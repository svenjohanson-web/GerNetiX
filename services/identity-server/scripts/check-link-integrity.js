#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");

async function main(env = process.env, argv = process.argv.slice(2)) {
  const identityBaseUrl = stripTrailingSlash(env.IDENTITY_BASE_URL || "http://127.0.0.1:4300");
  const adminToolBaseUrl = stripTrailingSlash(env.ADMIN_TOOL_BASE_URL || "http://127.0.0.1:4600");
  const identityAdminToken = required(env.IDENTITY_ADMIN_TOKEN, "IDENTITY_ADMIN_TOKEN");
  const ingestToken = required(env.LINK_INTEGRITY_INGEST_TOKEN || env.SYSTEM_EVENT_INGEST_TOKEN, "LINK_INTEGRITY_INGEST_TOKEN");
  const includeExternal = argv.includes("--external");

  const inventory = await requestJson(`${identityBaseUrl}/api/internal/link-integrity/inventory`, {
    headers: { "x-gernetix-admin-token": identityAdminToken },
  });
  await requestJson(`${adminToolBaseUrl}/api/internal/link-integrity/inventory`, {
    method: "POST",
    headers: { "x-gernetix-link-integrity-token": ingestToken },
    body: inventory,
  });

  const authenticatedTargets = inventory.targets.filter((item) => item.active !== false && item.access_scope === "authenticated");
  let sessionCookie = "";
  if (authenticatedTargets.length) {
    sessionCookie = await loginForLinkCheck(identityBaseUrl, env);
  }

  const selectedTargets = inventory.targets.filter((item) => {
    if (item.active === false || item.link_type === "contact" || item.link_type === "local_device") return false;
    return item.link_type === "internal" || includeExternal;
  });
  const checks = await mapConcurrent(selectedTargets, 8, (target) => checkTarget(target, {
    identityBaseUrl,
    sessionCookie,
  }));
  await requestJson(`${adminToolBaseUrl}/api/internal/link-integrity/checks`, {
    method: "POST",
    headers: { "x-gernetix-link-integrity-token": ingestToken },
    body: { checks },
  });

  if (sessionCookie) {
    await fetch(`${identityBaseUrl}/api/logout`, {
      method: "POST",
      headers: { cookie: sessionCookie },
    }).catch(() => {});
  }

  const broken = checks.filter((item) => ["broken", "unreachable"].includes(item.status));
  const summary = summarizeChecks(checks);
  console.log(JSON.stringify(summary));
  if (broken.length) process.exitCode = 1;
  return { inventory, checks, summary };
}

async function loginForLinkCheck(identityBaseUrl, env) {
  const identifier = required(env.LINK_CHECK_IDENTIFIER, "LINK_CHECK_IDENTIFIER");
  const password = required(env.LINK_CHECK_PASSWORD, "LINK_CHECK_PASSWORD");
  const response = await fetch(`${identityBaseUrl}/api/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ identifier, password }),
    redirect: "manual",
  });
  if (!response.ok) throw new Error(`Link-Check-Login fehlgeschlagen: HTTP ${response.status}`);
  const setCookie = response.headers.get("set-cookie") || "";
  const cookie = setCookie.split(";")[0];
  if (!cookie) throw new Error("Link-Check-Login lieferte kein Session-Cookie.");
  return cookie;
}

async function checkTarget(target, options) {
  const startedAt = Date.now();
  const checkedAt = new Date().toISOString();
  const targetUrl = target.link_type === "internal"
    ? new URL(target.target_url, `${options.identityBaseUrl}/`)
    : new URL(target.target_url);
  const fragment = targetUrl.hash;
  targetUrl.hash = "";
  const headers = {
    "user-agent": "GerNetiX-Link-Integrity/1.0",
    ...(target.access_scope === "authenticated" && options.sessionCookie ? { cookie: options.sessionCookie } : {}),
  };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(targetUrl, {
      method: "GET",
      headers,
      redirect: "manual",
      signal: controller.signal,
    });
    const location = response.headers.get("location") || "";
    let status = classifyStatus(response.status, target.access_scope, location);
    let fragmentStatus = fragment ? "not_applicable" : "";
    if (response.ok && fragment) {
      if (targetUrl.pathname.startsWith("/app/")) {
        fragmentStatus = "deferred_to_authenticated_browser";
      } else {
        const html = await response.text();
        const fragmentId = decodeURIComponent(fragment.slice(1));
        fragmentStatus = containsFragment(html, fragmentId) ? "healthy" : "missing";
        if (fragmentStatus === "missing") status = "broken";
      }
    }
    return {
      check_id: `link_check_${crypto.randomUUID()}`,
      reference_id: target.reference_id,
      checked_at: checkedAt,
      status,
      http_status: response.status,
      access_profile: target.access_scope,
      final_url: location ? new URL(location, targetUrl).href : targetUrl.href,
      duration_ms: Date.now() - startedAt,
      error_code: status === "broken" ? `http_${response.status}` : "",
      fragment: fragment || "",
      fragment_status: fragmentStatus,
    };
  } catch (error) {
    return {
      check_id: `link_check_${crypto.randomUUID()}`,
      reference_id: target.reference_id,
      checked_at: checkedAt,
      status: "unreachable",
      http_status: null,
      access_profile: target.access_scope,
      final_url: targetUrl.href,
      duration_ms: Date.now() - startedAt,
      error_code: error.name === "AbortError" ? "timeout" : "network_error",
      fragment: fragment || "",
      fragment_status: "",
    };
  } finally {
    clearTimeout(timeout);
  }
}

function classifyStatus(httpStatus, accessScope, location = "") {
  if (httpStatus >= 200 && httpStatus < 300) return "healthy";
  if (httpStatus >= 300 && httpStatus < 400) {
    if (accessScope === "authenticated" && /\/app\/auth(?:\/|\?|$)/.test(location)) return "broken";
    return "redirected";
  }
  if ([401, 403].includes(httpStatus)) return accessScope === "authenticated" ? "broken" : "restricted";
  return "broken";
}

function containsFragment(html, fragmentId) {
  const escaped = escapeRegExp(fragmentId);
  return new RegExp(`\\b(?:id|name)=["']${escaped}["']`, "i").test(html);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: {
      accept: "application/json",
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers || {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status} ${payload.error || ""}`.trim());
  return payload;
}

async function mapConcurrent(items, concurrency, worker) {
  const result = new Array(items.length);
  let nextIndex = 0;
  async function run() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      result[index] = await worker(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return result;
}

function summarizeChecks(checks) {
  const summary = { total: checks.length, healthy: 0, redirected: 0, restricted: 0, broken: 0, unreachable: 0 };
  for (const check of checks) summary[check.status] = (summary[check.status] || 0) + 1;
  return summary;
}

function required(value, name) {
  if (!String(value || "").trim()) throw new Error(`${name} muss gesetzt sein.`);
  return String(value);
}

function stripTrailingSlash(value) { return String(value).replace(/\/+$/, ""); }
function escapeRegExp(value) { return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

if (require.main === module) {
  main().catch((error) => {
    console.error(error.message || String(error));
    process.exitCode = 1;
  });
}

module.exports = {
  checkTarget,
  classifyStatus,
  containsFragment,
  main,
  summarizeChecks,
};
