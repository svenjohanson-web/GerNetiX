import assert from "node:assert/strict";
import test from "node:test";
import { ROUTES, compactSummary, selectProject, settingUpdate } from "../lib/contracts.js";

test("routes match the Identity browser-facing API", () => {
  assert.equal(ROUTES.login, "/api/login");
  assert.equal(ROUTES.session, "/api/session");
  assert.equal(ROUTES.projectList, "/api/platform/bootstrap?include=projects");
  assert.equal(ROUTES.projectDetail("project/a"), "/api/platform/projects/project%2Fa");
  assert.equal(ROUTES.projectApp("project a"), "/api/platform/projects/project%20a/project-app");
});

test("project selection prefers active account projects and project apps when required", () => {
  const projects = [
    { id: "catalog", projectOrigin: "catalog", status: "catalog_template" },
    { id: "locked", projectOrigin: "account_project", status: "plan_locked", hasProjectApp: true },
    { id: "active", projectOrigin: "account_project", status: "active" },
    { id: "app", projectOrigin: "account_project", status: "active", hasProjectApp: true },
  ];
  assert.equal(selectProject(projects).id, "active");
  assert.equal(selectProject(projects, { requireProjectApp: true }).id, "app");
  assert.equal(selectProject(projects, { projectId: "app" }).id, "app");
  assert.equal(selectProject(projects, { projectId: "missing" }), null);
});

test("settings update preserves the CAS contract and supports false values", () => {
  assert.deepEqual(settingUpdate({ manifest_version: 3, revision: 7, values: { enabled: true } }, {
    settingKey: "enabled", settingValue: false,
  }), {
    manifest_version: 3,
    expected_revision: 7,
    values: { enabled: false },
  });
  assert.deepEqual(settingUpdate({ manifest_version: 3, revision: 7, values: { enabled: true } }, {
    settingKey: "enabled", settingValue: undefined,
  }).values, { enabled: true });
  assert.throws(
    () => settingUpdate({ manifest_version: 3, revision: 7, values: {} }, { settingKey: "missing" }),
    /SETTING_VALUE is required/,
  );
});

test("compact summary is JSON-compatible and flattens nested checks", () => {
  const summary = compactSummary({
    state: { isStdOutTTY: false },
    metrics: { http_req_duration: { type: "trend", contains: "time", values: { "p(95)": 42 }, thresholds: { target: { ok: true } } } },
    root_group: { name: "", checks: [], groups: [{ name: "project detail", checks: [{ name: "returns 200", passes: 2, fails: 0 }], groups: [] }] },
  }, { profile: "smoke", generatedAt: "2026-08-08T00:00:00.000Z" });
  assert.equal(summary.profile, "smoke");
  assert.deepEqual(summary.checks, [{ group: "project detail", name: "returns 200", passes: 2, fails: 0 }]);
  assert.doesNotThrow(() => JSON.stringify(summary));
});
