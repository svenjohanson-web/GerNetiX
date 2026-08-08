"use strict";

const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { PassThrough } = require("node:stream");
const test = require("node:test");
const { parseArgs } = require("../cli");
const { runSystemTests, safeBrokerUrl, safeHttpUrl } = require("..");

test("CLI exposes execution inputs but no infrastructure or chaos switch", () => {
  assert.deepEqual(parseArgs(["--profile", "smoke", "--identity-url", "http://127.0.0.1:14300", "--browser"]), {
    browser: true,
    profile: "smoke",
    identityUrl: "http://127.0.0.1:14300",
  });
  assert.throws(() => parseArgs(["--start-infrastructure"]), /Invalid argument/);
  assert.throws(() => parseArgs(["--activate-chaos"]), /Invalid argument/);
});

test("target validation rejects remote, credential-bearing, and unsupported targets", () => {
  assert.equal(safeHttpUrl("http://127.0.0.1:14300").hostname, "127.0.0.1");
  assert.equal(safeBrokerUrl("mqtt://localhost:51883").hostname, "localhost");
  assert.throws(() => safeHttpUrl("https://staging.example.test"), /non-loopback/);
  assert.throws(() => safeHttpUrl("ftp://127.0.0.1:4300"), /HTTP or HTTPS/);
  assert.throws(() => safeBrokerUrl("mqtt://user:secret@127.0.0.1:51883"), /credentials/);
  assert.throws(() => safeHttpUrl("http://127.0.0.1:4300"), /dedicated system-test port/);
  assert.throws(() => safeBrokerUrl("mqtt://127.0.0.1:1883"), /dedicated system-test port/);
  assert.throws(() => safeBrokerUrl("mqtts://127.0.0.1:8883"), /mqtt:\/\//);
});

test("fails closed before spawning when credentials, binaries, or endpoints are missing", async () => {
  for (const fixture of [
    { environment: {}, executableAvailable: () => true, endpointAvailable: async () => {} },
    { environment: credentials(), executableAvailable: () => false, endpointAvailable: async () => {} },
    { environment: credentials(), executableAvailable: () => true, endpointAvailable: async () => { throw new Error("offline"); } },
  ]) {
    let spawnCount = 0;
    await assert.rejects(() => runSystemTests({ profile: "smoke", environment: fixture.environment }, mockDependencies({
      spawn: () => { spawnCount += 1; },
      executableAvailable: fixture.executableAvailable,
      endpointAvailable: fixture.endpointAvailable,
    })));
    assert.equal(spawnCount, 0);
  }
});

test("runs k6 and devices together, then the optional browser, without forwarding unrelated environment", async () => {
  const calls = [];
  let closeFirstWave;
  const firstWaveReady = new Promise((resolve) => { closeFirstWave = resolve; });
  const children = [];
  const deps = mockDependencies({
    spawn(executable, args, options) {
      const child = fakeChild();
      calls.push({ executable, args, options });
      children.push(child);
      if (children.length === 2) closeFirstWave();
      else if (children.length === 3) queueMicrotask(() => child.close(0));
      return child;
    },
  });
  const running = runSystemTests({
    profile: "smoke",
    browser: true,
    runId: "contract-run",
    environment: {
      ...credentials(),
      PATH: "/test/bin",
      STAGING_DATABASE_URL: "must-not-leak",
      GERNETIX_BROWSER_SESSION_COOKIE_NAME: "test_session",
      GERNETIX_BROWSER_SESSION_COOKIE_VALUE: "secret-cookie",
    },
  }, deps);

  await firstWaveReady;
  assert.equal(calls.length, 2, "k6 and devices start before either one completes");
  assert.equal(calls[0].args[1].endsWith("/tools/system-tests/k6/scenario.js"), true);
  assert.equal(calls[1].args[0].endsWith("/tools/system-tests/devices/src/cli.js"), true);
  children[0].close(0);
  children[1].close(0);
  const result = await running;

  assert.equal(calls.length, 3, "browser starts after the parallel phase");
  assert.equal(calls[0].options.shell, false);
  assert.equal(calls[0].options.env.STAGING_DATABASE_URL, undefined);
  assert.equal(calls[1].options.env.PASSWORD_TEMPLATE, undefined);
  assert.equal(calls[2].options.env.GERNETIX_BROWSER_SESSION_COOKIE_VALUE, "secret-cookie");
  assert.equal(result.chaos_activated, false);
  assert.equal(result.phases.parallel_load.every((entry) => entry.ok), true);
  assert.equal(deps.writes.some(([file]) => file.endsWith("run.json")), true);
});

test("forwards termination and does not start the browser after a failed load phase", async () => {
  const calls = [];
  const children = [];
  const deps = mockDependencies({
    spawn() {
      const child = fakeChild();
      calls.push("spawn");
      children.push(child);
      return child;
    },
  });
  const running = runSystemTests({ profile: "smoke", browser: true, environment: {
    ...credentials(),
    GERNETIX_BROWSER_SESSION_COOKIE_NAME: "session",
    GERNETIX_BROWSER_SESSION_COOKIE_VALUE: "cookie",
  } }, deps);
  await new Promise((resolve) => setImmediate(resolve));
  children[0].close(2);
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual(children[1].signals, ["SIGTERM", "SIGKILL"]);
  children[1].close(0);
  await assert.rejects(running, /parallel load phase failed/);
  assert.equal(calls.length, 2);
});

test("an external signal aborts the run even when children shut down cleanly", async () => {
  const children = [];
  const deps = mockDependencies({
    spawn() {
      const child = fakeChild();
      children.push(child);
      return child;
    },
  });
  const running = runSystemTests({ profile: "smoke", browser: true, environment: {
    ...credentials(),
    GERNETIX_BROWSER_SESSION_COOKIE_NAME: "session",
    GERNETIX_BROWSER_SESSION_COOKIE_VALUE: "cookie",
  } }, deps);
  await new Promise((resolve) => setImmediate(resolve));
  deps.processObject.emit("SIGINT");
  await new Promise((resolve) => setImmediate(resolve));
  children[0].close(0);
  children[1].close(0);
  await assert.rejects(running, /was interrupted/);
  assert.equal(children.length, 2, "browser must not start after interruption");
  assert.equal(children.every((child) => child.signals.includes("SIGINT")), true);
});

function credentials() {
  return { USERNAME_TEMPLATE: "user-{vu}", PASSWORD_TEMPLATE: "pw-{vu}" };
}

function fakeChild() {
  const child = new EventEmitter();
  child.stdout = new PassThrough();
  child.stderr = new PassThrough();
  child.killed = false;
  child.signals = [];
  child.kill = (signal) => { child.killed = true; child.signal = signal; child.signals.push(signal); return true; };
  child.close = (code, signal = null) => queueMicrotask(() => child.emit("close", code, signal));
  return child;
}

function mockDependencies(overrides = {}) {
  const writes = [];
  return {
    nodeExecutable: "/mock/node",
    processObject: new EventEmitter(),
    executableAvailable: () => true,
    moduleAvailable: () => true,
    endpointAvailable: async () => {},
    mkdirSync: () => {},
    writeFileSync: (...args) => writes.push(args),
    createWriteStream: () => new PassThrough(),
    delay: async () => {},
    shutdownGraceMs: 0,
    makeRunId: () => "mock-run",
    writes,
    ...overrides,
  };
}
