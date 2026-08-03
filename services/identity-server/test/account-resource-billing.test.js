"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const server = fs.readFileSync(path.join(__dirname, "../src/dev-server.js"), "utf8");
const billing = fs.readFileSync(path.join(__dirname, "../public/app/app-billing-controller.js"), "utf8");

test("billing reconciles the effective plan and exposes only the current account resource summary", () => {
  assert.match(server, /\/api\/internal\/accounts\/\$\{encodeURIComponent\(accountId\)\}\/resource-plan/);
  assert.match(server, /body: \{ plan_id: subscription\.plan_id \}/);
  assert.match(server, /async function loadUserIdeProjects\(session\) \{[\s\S]*await ensureAccountResourcePlan\(session\)/);
  assert.match(server, /if \(project\.status === "plan_locked"\) return project/);
  assert.match(server, /plan_valid_until: session\.account\?\.plan_valid_until/);
  assert.match(server, /lifecycle_state: session\.account\?\.lifecycle_state/);
  assert.match(billing, /Policy-Version/);
  assert.match(billing, /Projekt-\/Git-Speicher/);
  assert.match(billing, /Davon gesperrt/);
  assert.match(billing, /measurement_source/);
  assert.match(billing, /\/api\/platform\/billing\/project-selection/);
  assert.match(billing, /data-project-selection/);
  assert.match(server, /active_project_ids: activeProjectIds/);
});

test("the selected build profile crosses Project Server and Build Deploy boundaries", () => {
  assert.match(server, /build_profile: body\.build_profile \|\| "standard"/);
  assert.match(server, /build_profile: projectServerJob\.build_profile \|\| body\.build_profile \|\| "standard"/);
});
