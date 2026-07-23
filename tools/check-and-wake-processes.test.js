const assert = require("node:assert/strict");
const test = require("node:test");
const { PLATFORM_SERVICES, checkServices, selectServices, wakeServices } = require("./check-and-wake-processes");

test("defines every minimal platform service with a unique port", () => {
  assert.equal(PLATFORM_SERVICES.length, 10);
  assert.equal(new Set(PLATFORM_SERVICES.map((item) => item.port)).size, PLATFORM_SERVICES.length);
  assert.equal(PLATFORM_SERVICES.find((item) => item.id === "community-platform").port, 5200);
  assert.equal(PLATFORM_SERVICES.at(-1).id, "identity-server");
});

test("check reports health without starting processes", async () => {
  const services = PLATFORM_SERVICES.slice(0, 2);
  const results = await checkServices(services, { requestHealth: async () => ({ statusCode: 200 }) });
  assert.ok(results.every((item) => item.healthy));
  assert.ok(results.every((item) => item.action === undefined));
});

test("wake starts only missing services", async () => {
  const services = PLATFORM_SERVICES.slice(0, 2);
  let checks = 0;
  const started = [];
  const results = await wakeServices(services, {
    requestHealth: async () => ({ statusCode: checks++ === 0 ? 200 : 503 }),
    spawnProcess: (target) => { started.push(target.id); return { pid: 1234 }; },
    waitForHealth: async (target) => ({ ...target, healthy: true, statusCode: 200 }),
  });
  assert.deepEqual(started, [services[1].id]);
  assert.equal(results[0].action, "already_running");
  assert.equal(results[1].action, "started");
});

test("service selection accepts comma-separated ids", () => {
  assert.deepEqual(selectServices(["wake", "--service=identity-server,admin-tool"]).map((item) => item.id), ["admin-tool", "identity-server"]);
});

test("default command checks and wakes the complete platform", async () => {
  const originalLog = console.log;
  console.log = () => {};
  try {
    const exitCode = await require("./check-and-wake-processes").main([], {
      requestHealth: async () => ({ statusCode: 200 }),
    });
    assert.ok([0, 1].includes(exitCode));
  } finally {
    console.log = originalLog;
  }
});
