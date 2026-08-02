"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.join(__dirname, "..", "public", "app", "flash-progress.js"), "utf8");

function flashProgressForTest() {
  const context = { window: {} };
  vm.runInNewContext(source, context);
  return context.window.GerNetiXFlashProgress;
}

test("flash progress prefers the helper's structured overall percent", () => {
  const progress = flashProgressForTest();
  assert.equal(progress.progressFromJob({ percent: 67, logs: ["Writing 42 %"] }), 67);
  assert.equal(progress.messageFromJob({ phase: "verifying" }), "Geschriebene Firmware wird geprüft");
});

test("flash progress remains compatible with helper log percentages", () => {
  const progress = flashProgressForTest();
  assert.equal(progress.progressFromJob({ logs: ["Connecting...", "Writing at 0x10000 (42 %)"] }), 42);
  assert.equal(progress.progressFromJob({ logs: [{ line: "Writing 105 %" }] }), 100);
  assert.equal(progress.progressFromJob({ percent: null, logs: ["Writing 36 %"] }), 36);
  assert.equal(progress.progressFromJob({ logs: ["Board wird verbunden"] }), null);
});
