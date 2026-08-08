import assert from "node:assert/strict";
import test from "node:test";
import { buildConfig, credentialsForVu } from "../lib/config.js";

test("smoke profile builds bounded shared iterations and thresholds", () => {
  const config = buildConfig({ USERNAME: "load-user", PASSWORD: "secret" });
  assert.equal(config.profile, "smoke");
  assert.deepEqual(config.options.scenarios.gernetix_api, {
    executor: "shared-iterations",
    vus: 10,
    iterations: 10,
    maxDuration: "2m",
    gracefulStop: "5s",
    tags: { profile: "smoke" },
  });
  assert.deepEqual(config.options.thresholds.http_req_duration, ["p(95)<500", "p(99)<1000"]);
});

test("load profile honors ramp and threshold overrides", () => {
  const config = buildConfig({
    PROFILE: "load", USERNAME_TEMPLATE: "user-{vu}", PASSWORD_TEMPLATE: "pw-{index}",
    USER_OFFSET: "20", VUS: "250", RAMP_UP: "30s", DURATION: "4m", RAMP_DOWN: "45s",
    P95_MS: "750", P99_MS: "1250", MAX_ERROR_RATE: "0.02",
  });
  assert.deepEqual(config.options.scenarios.gernetix_api.stages, [
    { duration: "30s", target: 250 },
    { duration: "4m", target: 250 },
    { duration: "45s", target: 0 },
  ]);
  assert.deepEqual(credentialsForVu(config, 3), { username: "user-23", password: "pw-23" });
  assert.deepEqual(config.options.thresholds.flow_failures, ["rate<0.02"]);
});

test("settings writes require an explicit key and parse JSON values", () => {
  assert.throws(
    () => buildConfig({ USERNAME: "user", PASSWORD: "pw", SAVE_SETTINGS: "true" }),
    /SETTING_KEY is required/,
  );
  const config = buildConfig({
    USERNAME: "user", PASSWORD: "pw", SAVE_SETTINGS: "true", SETTING_KEY: "enabled", SETTING_VALUE: "false",
  });
  assert.equal(config.saveSettings, true);
  assert.equal(config.settingValue, false);
});

test("configuration rejects unsafe or malformed input", () => {
  assert.throws(() => buildConfig({ PASSWORD: "pw" }), /USERNAME/);
  assert.throws(() => buildConfig({ USERNAME: "user", PASSWORD: "pw", BASE_URL: "ftp://example.test" }), /HTTP or HTTPS/);
  assert.throws(() => buildConfig({ USERNAME: "user", PASSWORD: "pw", BASE_URL: "https://load.example.test" }), /ALLOW_REMOTE_TARGET=true/);
  assert.throws(() => buildConfig({ USERNAME: "user", PASSWORD: "pw", BASE_URL: "https://user:pw@load.example.test", ALLOW_REMOTE_TARGET: "true" }), /must not contain credentials/);
  assert.throws(() => buildConfig({ USERNAME: "user", PASSWORD: "pw", MAX_ERROR_RATE: "2" }), /<= 1/);
  assert.throws(() => buildConfig({ USERNAME: "user", PASSWORD: "pw", DURATION: "forever", PROFILE: "load" }), /k6 duration/);
});

test("remote target needs an explicit opt-in and is tagged", () => {
  const local = buildConfig({ USERNAME: "user", PASSWORD: "pw", BASE_URL: "http://localhost:4300" });
  assert.equal(local.options.tags.target_scope, "isolated-local");
  const remote = buildConfig({
    USERNAME: "user", PASSWORD: "pw", BASE_URL: "https://load.example.test", ALLOW_REMOTE_TARGET: "true",
  });
  assert.equal(remote.baseUrl, "https://load.example.test");
  assert.equal(remote.options.tags.target_scope, "explicit-remote");
});
