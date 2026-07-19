"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  findMissingRuntimeDependencies
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
