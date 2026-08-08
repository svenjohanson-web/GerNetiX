"use strict";

const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

function createSeedClient(options = {}) {
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== "function") throw new Error("A fetch implementation is required");
  const targets = Object.freeze({
    identity: safeBaseUrl(options.identityBaseUrl, "identityBaseUrl"),
    project: safeBaseUrl(options.projectBaseUrl, "projectBaseUrl"),
    device: safeBaseUrl(options.deviceBaseUrl, "deviceBaseUrl"),
  });
  const timeoutMs = integer(options.timeoutMs || 5_000, "timeoutMs", 100, 60_000);

  async function seed(manifest, password) {
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
    const found = await request("project", "GET", `/api/projects/${encodeURIComponent(fixture.project_id)}`, undefined, [200, 404]);
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
    }, [201]);
    return true;
  }

  async function ensureDevice(fixture) {
    const found = await request("device", "GET", `/api/device-management/devices/${encodeURIComponent(fixture.device_id)}/status`, undefined, [200, 404]);
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
    }, [201]);
    return true;
  }

  async function ensureAssignment(fixture, account) {
    requireAccount(account, fixture.account_fixture_id);
    const path = `/api/device-management/accounts/${encodeURIComponent(account.user_id)}/devices`;
    const listed = await request("device", "GET", path, undefined, [200]);
    if ((listed.body.items || []).some((item) => item.device_id === fixture.device_id)) return false;
    await request("device", "POST", path, {
      device_id: fixture.device_id,
      display_name: fixture.display_name,
      board_short_name: fixture.board_short_name,
      node_name: fixture.node_name,
    }, [201]);
    return true;
  }

  async function request(targetName, method, pathname, body, expectedStatuses) {
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
        headers: body === undefined ? { Accept: "application/json" } : { Accept: "application/json", "Content-Type": "application/json" },
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

function safeBaseUrl(value, field) {
  if (typeof value !== "string" || !value) throw new Error(`${field} is required`);
  const url = new URL(value);
  assertLoopback(url);
  if (url.protocol !== "http:") throw new Error(`${field} must use http for the isolated local environment`);
  if (url.username || url.password || url.search || url.hash) throw new Error(`${field} must not contain credentials, query, or fragment`);
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

module.exports = { LOOPBACK_HOSTS, createSeedClient, safeBaseUrl };
