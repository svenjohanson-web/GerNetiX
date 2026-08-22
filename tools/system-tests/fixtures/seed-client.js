"use strict";

const { issueInternalToken } = require("../../../services/shared/internal-api-auth");

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
const FIXTURE_SERVICE_PORTS = Object.freeze({ identity: "14300", project: "14800", device: "14700" });

function createSeedClient(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required");
  const targets = Object.freeze({
    identity: safeBaseUrl(options.identityBaseUrl, "identityBaseUrl", FIXTURE_SERVICE_PORTS.identity),
    project: safeBaseUrl(options.projectBaseUrl, "projectBaseUrl", FIXTURE_SERVICE_PORTS.project),
    device: safeBaseUrl(options.deviceBaseUrl, "deviceBaseUrl", FIXTURE_SERVICE_PORTS.device),
  });
  const writeConfirmed = options.writeConfirmed === true;
  const internalApiAuth = options.internalApiAuth || options.internalApiSigningKey || "";
  const timeoutMs = integer(options.timeoutMs || 5_000, "timeoutMs", 100, 60_000);

  async function seed(manifest, password) {
    if (!writeConfirmed) {
      throw new Error("Fixture writes require explicit confirmation");
    }
    if (typeof password !== "string" || password.length < 12) {
      throw new Error("Fixture password must contain at least 12 characters");
    }
    const stats = { accounts: { created: 0, existing: 0 }, projects: { created: 0, existing: 0 }, devices: { created: 0, existing: 0 }, assignments: { created: 0, existing: 0 } };
    const accounts = new Map();

    for (const fixture of manifest.accounts) {
      const result = await ensureAccount(fixture, password);
      accounts.set(fixture.fixture_id, result.account);
      stats.accounts[result.created ? "created" : "existing"] += 1;
    }
    for (const fixture of manifest.projects) {
      const created = await ensureProject(fixture, accounts.get(fixture.account_fixture_id));
      stats.projects[created ? "created" : "existing"] += 1;
    }
    for (const fixture of manifest.devices) {
      const created = await ensureDevice(fixture);
      stats.devices[created ? "created" : "existing"] += 1;
      const assigned = await ensureAssignment(fixture, accounts.get(fixture.account_fixture_id));
      stats.assignments[assigned ? "created" : "existing"] += 1;
    }
    return { fixture_set: manifest.fixture_set, stats, accounts: Object.fromEntries([...accounts].map(([id, account]) => [id, account.user_id])) };
  }

  async function ensureAccount(fixture, password) {
    const loginBody = { identifier: fixture.email, password, locale: fixture.locale };
    const login = await request("identity", "POST", "/api/login", loginBody, [200, 401]);
    if (login.status === 200) return { account: login.body.account, created: false };
    const registered = await request("identity", "POST", "/api/register", {
      username: fixture.username,
      email: fixture.email,
      password,
      password_repeat: password,
      accepted_terms: true,
      locale: fixture.locale,
    }, [201, 202]);
    if (registered.status === 202) {
      throw new Error(`Fixture account ${fixture.fixture_id} requires email verification; use an isolated Identity instance without SMTP`);
    }
    return { account: registered.body.account, created: true };
  }

  async function ensureProject(fixture, account) {
    requireAccount(account, fixture.account_fixture_id);
    const projectAuth = projectHeaders(internalApiAuth, account.user_id, fixture.project_id, "project.read");
    const found = await request("project", "GET", `/api/projects/${encodeURIComponent(fixture.project_id)}`, undefined, [200, 404], projectAuth);
    if (found.status === 200) {
      if (found.body.user_id !== account.user_id) throw new Error(`Project ownership mismatch: ${fixture.project_id}`);
      return false;
    }
    await request("project", "POST", "/api/projects", {
      project_id: fixture.project_id,
      user_id: account.user_id,
      plan_id: fixture.plan_id,
      title: fixture.title,
      description: fixture.description,
      hardware_profile_id: fixture.hardware_profile_id,
    }, [201], projectHeaders(internalApiAuth, account.user_id, fixture.project_id, "project.write"));
    return true;
  }

  async function ensureDevice(fixture) {
    const found = await request("device", "GET", `/api/device-management/devices/${encodeURIComponent(fixture.device_id)}/status`, undefined, [200, 404],
      serviceHeaders(internalApiAuth, "device-management-server", "device.status.read"));
    if (found.status === 200) {
      if (found.body.serial_number !== fixture.serial_number) throw new Error(`Device serial mismatch: ${fixture.device_id}`);
      return false;
    }
    await request("device", "POST", "/api/device-management/devices/register", {
      device_id: fixture.device_id,
      serial_number: fixture.serial_number,
      hardware_profile_id: fixture.hardware_profile_id,
      board_short_name: fixture.board_short_name,
      node_name: fixture.node_name,
      connectivity_status: fixture.connectivity_status,
      ota_status: fixture.ota_status,
      authenticity_status: "community_unverified",
    }, [201], serviceHeaders(internalApiAuth, "device-management-server", "device.register"));
    return true;
  }

  async function ensureAssignment(fixture, account) {
    requireAccount(account, fixture.account_fixture_id);
    const path = `/api/device-management/accounts/${encodeURIComponent(account.user_id)}/devices`;
    const listed = await request("device", "GET", path, undefined, [200],
      accountHeaders(internalApiAuth, "device-management-server", account.user_id, "device.account.read"));
    if ((listed.body.items || []).some((item) => item.device_id === fixture.device_id)) return false;
    await request("device", "POST", path, {
      device_id: fixture.device_id,
      display_name: fixture.display_name,
      board_short_name: fixture.board_short_name,
      node_name: fixture.node_name,
    }, [201], accountHeaders(internalApiAuth, "device-management-server", account.user_id, "device.account.write"));
    return true;
  }

  async function request(targetName, method, pathname, body, expectedStatuses, extraHeaders = {}) {
    const url = new URL(pathname, targets[targetName]);
    assertLoopback(url);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response;
    try {
      response = await fetchImpl(url, {
        method,
        redirect: "error",
        signal: controller.signal,
        headers: body === undefined
          ? { Accept: "application/json", ...extraHeaders }
          : { Accept: "application/json", "Content-Type": "application/json", ...extraHeaders },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
    } finally {
      clearTimeout(timeout);
    }
    const text = await response.text();
    let payload = {};
    try { payload = text ? JSON.parse(text) : {}; } catch { throw new Error(`${method} ${pathname} returned invalid JSON`); }
    if (!expectedStatuses.includes(response.status)) {
      throw new Error(`${method} ${pathname} returned ${response.status}: ${payload.error || "unexpected_status"}`);
    }
    return { status: response.status, body: payload };
  }

  return { seed, targets };
}

function projectHeaders(secret, accountId, projectId, scope) {
  const common = { iss: "system-test-seed", sub: "system-test-seed", aud: "project-server", scopes: [scope] };
  return {
    Authorization: `Bearer ${issueInternalToken(common, secret)}`,
    "X-GerNetiX-Project-Delegation": issueInternalToken({
      ...common,
      kind: "delegated_user_action",
      context: { account_id: accountId, project_ids: [projectId], entitlements: [] },
    }, secret),
  };
}

function serviceHeaders(secret, audience, scope) {
  return {
    Authorization: `Bearer ${issueInternalToken({
      iss: "system-test-seed", sub: "system-test-seed", aud: audience, scopes: [scope],
    }, secret)}`,
  };
}

function accountHeaders(secret, audience, accountId, scope) {
  const common = { iss: "system-test-seed", sub: "system-test-seed", aud: audience, scopes: [scope] };
  return {
    Authorization: `Bearer ${issueInternalToken(common, secret)}`,
    "X-GerNetiX-Delegation": issueInternalToken({
      ...common,
      kind: "delegated_user_action",
      context: { account_id: accountId, project_ids: [], entitlements: [] },
    }, secret),
  };
}

function safeBaseUrl(value, field, expectedPort) {
  if (typeof value !== "string" || !value) throw new Error(`${field} is required`);
  const url = new URL(value);
  assertLoopback(url);
  if (url.protocol !== "http:") throw new Error(`${field} must use http for the isolated local environment`);
  if (url.username || url.password || url.search || url.hash) throw new Error(`${field} must not contain credentials, query, or fragment`);
  if (url.port !== String(expectedPort || "")) {
    throw new Error(`${field} must use dedicated system-test port ${expectedPort}`);
  }
  url.pathname = url.pathname.replace(/\/*$/, "/");
  return url;
}

function assertLoopback(url) {
  if (!LOOPBACK_HOSTS.has(url.hostname)) throw new Error(`Refusing non-loopback fixture target: ${url.hostname}`);
}

function requireAccount(account, fixtureId) {
  if (!account || typeof account.user_id !== "string" || !account.user_id) throw new Error(`Identity response missing user_id for ${fixtureId}`);
}

function integer(value, field, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new Error(`${field} must be between ${minimum} and ${maximum}`);
  return value;
}

module.exports = { FIXTURE_SERVICE_PORTS, LOOPBACK_HOSTS, createSeedClient, safeBaseUrl };
