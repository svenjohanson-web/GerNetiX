const assert = require("node:assert/strict");
const test = require("node:test");
const { createRuntimeStreamHub } = require("../src/runtime-stream-hub");

test("delivers a runtime line only to the matching account and project stream", () => {
  const hub = createRuntimeStreamHub();
  const owner = [];
  const other = [];
  hub.subscribe({ accountId: "acct-owner", projectId: "project-1", send: (payload) => owner.push(JSON.parse(payload)) });
  hub.subscribe({ accountId: "acct-other", projectId: "project-1", send: (payload) => other.push(JSON.parse(payload)) });
  hub.publish({ accountId: "acct-owner", projectId: "project-1", deviceId: "device-1", line: "taste_gedrueckt" });
  assert.equal(owner.length, 1);
  assert.equal(other.length, 0);
  assert.equal(owner[0].line, "taste_gedrueckt");
});
