"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { evaluateRun } = require("../../lib/summary");
const { mergeReports } = require("..");
const { main, parseArgs, safeReason } = require("../merge-cli");

function profile(overrides = {}) {
  return {
    profile: "smoke",
    api: { p95_ms: 500, p99_ms: 1000, unexpected_error_rate: 0.01 },
    devices: { count: 20 },
    chaos: { enabled: false, scenarios: [] },
    ...overrides,
  };
}

function sources() {
  return {
    k6: {
      schema_version: 1,
      suite: "gernetix-system-tests",
      scenario: "authenticated-project-flow",
      profile: "smoke",
      generated_at: "2026-08-08T12:00:00.000Z",
      state: { arbitrary: "not-copied" },
      metrics: {
        http_req_duration: { type: "trend", contains: "time", values: { "p(95)": 240, "p(99)": 480 }, thresholds: {} },
        http_req_failed: { type: "rate", contains: "default", values: { rate: 0.002 }, thresholds: {} },
        flow_failures: { type: "rate", contains: "default", values: { rate: 0.004 }, thresholds: {} },
      },
      checks: [{ group: "identity login", name: "login returns 200", passes: 10, fails: 0 }],
    },
    devices: {
      configuredDevices: 20,
      connected: 0,
      peakConnected: 20,
      connectAttempts: 20,
      connectionFailures: 0,
      disconnects: 0,
      reconnectScheduled: 0,
      reconnectExhausted: 0,
      published: 100,
      telemetryPublished: 100,
      duplicatePublished: 0,
      delayedPublished: 0,
      heartbeatPublished: 0,
      duplicatesScheduled: 0,
      delayedScheduled: 0,
      publishFailures: 0,
      finishedAt: "2026-08-08T12:02:00.000Z",
    },
    browser: {
      ok: true,
      scenarios: ["login_boundary", "project_list_and_detail", "visible_dependency_failure"],
      target: "http://127.0.0.1:4300",
    },
    chaos: [],
    integrity: { ok: true, issues: [] },
  };
}

test("merges all reports into the existing evaluateRun input contract", () => {
  const combined = mergeReports(profile(), sources(), { generatedAt: "2026-08-08T12:03:00.000Z" });
  assert.deepEqual(combined.api, { p95_ms: 240, p99_ms: 480, unexpected_error_rate: 0.004 });
  assert.deepEqual(combined.devices, { connected: 20, secret_leaks: 0 });
  assert.deepEqual(combined.integrity, {
    ok: true,
    snapshot_ok: true,
    browser_ok: true,
    issue_codes: [],
  });
  assert.equal(evaluateRun(profile(), combined).passed, true);
  assert.equal(Object.isFrozen(combined), true);
});

test("copies no free payloads, identifiers, targets or source state", () => {
  const input = sources();
  input.k6.state = { password: "TOP-SECRET", raw_payload: "PRIVATE-CONTENT" };
  input.k6.checks[0].name = "TOP-SECRET";
  input.integrity = {
    ok: false,
    issues: [{ code: "duplicate_active_build", subject: "TOP-SECRET" }],
  };
  const serialized = JSON.stringify(mergeReports(profile(), input, { generatedAt: "2026-08-08T12:03:00.000Z" }));
  assert.equal(serialized.includes("TOP-SECRET"), false);
  assert.equal(serialized.includes("PRIVATE-CONTENT"), false);
  assert.equal(serialized.includes("127.0.0.1"), false);
  assert.match(serialized, /duplicate_active_build/);
});

test("uses peakConnected because the stopped simulator reports zero active connections", () => {
  const combined = mergeReports(profile(), sources(), { generatedAt: "2026-08-08T12:03:00.000Z" });
  assert.equal(combined.devices.connected, 20);
});

test("fails closed for missing or invalid source data", () => {
  const missingMetric = sources();
  delete missingMetric.k6.metrics.flow_failures;
  assert.throws(() => mergeReports(profile(), missingMetric), /flow_failures/);

  const incompleteDevices = sources();
  delete incompleteDevices.devices.finishedAt;
  assert.throws(() => mergeReports(profile(), incompleteDevices), /finishedAt is required/);

  const injectedSecret = sources();
  injectedSecret.devices.password = "secret";
  assert.throws(() => mergeReports(profile(), injectedSecret), /unexpected field: password/);

  const inconsistentIntegrity = sources();
  inconsistentIntegrity.integrity.ok = true;
  inconsistentIntegrity.integrity.issues.push({ code: "duplicate_active_build", subject: "build-a" });
  assert.throws(() => mergeReports(profile(), inconsistentIntegrity), /does not match/);
});

test("makes a failed browser result fail the existing evaluator", () => {
  const input = sources();
  input.browser = { ok: false, scenarios: ["login_boundary"] };
  const combined = mergeReports(profile(), input, { generatedAt: "2026-08-08T12:03:00.000Z" });
  assert.equal(combined.integrity.ok, false);
  assert.deepEqual(combined.integrity.issue_codes, ["browser_flow_failed"]);
  assert.equal(evaluateRun(profile(), combined).passed, false);
});

test("supports an explicit skipped browser report without treating missing data as a skip", () => {
  const input = sources();
  input.browser = null;
  const combined = mergeReports(profile(), input, { generatedAt: "2026-08-08T12:03:00.000Z" });
  assert.deepEqual(combined.browser, { status: "skipped", ok: null, scenarios: [] });
  assert.equal(combined.integrity.ok, true);
  assert.equal(evaluateRun(profile(), combined).passed, true);

  delete input.browser;
  assert.throws(() => mergeReports(profile(), input), /sources.browser is required/);
});

test("requires every configured chaos result and preserves only recovery", () => {
  const input = sources();
  input.k6.profile = "load";
  input.chaos = [
    { scenario: "forgejo_unavailable", duration_ms: 5000, recovered: true },
    { scenario: "mqtt_connection_cut", duration_ms: 5000, recovered: false },
  ];
  const chaosProfile = profile({
    profile: "chaos",
    chaos: { enabled: true, scenarios: ["forgejo_unavailable", "mqtt_connection_cut"] },
  });
  const combined = mergeReports(chaosProfile, input, { generatedAt: "2026-08-08T12:03:00.000Z" });
  assert.deepEqual(combined.chaos, {
    forgejo_unavailable: { recovered: true },
    mqtt_connection_cut: { recovered: false },
  });
  assert.equal(evaluateRun(chaosProfile, combined).passed, false);

  input.chaos.pop();
  assert.throws(() => mergeReports(chaosProfile, input), /do not match configured scenarios/);
});

test("rejects forged successful browser results and non-loopback targets", () => {
  const incomplete = sources();
  incomplete.browser.scenarios.pop();
  assert.throws(() => mergeReports(profile(), incomplete), /requires every expected/);

  const remote = sources();
  remote.browser.target = "https://example.test";
  assert.throws(() => mergeReports(profile(), remote), /must be loopback/);
});

test("CLI reads concrete report files and emits only the combined result", () => {
  const input = sources();
  const files = {
    profile: JSON.stringify({
      schema_version: 1,
      environment: "isolated-local",
      duration_seconds: 120,
      ...profile(),
      api: { virtual_users: 10, request_timeout_ms: 5000, ...profile().api },
      devices: {
        count: 20,
        publish_interval_ms: 5000,
        reconnect_base_ms: 250,
        reconnect_max_ms: 10000,
        duplicate_rate: 0,
        late_rate: 0,
      },
    }),
    k6: JSON.stringify(input.k6),
    devices: JSON.stringify(input.devices),
    browser: JSON.stringify(input.browser),
    chaos: JSON.stringify(input.chaos),
    integrity: JSON.stringify(input.integrity),
  };
  const stdout = { value: "", write(text) { this.value += text; } };
  const argv = [
    "--profile-file", "profile", "--k6", "k6", "--devices", "devices",
    "--browser", "browser", "--chaos", "chaos", "--integrity", "integrity",
  ];
  const output = main(argv, {
    readFile: (file) => files[file],
    generatedAt: "2026-08-08T12:03:00.000Z",
    stdout,
  });
  assert.equal(output.schema_version, 1);
  assert.deepEqual(JSON.parse(stdout.value), output);
  assert.throws(() => parseArgs(argv.slice(0, -2)), /missing_integrity/);
});

test("CLI error reasons cannot echo arbitrary JSON or secrets", () => {
  assert.equal(safeReason(new Error('Unexpected token "SECRET" at position 4')), "invalid_report");
});
