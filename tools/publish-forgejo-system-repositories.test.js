"use strict";

const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const path = require("node:path");
const test = require("node:test");

test("plans all protected Basissoftware and product repositories without network writes", () => {
  const output = execFileSync(process.execPath, [path.join(__dirname, "publish-forgejo-system-repositories.js")], { encoding: "utf8" });
  const plan = JSON.parse(output);
  assert.equal(plan.mode, "plan");
  assert.deepEqual(plan.repositories.map((item) => item.repository_name), [
    "basissoftware-esp32", "basissoftware-esp8266", "nexi", "flashbox", "spielesammlung",
  ]);
  assert.ok(plan.repositories.every((item) => item.file_count > 1));
});
