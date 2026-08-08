"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { loadManifest } = require("../manifest");
const { createSeedClient, safeBaseUrl } = require("../seed-client");

test("seed client rejects every non-loopback or credential-bearing target", () => {
  assert.throws(() => safeBaseUrl("https://staging.example.invalid", "target", "14300"), /non-loopback/);
  assert.throws(() => safeBaseUrl("http://user:secret@127.0.0.1:14300", "target", "14300"), /must not contain credentials/);
  assert.throws(() => safeBaseUrl("https://127.0.0.1:14300", "target", "14300"), /must use http/);
  assert.throws(() => safeBaseUrl("http://127.0.0.1:4300", "target", "14300"), /dedicated system-test port 14300/);
});

test("seed uses real service routes and is idempotent", async () => {
  const manifest = loadManifest();
  const state = { accounts: new Map(), projects: new Map(), devices: new Map(), assignments: new Map(), writes: 0, calls: [] };
  const fetchImpl = createFakeFetch(state);
  const client = createSeedClient({
    fetchImpl,
    identityBaseUrl: "http://127.0.0.1:14300",
    projectBaseUrl: "http://localhost:14800",
    deviceBaseUrl: "http://[::1]:14700",
    writeConfirmed: true,
  });

  const first = await client.seed(manifest, "fixture-password-123");
  assert.deepEqual(first.stats.accounts, { created: 3, existing: 0 });
  assert.deepEqual(first.stats.projects, { created: 4, existing: 0 });
  assert.deepEqual(first.stats.devices, { created: 4, existing: 0 });
  assert.deepEqual(first.stats.assignments, { created: 4, existing: 0 });
  const writesAfterFirst = state.writes;

  const second = await client.seed(manifest, "fixture-password-123");
  assert.deepEqual(second.stats.accounts, { created: 0, existing: 3 });
  assert.deepEqual(second.stats.projects, { created: 0, existing: 4 });
  assert.deepEqual(second.stats.devices, { created: 0, existing: 4 });
  assert.deepEqual(second.stats.assignments, { created: 0, existing: 4 });
  assert.equal(state.writes, writesAfterFirst);
  assert.ok(state.calls.some((call) => call === "POST /api/register"));
  assert.ok(state.calls.some((call) => call === "POST /api/projects"));
  assert.ok(state.calls.some((call) => call === "POST /api/device-management/devices/register"));
});

test("seed refuses writes unless the caller confirms them explicitly", async () => {
  const client = createSeedClient({
    fetchImpl: async () => { throw new Error("must not be called"); },
    identityBaseUrl: "http://127.0.0.1:14300",
    projectBaseUrl: "http://127.0.0.1:14800",
    deviceBaseUrl: "http://127.0.0.1:14700",
  });
  await assert.rejects(() => client.seed(loadManifest(), "fixture-password-123"), /explicit confirmation/);
});

function createFakeFetch(state) {
  return async function fakeFetch(urlValue, options) {
    const url = new URL(urlValue);
    const body = options.body ? JSON.parse(options.body) : {};
    const call = `${options.method} ${url.pathname}`;
    state.calls.push(call);
    if (call === "POST /api/login") {
      const account = state.accounts.get(body.identifier);
      return json(account ? 200 : 401, account ? { account } : { error: "invalid_login" });
    }
    if (call === "POST /api/register") {
      const account = { user_id: `user-${body.username}`, username: body.username, email: body.email };
      state.accounts.set(body.email, account);
      state.writes += 1;
      return json(201, { account });
    }
    if (options.method === "GET" && url.pathname.startsWith("/api/projects/")) {
      const id = decodeURIComponent(url.pathname.slice("/api/projects/".length));
      return state.projects.has(id) ? json(200, state.projects.get(id)) : json(404, { error: "project_not_found" });
    }
    if (call === "POST /api/projects") {
      state.projects.set(body.project_id, body);
      state.writes += 1;
      return json(201, body);
    }
    const statusMatch = url.pathname.match(/^\/api\/device-management\/devices\/([^/]+)\/status$/);
    if (options.method === "GET" && statusMatch) {
      const device = state.devices.get(decodeURIComponent(statusMatch[1]));
      return device ? json(200, device) : json(404, { error: "device_not_found" });
    }
    if (call === "POST /api/device-management/devices/register") {
      state.devices.set(body.device_id, body);
      state.writes += 1;
      return json(201, body);
    }
    const assignmentMatch = url.pathname.match(/^\/api\/device-management\/accounts\/([^/]+)\/devices$/);
    if (assignmentMatch && options.method === "GET") {
      return json(200, { items: state.assignments.get(decodeURIComponent(assignmentMatch[1])) || [] });
    }
    if (assignmentMatch && options.method === "POST") {
      const accountId = decodeURIComponent(assignmentMatch[1]);
      const items = state.assignments.get(accountId) || [];
      items.push(body);
      state.assignments.set(accountId, items);
      state.writes += 1;
      return json(201, body);
    }
    throw new Error(`Unexpected fake request: ${call}`);
  };
}

function json(status, body) {
  return { status, async text() { return JSON.stringify(body); } };
}
