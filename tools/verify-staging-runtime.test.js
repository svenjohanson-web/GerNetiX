"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  discoverIdentityRuntimePaths,
  dockerCopySources,
  verifyIdentityImageClosure,
} = require("./verify-staging-runtime");

const repoRoot = path.resolve(__dirname, "..");
const identityDockerfile = fs.readFileSync(path.join(repoRoot, "docker", "identity-service.Dockerfile"), "utf8");

test("discovers Identity dependencies outside its service directory", () => {
  const paths = discoverIdentityRuntimePaths({ repoRoot });
  for (const expected of [
    "Demoanwendungen/Boards/hardware.processor_board.esp32_s3_es3c28p/touch-spielesammlung/firmware",
    "basissoftware/esp32/firmware-build-targets.js",
    "docker/healthcheck.js",
    "projects/waveshare-voice-lab/voice_lab.cpp",
    "services/recovery-tool/src/services/recovery-service.js",
    "services/shared/index.js",
    "tools/usb-serial-helper/dist",
    "tools/usb-serial-helper/package.json",
  ]) {
    assert.ok(paths.includes(expected), expected);
  }
});

test("validates the complete dedicated Identity image closure", () => {
  const report = verifyIdentityImageClosure({ repoRoot });
  assert.ok(report.requiredPaths.length > 20);
  assert.ok(report.copySources.includes("tools/usb-serial-helper"));
});

test("fails locally before deployment when a required Docker COPY is missing", () => {
  const incompleteDockerfile = identityDockerfile
    .replace(/^COPY --chown=node:node tools\/usb-serial-helper .*\n/m, "");
  assert.throws(
    () => verifyIdentityImageClosure({ repoRoot, dockerfileContent: incompleteDockerfile }),
    /tools\/usb-serial-helper\/package\.json/,
  );
});

test("extracts every source from shell-form COPY commands", () => {
  assert.deepEqual(
    dockerCopySources("COPY --chown=node:node a/package.json a/package-lock.json ./a/\nCOPY b ./b\n"),
    ["a/package.json", "a/package-lock.json", "b"],
  );
});
