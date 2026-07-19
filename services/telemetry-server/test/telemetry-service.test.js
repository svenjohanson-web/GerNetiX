const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { SqliteTelemetryRepository } = require("../src/repositories/sqlite-telemetry-repository");
const { TelemetryService } = require("../src/services/telemetry-service");

function subject(options = {}) {
  const repository = new SqliteTelemetryRepository(path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-telemetry-")), "telemetry.sqlite"));
  return new TelemetryService({ repository, ownershipResolver: options.ownershipResolver || (async () => ({ account_id: "acct-owner" })), pushNotifier: options.pushNotifier, runtimeNotifier: options.runtimeNotifier, defaultMeasurementRetentionDays: 90, defaultEventRetentionDays: 365 });
}

test("derives account ownership server-side and only lists that account project data", async () => {
  const service = subject();
  await service.ingest({ device_id: "device-1", project_id: "project-1", measurements: [{ measurement_id: "m-1", metric: "temperature", value: 21.5, unit: "C", measured_at: "2026-07-16T10:00:00Z" }] });
  assert.equal(service.listMeasurements("acct-owner", "project-1", {}).length, 1);
  assert.equal(service.listMeasurements("acct-other", "project-1", {}).length, 0);
});

test("persists threshold events before requesting project-scoped push", async () => {
  const delivered = [];
  const service = subject({ pushNotifier: async (event) => { delivered.push({ event_id: event.event_id, account_id: event.account_id, project_id: event.project_id }); return { accepted: true }; } });
  await service.ingest({ device_id: "device-1", project_id: "project-1", events: [{ event_id: "e-1", event_type: "threshold_exceeded", severity: "warning", title: "Temperatur zu hoch", body: "31 C", notify_push: true, occurred_at: "2026-07-16T10:00:00Z" }] });
  assert.equal(service.listEvents("acct-owner", "project-1", {}).length, 1);
  assert.deepEqual(delivered, [{ event_id: "e-1", account_id: "acct-owner", project_id: "project-1" }]);
});

test("retention deletes expired telemetry while keeping current data", async () => {
  const service = subject();
  await service.ingest({ device_id: "device-1", project_id: "project-1", measurements: [
    { measurement_id: "old", metric: "temperature", value: 1, measured_at: "2025-01-01T00:00:00Z" },
    { measurement_id: "new", metric: "temperature", value: 2, measured_at: "2026-07-15T00:00:00Z" },
  ] });
  const result = service.prune(new Date("2026-07-16T00:00:00Z"));
  assert.equal(result.measurements_deleted, 1);
  assert.equal(service.listMeasurements("acct-owner", "project-1", {}).length, 1);
});

test("forwards transient runtime lines only after resolving device and project ownership", async () => {
  const received = [];
  const service = subject({ runtimeNotifier: async (runtime) => { received.push(runtime); return { accepted: true }; } });
  const result = await service.relayRuntime({ device_id: "device-1", project_id: "project-1", channel: "serial", line: "taste_gedrueckt" });
  assert.equal(result.accepted, true);
  assert.deepEqual(received[0], {
    account_id: "acct-owner", project_id: "project-1", device_id: "device-1", channel: "serial", line: "taste_gedrueckt", occurred_at: received[0].occurred_at,
  });
  assert.equal(service.listEvents("acct-owner", "project-1", {}).length, 0);
});
