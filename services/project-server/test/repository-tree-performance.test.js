"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const source = fs.readFileSync(path.resolve(__dirname, "../src/repository-store/git-project-repository-store.js"), "utf8");
const forgejoStore = fs.readFileSync(path.resolve(__dirname, "../src/repository-store/forgejo-project-repository-store.js"), "utf8");

test("repository tree reads Git metadata without loading every blob", () => {
  const start = source.indexOf("async tree(input = {})");
  const end = source.indexOf("\n  async readFile", start);
  const implementation = source.slice(start, end);
  assert.match(implementation, /this\.treeEntries\(workspace, commitSha\)/);
  assert.doesNotMatch(implementation, /readTreeEntries/);
  assert.doesNotMatch(implementation, /cat-file/);
});

test("head reads use a shallow branch fetch instead of downloading repository history", () => {
  assert.match(forgejoStore, /commitSha === binding\.head_sha \? binding\.default_branch/);
  assert.match(source, /\["fetch", "--no-tags", "--depth", "1", "origin", `refs\/heads\/\$\{branch\}`\]/);
});
