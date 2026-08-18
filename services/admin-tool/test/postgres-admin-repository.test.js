"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { PostgresAdminRepository } = require("../src/repositories/postgres-admin-repository");

test("creates Operations tables for audit and interface telemetry", async () => {
  const pool = new RecordingPool();
  await new PostgresAdminRepository(pool).ensureSchema();
  assert.match(pool.calls[0].text, /operations_system_events/);
  assert.match(pool.calls[0].text, /operations_user_action_events/);
  assert.match(pool.calls[0].text, /operations_user_action_incidents/);
  assert.match(pool.calls[0].text, /operations_user_action_alerts/);
  assert.match(pool.calls[0].text, /operations_synthetic_check_results/);
  assert.match(pool.calls[0].text, /operations_audit_events/);
  assert.match(pool.calls[0].text, /operations_interface_calls/);
  assert.match(pool.calls[0].text, /operations_link_targets/);
  assert.match(pool.calls[0].text, /operations_link_occurrences/);
  assert.match(pool.calls[0].text, /operations_link_checks/);
  assert.match(pool.calls[0].text, /operations_migrations/);
});

test("persists one atomic synthetic check run in Operations PostgreSQL", async () => {
  const pool = new RecordingPool();
  const runId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
  await new PostgresAdminRepository(pool).addSyntheticCheckResults([{
    result_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", run_id: runId,
    checked_at: "2026-08-08T10:00:00.000Z", check_id: "login_ui",
    target_service: "identity_server", route: "/app/auth/", status: "passed",
    http_status: 200, response_ms: 12, reason_code: "ok",
  }]);
  assert.equal(pool.calls[0].text, "BEGIN");
  assert.match(pool.calls[1].text, /INSERT INTO operations_synthetic_check_results/);
  assert.equal(pool.calls[1].values[1], runId);
  assert.equal(pool.calls[2].text, "COMMIT");
});

test("persists user action incidents in the Operations database", async () => {
  const pool = new RecordingPool();
  const value = {
    incident_id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    created_at: "2026-08-07T12:00:00.000Z", updated_at: "2026-08-07T12:00:00.000Z",
    action_id: "11111111-1111-4111-8111-111111111111", action_type: "project.build.start",
    reason_code: "build_execution_failed", release_id: "2.0.0", status: "new",
    owner: "Platform Ops", runbook_url: "/docs/build", fix_release_id: "", note: "Analyse",
  };
  await new PostgresAdminRepository(pool).createUserActionIncident(value);
  assert.match(pool.calls[0].text, /INSERT INTO operations_user_action_incidents/);
  assert.equal(pool.calls[0].values[3], value.action_id);
  assert.equal(pool.calls[0].values[7], "new");
});

test("upserts deduplicated user action alert candidates", async () => {
  const pool = new RecordingPool();
  const value = {
    alert_key: "failure_rate:project.build.start:3.0.0:build_execution_failed",
    first_seen_at: "2026-08-07T12:00:00.000Z", last_seen_at: "2026-08-07T12:00:00.000Z",
    action_type: "project.build.start", release_id: "3.0.0", reason_code: "build_execution_failed",
    alert_kind: "failure_rate", severity: "warning", status: "observed", notification_state: "observe_only",
    attempts: 10, failures: 2, failure_rate_percent: 20, hanging: 0, window_hours: 24,
  };
  await new PostgresAdminRepository(pool).upsertUserActionAlert(value);
  assert.match(pool.calls[0].text, /ON CONFLICT \(alert_key\) DO UPDATE/);
  assert.equal(pool.calls[0].values[0], value.alert_key);
  assert.equal(pool.calls[0].values[9], "observe_only");
});

test("persists action ids and spans in the dedicated Operations table", async () => {
  const pool = new RecordingPool();
  const event = {
    event_id: "event-1", occurred_at: "2026-08-07T12:00:00.000Z",
    action_type: "nexi.flash.usb.start", action_id: "11111111-1111-4111-8111-111111111111",
    span_type: "helper.status", span_id: "22222222-2222-4222-8222-222222222222",
    phase: "failed", reason_code: "local_dependency_unreachable",
    route_id: "/nachbauprojekte/nexi-sprachassistent/", release_id: "0.1.0-test",
  };
  await new PostgresAdminRepository(pool).addUserActionEvent(event);
  assert.match(pool.calls[0].text, /INSERT INTO operations_user_action_events/);
  assert.equal(pool.calls[0].values[3], event.action_id);
  assert.equal(pool.calls[0].values[8], event.phase);
});

test("persists and reads action-correlated interface calls", async () => {
  const actionId = "11111111-1111-4111-8111-111111111111";
  const pool = new RecordingPool();
  const repository = new PostgresAdminRepository(pool);
  await repository.addInterfaceCall({
    occurred_at: "2026-08-07T12:00:00.000Z", source_service: "identity-server",
    target_service: "project-server", method: "POST", route: "/builds",
    status_code: 202, duration_ms: 42, succeeded: true,
    action_id: actionId, action_type: "project.build.start",
  });
  assert.match(pool.calls[0].text, /action_id, action_type/);
  assert.deepEqual(pool.calls[0].values.slice(-2), [actionId, "project.build.start"]);

  await repository.listInterfaceCalls({ action_id: actionId, limit: 1000 });
  assert.match(pool.calls[1].text, /action_id=\$1/);
  assert.deepEqual(pool.calls[1].values, [actionId, 1000]);
});

test("aggregates interface statistics in Operations PostgreSQL", async () => {
  const pool = new RecordingPool([{source_service:"identity-server",target_service:"project-server",calls:3,failed:1,average_ms:12,maximum_ms:24,last_call:"2026-08-17T10:00:00.000Z"}]);
  const items = await new PostgresAdminRepository(pool).interfaceCallStatistics({hours:999});
  assert.match(pool.calls[0].text,/FROM operations_interface_calls/);
  assert.match(pool.calls[0].text,/GROUP BY source_service, target_service/);
  assert.deepEqual(pool.calls[0].values,[168]);
  assert.equal(items[0].calls,3);
});

test("bounds the recent user action event window in PostgreSQL", async () => {
  const pool = new RecordingPool();
  await new PostgresAdminRepository(pool).listUserActionEvents({ action_type: "nexi.flash.usb.start", limit: 5000 });
  assert.match(pool.calls[0].text, /LIMIT \$2/);
  assert.deepEqual(pool.calls[0].values, ["nexi.flash.usb.start", 1000]);
});

test("filters one exact user action timeline in PostgreSQL", async () => {
  const pool = new RecordingPool();
  const actionId = "11111111-1111-4111-8111-111111111111";
  await new PostgresAdminRepository(pool).listUserActionEvents({ action_id: actionId, limit: 1000 });
  assert.match(pool.calls[0].text, /action_id=\$1/);
  assert.match(pool.calls[0].text, /ORDER BY occurred_at DESC LIMIT \$2/);
  assert.deepEqual(pool.calls[0].values, [actionId, 1000]);
});

test("aggregates user actions in PostgreSQL by time window, release and reason", async () => {
  const pool = new RecordingPool([{
    by_release: [{ action_type: "project.build.start", release_id: "2.0.0", attempts: 10, failed: 2 }],
    top_reason_codes: [{ action_type: "project.build.start", reason_code: "build_execution_failed", failures: 2 }],
    recent_actions: [],
  }]);
  const result = await new PostgresAdminRepository(pool).userActionOperationAggregates({ hours: 168, limit: 50 });
  assert.match(pool.calls[0].text, /make_interval\(hours/);
  assert.match(pool.calls[0].text, /GROUP BY action_type, release_id/);
  assert.match(pool.calls[0].text, /reason_rows/);
  assert.deepEqual(pool.calls[0].values, [168, 50]);
  assert.equal(result.by_release[0].release_id, "2.0.0");
});

test("filters system events in PostgreSQL", async () => {
  const event = { event_id: "event-1", severity: "error" };
  const pool = new RecordingPool([{ raw_json: event }]);
  const items = await new PostgresAdminRepository(pool).listSystemEvents({
    severity: "error", source_service: "identity-server",
  });
  assert.deepEqual(items, [event]);
  assert.deepEqual(pool.calls[0].values, ["error", "identity-server"]);
});

class RecordingPool {
  constructor(rows = []) { this.rows = rows; this.calls = []; }
  async query(text, values = []) {
    this.calls.push({ text, values });
    return { rows: this.rows, rowCount: this.rows.length };
  }
}
