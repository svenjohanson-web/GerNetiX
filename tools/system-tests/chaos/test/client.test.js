"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { assertLoopbackControlUrl, createToxiproxyClient } = require("../client");

test("accepts only numeric loopback control origins", () => {
  assert.equal(assertLoopbackControlUrl("http://127.0.0.1:8474"), "http://127.0.0.1:8474");
  assert.equal(assertLoopbackControlUrl("http://[::1]:8474"), "http://[::1]:8474");
  for (const target of [
    "https://127.0.0.1:8474",
    "http://localhost:8474",
    "http://10.0.0.1:8474",
    "http://toxiproxy:8474",
    "http://127.0.0.1:8474/proxies",
    "http://user:password@127.0.0.1:8474",
  ]) {
    assert.throws(() => assertLoopbackControlUrl(target), /loopback|only a loopback origin/);
  }
});

test("sends only allowlisted toxic fields to Toxiproxy", async () => {
  const calls = [];
  const client = createToxiproxyClient({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, headers: { get: () => "application/json" }, json: async () => ({}) };
    },
  });

  await client.addToxic("forgejo", {
    name: "gernetix_test_forgejo_latency",
    type: "latency",
    stream: "downstream",
    toxicity: 1,
    attributes: { latency: 2000, jitter: 0, unsafe: true },
    arbitrary: "discarded",
  });

  assert.equal(calls[0].url, "http://127.0.0.1:8474/proxies/forgejo/toxics");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    name: "gernetix_test_forgejo_latency",
    type: "latency",
    stream: "downstream",
    toxicity: 1,
    attributes: { latency: 2000, jitter: 0 },
  });
});

test("rejects unsafe identifiers, toxic types and unbounded request timeouts", async () => {
  const client = createToxiproxyClient({ fetchImpl: async () => assert.fail("fetch must not be called") });
  await assert.rejects(
    client.addToxic("../postgres", {
      name: "cut",
      type: "latency",
      stream: "downstream",
      toxicity: 1,
      attributes: { latency: 100, jitter: 0 },
    }),
    /safe Toxiproxy identifier/,
  );
  await assert.rejects(
    client.addToxic("forgejo", {
      name: "reset_peer",
      type: "reset_peer",
      stream: "downstream",
      toxicity: 1,
      attributes: { latency: 100, jitter: 0 },
    }),
    /Only the latency toxic type/,
  );
  assert.throws(
    () => createToxiproxyClient({ fetchImpl: async () => ({}), requestTimeoutMs: 10_001 }),
    /between 100 and 10000/,
  );
});

test("treats absent toxic cleanup as idempotent but reports other failures", async () => {
  let status = 404;
  const client = createToxiproxyClient({
    fetchImpl: async () => ({ ok: false, status, headers: { get: () => "" } }),
  });
  await client.removeToxic("forgejo", "gernetix_test_forgejo_latency");
  status = 500;
  await assert.rejects(client.setProxyEnabled("forgejo", true), /HTTP 500/);
});
