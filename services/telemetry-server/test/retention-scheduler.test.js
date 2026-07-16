const assert = require("node:assert/strict");
const test = require("node:test");
const { startRetentionScheduler } = require("../src/retention-scheduler");

test("runs retention at startup and schedules the next run", () => {
  let prunes = 0; let delay = 0; let callback;
  const timer = { unref() {} };
  const result = startRetentionScheduler({ service: { prune() { prunes += 1; } }, intervalHours: 6, setIntervalImpl(fn, milliseconds) { callback = fn; delay = milliseconds; return timer; }, log: { error() {} } });
  assert.equal(result, timer);
  assert.equal(prunes, 1);
  assert.equal(delay, 6 * 60 * 60 * 1000);
  callback();
  assert.equal(prunes, 2);
});
