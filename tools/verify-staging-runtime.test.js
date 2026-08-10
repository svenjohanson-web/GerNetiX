"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const {
  discoverIdentityRuntimePaths,
  dockerCopySources,
  verifyDockerfileCopySources,
  verifyIdentityImageClosure,
} = require("./verify-staging-runtime");

const repoRoot = path.resolve(__dirname, "..");
const identityDockerfile = fs.readFileSync(path.join(repoRoot, "docker", "identity-service.Dockerfile"), "utf8");
const dockerIgnore = fs.readFileSync(path.join(repoRoot, ".dockerignore"), "utf8");

test("discovers Identity dependencies outside its service directory", () => {
  const paths = discoverIdentityRuntimePaths({ repoRoot });
  for (const expected of [
    "services/shared/firmware-build-targets.js",
    "docker/healthcheck.js",
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
    .split(/\r?\n/)
    .filter((line) => !line.includes("COPY --chown=node:node tools/usb-serial-helper"))
    .join("\n");
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

test("rejects missing COPY sources in every staging runtime Dockerfile", () => {
  assert.throws(
    () => verifyDockerfileCopySources({
      repoRoot,
      dockerfiles: [{ name: "synthetic.Dockerfile", content: "COPY tools/does-not-exist.js ./tools/does-not-exist.js\n" }],
    }),
    /synthetic\.Dockerfile: tools\/does-not-exist\.js/,
  );
});

test("keeps protected project repositories out of the Docker build context", () => {
  assert.match(dockerIgnore, /^basissoftware$/m);
  assert.match(dockerIgnore, /^projects$/m);
  assert.match(dockerIgnore, /^Demoanwendungen$/m);
});
