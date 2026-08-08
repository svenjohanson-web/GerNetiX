"use strict";

const path = require("node:path");
const { assertSafeTarget } = require("./config");

function buildRunPlan(profile, options = {}) {
  const identityUrl = assertDedicatedIdentityTarget(options.identityUrl || "http://127.0.0.1:14300");
  const brokerUrl = assertSafeMqttTarget(options.brokerUrl || "mqtt://127.0.0.1:51883");
  const reportDirectory = options.reportDirectory || ".runtime/reports";
  const duration = secondsToK6Duration(profile.duration_seconds);
  return Object.freeze({
    schema_version: 1,
    profile: profile.profile,
    safety_scope: "isolated-local",
    prerequisites: [
      "synthetic fixtures exist",
      "target health checks pass",
      "k6 is installed for API load execution",
    ],
    infrastructure: {
      compose_file: "infra/system-test/compose.yaml",
      starts_automatically: false,
    },
    api: {
      executable: "k6",
      arguments: ["run", "tools/system-tests/k6/scenario.js"],
      environment: {
        PROFILE: profile.profile === "smoke" ? "smoke" : "load",
        BASE_URL: identityUrl,
        VUS: String(profile.api.virtual_users),
        DURATION: duration,
        MAX_DURATION: duration,
        P95_MS: String(profile.api.p95_ms),
        P99_MS: String(profile.api.p99_ms),
        MAX_ERROR_RATE: String(profile.api.unexpected_error_rate),
        REQUEST_TIMEOUT_MS: String(profile.api.request_timeout_ms),
        SUMMARY_PATH: path.posix.join(reportDirectory, `k6-${profile.profile}.json`),
      },
      secret_environment: ["USERNAME", "USERNAME_TEMPLATE", "PASSWORD", "PASSWORD_TEMPLATE"],
    },
    devices: {
      executable: "node",
      arguments: [
        "tools/system-tests/devices/src/cli.js",
        "--broker-url", brokerUrl,
        "--device-map", "tools/system-tests/fixtures/manifest.v1.json",
        "--device-count", String(profile.devices.count),
        "--duration-ms", String(profile.duration_seconds * 1000),
        "--telemetry-interval-ms", String(profile.devices.publish_interval_ms),
        "--duplicate-rate", String(profile.devices.duplicate_rate),
        "--delayed-rate", String(profile.devices.late_rate),
        "--reconnect-base-ms", String(profile.devices.reconnect_base_ms),
        "--reconnect-max-ms", String(profile.devices.reconnect_max_ms),
      ],
    },
    chaos: {
      enabled: profile.chaos.enabled,
      scenarios: [...profile.chaos.scenarios],
      automatic_activation: false,
    },
  });
}

function assertSafeMqttTarget(target) {
  const url = new URL(target);
  if (url.protocol !== "mqtt:") throw new Error("Local system-test broker must use mqtt://");
  if (!new Set(["localhost", "127.0.0.1", "::1"]).has(url.hostname)) {
    throw new Error(`Refusing non-loopback system-test broker: ${url.hostname}`);
  }
  if (url.username || url.password || (url.pathname && url.pathname !== "/")) {
    throw new Error("System-test broker URL must not contain credentials or a path");
  }
  if (url.port !== "51883") throw new Error("MQTT system-test target must use dedicated port 51883");
  return url.toString().replace(/\/$/, "");
}

function assertDedicatedIdentityTarget(target) {
  const url = assertSafeTarget(target);
  if (url.port !== "14300") throw new Error("Identity system-test target must use dedicated port 14300");
  return url.toString().replace(/\/$/, "");
}

function secondsToK6Duration(seconds) {
  return seconds % 60 === 0 ? `${seconds / 60}m` : `${seconds}s`;
}

module.exports = { assertDedicatedIdentityTarget, assertSafeMqttTarget, buildRunPlan, secondsToK6Duration };
