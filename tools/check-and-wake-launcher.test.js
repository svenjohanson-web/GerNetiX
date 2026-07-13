const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const launcher = fs.readFileSync(path.resolve(__dirname, "GerNetiX-Check-und-Start.command"), "utf8");

test("macOS launcher wakes all services from the workspace root", () => {
  assert.match(launcher, /^#!\/bin\/bash/);
  assert.match(launcher, /"\$NODE_BIN" tools\/check-and-wake-processes\.js\n/);
  assert.match(launcher, /process-logs/);
});
