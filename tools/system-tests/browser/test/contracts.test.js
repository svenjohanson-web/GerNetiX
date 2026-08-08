"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { PATHS, SELECTORS, appUrl, isAuthPath, redactedResult } = require("../src/flow-contract");

test("declares login, project-list and project-detail contracts", () => {
  assert.equal(PATHS.auth, "/app/auth/");
  assert.equal(PATHS.projectList, "/app/learn/");
  assert.match(SELECTORS.projectCard, /data-open-learning-project-overview/);
  assert.match(SELECTORS.projectDetail, /learning-project-overview-head/);
  assert.equal(isAuthPath(appUrl(new URL("http://127.0.0.1:4300"), PATHS.auth)), true);
});

test("redacts credentials and only reports target origin", () => {
  const output = redactedResult({
    ok: true,
    scenarios: ["login_boundary"],
    target: "http://127.0.0.1:4300/app/?token=secret",
    sessionCookieValue: "secret",
  });
  assert.deepEqual(output, {
    ok: true,
    scenarios: ["login_boundary"],
    target: "http://127.0.0.1:4300",
  });
  assert.equal(JSON.stringify(output).includes("secret"), false);
});

test("runner keeps screenshots, traces and videos disabled by default", () => {
  const runner = fs.readFileSync(path.resolve(__dirname, "..", "run-browser-flow.js"), "utf8");
  assert.match(runner, /recordVideo: undefined/);
  assert.doesNotMatch(runner, /page\.screenshot|tracing\.start|recordVideo:\s*\{/);
  assert.match(runner, /safeErrorText\(error, \[process\.env\.GERNETIX_BROWSER_SESSION_COOKIE_VALUE\]\)/);
  assert.match(runner, /\[REDACTED\]/);
  assert.match(runner, /identity_persistence_unavailable/);
  assert.match(runner, /Dependency failure must be explained visibly/);
});
