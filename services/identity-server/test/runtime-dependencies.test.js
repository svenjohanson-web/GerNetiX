"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  findMissingRuntimeDependencies,
  findMissingWorkspaceRuntimePaths
} = require("../scripts/verify-runtime-dependencies");

test("runtime dependency check reports every absent production package", () => {
  const nodeModulesDirectory = fs.mkdtempSync(path.join(os.tmpdir(), "identity-runtime-deps-"));
  fs.mkdirSync(path.join(nodeModulesDirectory, "@scope", "present"), { recursive: true });
  fs.mkdirSync(path.join(nodeModulesDirectory, "present"), { recursive: true });

  const missing = findMissingRuntimeDependencies({
    dependencies: {
      "@scope/present": "1.0.0",
      present: "1.0.0",
      missing: "1.0.0"
    },
    devDependencies: {
      "not-required-at-runtime": "1.0.0"
    }
  }, nodeModulesDirectory);

  assert.deepEqual(missing, ["missing"]);
});

test("runtime dependency check reports absent workspace runtime files", () => {
  const workspaceRoot = fs.mkdtempSync(path.join(os.tmpdir(), "identity-workspace-deps-"));
  fs.mkdirSync(path.join(workspaceRoot, "tools", "present"), { recursive: true });
  fs.writeFileSync(path.join(workspaceRoot, "tools", "present", "package.json"), "{}\n");

  const missing = findMissingWorkspaceRuntimePaths([
    "tools/present/package.json",
    "tools/missing/package.json"
  ], workspaceRoot);

  assert.deepEqual(missing, ["tools/missing/package.json"]);
});
