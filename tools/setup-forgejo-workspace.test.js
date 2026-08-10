"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");
const { parseArgs } = require("./setup-forgejo-workspace");

test("uses one external workspace and a bounded developer name", () => {
  const parsed = parseArgs(["--directory", "C:/workspace/GerNetiX-Projekte", "--username", "sven"]);
  assert.equal(parsed.username, "sven");
  assert.equal(parsed.directory, path.resolve("C:/workspace/GerNetiX-Projekte"));
  assert.throws(() => parseArgs(["--username", "../admin"]), /username_invalid/);
});
