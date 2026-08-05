"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");

const { loadProjectAppTelemetry, resolveProjectAppBindings } = require("../src/dev/server/project-routes");

test("resolves only typed Project-App bindings for the session project", async () => {
  const result = await resolveProjectAppBindings({
    manifest: { bindings: [
      { id: "connection", type: "device_status", field: "connection_state" },
      { id: "firmware", type: "device_status", field: "firmware_version" },
      { id: "requests", type: "ai_usage", field: "monthly_requests" },
      { id: "budget", type: "ai_usage", field: "remaining_budget" },
      { id: "project_title", type: "project", field: "title" },
      { id: "setting", type: "setting", key: "voice" },
      { id: "temperature", type: "telemetry", metric_id: "room.temperature" },
    ] },
    project: { title: "Nexi", status: "active", updated_at: "2026-08-04T12:00:00.000Z", linked_device_id: "device-nexi", linked_device_ids: ["device-nexi", "device-bedroom"] },
    assignedDeviceIds: ["device-bedroom", "device-nexi"],
    session: { id: "session-1" },
    loadUserIdeDevices: async () => [{
      device_id: "device-nexi", connectivity_status: "online", firmware_version: "1.2.3",
    }, {
      device_id: "device-bedroom", connectivity_status: "offline", firmware_version: "2.0.0",
    }, { device_id: "foreign-device", connectivity_status: "offline", firmware_version: "9.9.9" }],
    loadAiUsageSummary: async () => ({ available: true, account_usage: { monthly_requests: 7, available_credits: 93 } }),
    loadProjectTelemetry: async () => ({ items: [
      { value: 22.5, unit: "°C", measured_at: "2026-08-04T12:02:00.000Z", metadata: { secret: "hidden" } },
      { value: 21.5, unit: "°C", measured_at: "2026-08-04T12:01:00.000Z" },
    ] }),
  });

  assert.deepEqual(result, {
    connection: "offline",
    firmware: "2.0.0",
    requests: 7,
    budget: 93,
    project_title: "Nexi",
    temperature: [
      { value: 21.5, unit: "°C", measured_at: "2026-08-04T12:01:00.000Z" },
      { value: 22.5, unit: "°C", measured_at: "2026-08-04T12:02:00.000Z" },
    ],
  });
  assert.equal(Object.hasOwn(result, "setting"), false);
});

test("builds telemetry reads only from the server-derived account, project and assigned device", async () => {
  const calls = [];
  const response = await loadProjectAppTelemetry({
    binding: { metric_id: "room.temperature", device_scope: "assigned_device" },
    project: { project_server_id: "project-server-1", linked_device_id: "device-nexi" },
    accountId: "account-1",
    telemetryJson: async (path) => { calls.push(path); return { items: [] }; },
  });
  assert.deepEqual(response, { items: [] });
  assert.equal(calls.length, 1);
  const url = new URL(calls[0], "http://identity.test");
  assert.equal(url.pathname, "/api/telemetry/internal/accounts/account-1/projects/project-server-1/measurements");
  assert.equal(url.searchParams.get("metric"), "room.temperature");
  assert.equal(url.searchParams.get("device_id"), "device-nexi");
  assert.equal(url.searchParams.get("limit"), "24");
});

test("does not query assigned-device telemetry without a project device binding", async () => {
  let called = false;
  const response = await loadProjectAppTelemetry({
    binding: { metric_id: "room.temperature", device_scope: "assigned_device" },
    project: { project_server_id: "project-server-1" },
    accountId: "account-1",
    telemetryJson: async () => { called = true; },
  });
  assert.deepEqual(response, { items: [] });
  assert.equal(called, false);
});

test("keeps dependency failures local to status widgets", async () => {
  const result = await resolveProjectAppBindings({
    manifest: { bindings: [
      { id: "connection", type: "device_status", field: "connection_state" },
      { id: "requests", type: "ai_usage", field: "monthly_requests" },
      { id: "project_status", type: "project", field: "status" },
    ] },
    project: { title: "Nexi", status: "active", linked_device_id: "device-nexi" },
    session: {},
    loadUserIdeDevices: async () => { throw new Error("offline"); },
    loadAiUsageSummary: async () => ({ available: false }),
  });
  assert.deepEqual(result, { project_status: "active" });
});
