"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  ALLOWED_SCENARIOS,
  FORGEJO_LATENCY_TOXIC,
  MAX_DURATION_MS,
  runScenario,
  validateDuration,
} = require("../scenarios");

function recordingClient(options = {}) {
  const calls = [];
  return {
    calls,
    client: {
      async addToxic(proxy, toxic) {
        calls.push(["addToxic", proxy, toxic]);
        if (options.failActivation) throw new Error("activation failed");
      },
      async removeToxic(proxy, toxic) {
        calls.push(["removeToxic", proxy, toxic]);
        if (options.failRecovery) throw new Error("recovery failed");
      },
      async setProxyEnabled(proxy, enabled) {
        calls.push(["setProxyEnabled", proxy, enabled]);
        if (!enabled && options.failActivation) throw new Error("activation failed");
        if (enabled && options.failRecovery) throw new Error("recovery failed");
      },
    },
  };
}

test("exposes exactly the four allowlisted scenarios", () => {
  assert.deepEqual(ALLOWED_SCENARIOS, [
    "forgejo_latency",
    "forgejo_unavailable",
    "postgres_connection_cut",
    "mqtt_connection_cut",
  ]);
  assert.throws(() => validateDuration(99), /between 100 and 60000/);
  assert.throws(() => validateDuration(MAX_DURATION_MS + 1), /between 100 and 60000/);
});

test("applies and removes the fixed Forgejo latency toxic", async () => {
  const recorder = recordingClient();
  const waits = [];
  const result = await runScenario({
    client: recorder.client,
    scenario: "forgejo_latency",
    durationMs: 250,
    wait: async (duration) => waits.push(duration),
  });

  assert.deepEqual(waits, [250]);
  assert.equal(recorder.calls[0][0], "addToxic");
  assert.equal(recorder.calls[0][1], "forgejo");
  assert.deepEqual(recorder.calls[0][2], {
    name: FORGEJO_LATENCY_TOXIC,
    type: "latency",
    stream: "downstream",
    toxicity: 1,
    attributes: { latency: 2000, jitter: 0 },
  });
  assert.deepEqual(recorder.calls[1], ["removeToxic", "forgejo", FORGEJO_LATENCY_TOXIC]);
  assert.deepEqual(result, { scenario: "forgejo_latency", duration_ms: 250, recovered: true });
});

test("maps connection cuts only to their fixed proxy and always recovers", async () => {
  const expectedProxy = {
    forgejo_unavailable: "forgejo",
    postgres_connection_cut: "postgres",
    mqtt_connection_cut: "mqtt",
  };
  for (const [scenario, proxy] of Object.entries(expectedProxy)) {
    const recorder = recordingClient();
    await runScenario({ client: recorder.client, scenario, durationMs: 100, wait: async () => {} });
    assert.deepEqual(recorder.calls, [
      ["setProxyEnabled", proxy, false],
      ["setProxyEnabled", proxy, true],
    ]);
  }
});

test("runs recovery in finally after activation or wait failures", async () => {
  const activationFailure = recordingClient({ failActivation: true });
  await assert.rejects(
    runScenario({ client: activationFailure.client, scenario: "postgres_connection_cut", durationMs: 100, wait: async () => {} }),
    /activation failed/,
  );
  assert.deepEqual(activationFailure.calls.at(-1), ["setProxyEnabled", "postgres", true]);

  const waitFailure = recordingClient();
  await assert.rejects(
    runScenario({
      client: waitFailure.client,
      scenario: "forgejo_latency",
      durationMs: 100,
      wait: async () => { throw new Error("wait failed"); },
    }),
    /wait failed/,
  );
  assert.deepEqual(waitFailure.calls.at(-1), ["removeToxic", "forgejo", FORGEJO_LATENCY_TOXIC]);
});

test("preserves both the scenario and recovery failure", async () => {
  const recorder = recordingClient({ failActivation: true, failRecovery: true });
  await assert.rejects(
    runScenario({ client: recorder.client, scenario: "mqtt_connection_cut", durationMs: 100, wait: async () => {} }),
    (error) => error instanceof AggregateError && error.errors.length === 2,
  );
});

test("rejects undeclared scenarios before touching the client", async () => {
  const recorder = recordingClient();
  await assert.rejects(
    runScenario({ client: recorder.client, scenario: "delete_volumes", durationMs: 100, wait: async () => {} }),
    /Unknown chaos scenario/,
  );
  assert.deepEqual(recorder.calls, []);
});
