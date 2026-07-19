"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..");

test("node service image prepares every writable GerNetiX volume mount", () => {
  const compose = fs.readFileSync(path.join(repositoryRoot, "compose.vps.yaml"), "utf8");
  const dockerfile = fs.readFileSync(path.join(__dirname, "node-service.Dockerfile"), "utf8");
  const writableMounts = new Set();

  for (const line of compose.split(/\r?\n/)) {
    const match = line.match(/^\s+-\s+[A-Za-z0-9_-]+:(\/var\/lib\/gernetix\/[^:\s]+)\s*$/);
    if (match) writableMounts.add(match[1]);
  }

  assert.ok(writableMounts.size > 0, "keine schreibbaren GerNetiX-Volumes in Compose gefunden");
  for (const mountPath of writableMounts) {
    assert.match(dockerfile, new RegExp(`(?:^|\\s)${mountPath.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?:\\s|\\\\)`));
  }
});
