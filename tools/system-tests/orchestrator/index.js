"use strict";

const fs = require("node:fs");
const net = require("node:net");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { loadProfile } = require("../lib/config");
const { buildRunPlan } = require("../lib/run-plan");

const SYSTEM_TEST_ROOT = path.resolve(__dirname, "..");
const REPORT_ROOT = path.join(SYSTEM_TEST_ROOT, ".runtime", "reports");
const FORWARDED_ENVIRONMENT = Object.freeze([
  "PATH", "TMPDIR", "TEMP", "TMP", "TZ", "NO_COLOR",
]);
const K6_SECRET_ENVIRONMENT = Object.freeze([
  "USERNAME", "USERNAME_TEMPLATE", "PASSWORD", "PASSWORD_TEMPLATE",
]);
const BROWSER_ENVIRONMENT = Object.freeze([
  "GERNETIX_BROWSER_SESSION_COOKIE_NAME",
  "GERNETIX_BROWSER_SESSION_COOKIE_VALUE",
  "GERNETIX_BROWSER_TIMEOUT_MS",
  "GERNETIX_BROWSER_WORKERS",
]);

async function runSystemTests(options = {}, dependencies = {}) {
  const deps = dependenciesWithDefaults(dependencies);
  const environment = options.environment || process.env;
  const profile = loadProfile(options.profile || "smoke", options.profileOptions);
  const plan = buildRunPlan(profile, {
    identityUrl: options.identityUrl,
    brokerUrl: options.brokerUrl,
  });
  const browser = options.browser === true;

  const preflight = await validatePreflight({ plan, browser, environment }, deps);
  const runId = safeRunId(options.runId || deps.makeRunId());
  const reportDirectory = path.join(REPORT_ROOT, runId);
  deps.mkdirSync(reportDirectory, { recursive: true, mode: 0o700 });

  const controller = createProcessController(deps);
  const removeSignalHandlers = installSignalHandlers(controller, deps.processObject);
  let loadResults;
  let browserResult = null;
  try {
    const api = processSpec({
      name: "k6",
      executable: preflight.k6Executable,
      arguments: absoluteRepositoryScript(plan.api.arguments),
      environment: childEnvironment(environment, {
        ...plan.api.environment,
        SUMMARY_PATH: path.join(reportDirectory, "k6-summary.json"),
      }, K6_SECRET_ENVIRONMENT),
      stdoutFile: path.join(reportDirectory, "k6.stdout.log"),
      stderrFile: path.join(reportDirectory, "k6.stderr.log"),
    });
    const devices = processSpec({
      name: "devices",
      executable: preflight.nodeExecutable,
      arguments: absoluteRepositoryScript(plan.devices.arguments),
      environment: childEnvironment(environment),
      stdoutFile: path.join(reportDirectory, "devices.json"),
      stderrFile: path.join(reportDirectory, "devices.stderr.log"),
    });

    loadResults = await controller.runParallel([api, devices]);
    if (controller.wasInterrupted()) throw new Error("System-test run was interrupted");
    assertSuccessful(loadResults, "parallel load phase");

    if (browser) {
      browserResult = await controller.runOne(processSpec({
        name: "browser",
        executable: preflight.nodeExecutable,
        arguments: [path.join(SYSTEM_TEST_ROOT, "browser", "run-browser-flow.js")],
        environment: childEnvironment(environment, {
          GERNETIX_BROWSER_BASE_URL: preflight.identityUrl,
        }, BROWSER_ENVIRONMENT),
        stdoutFile: path.join(reportDirectory, "browser.json"),
        stderrFile: path.join(reportDirectory, "browser.stderr.log"),
      }));
      assertSuccessful([browserResult], "browser phase");
    }
  } finally {
    removeSignalHandlers();
    await controller.stopAll();
  }

  const result = Object.freeze({
    schema_version: 1,
    profile: profile.profile,
    safety_scope: "isolated-local",
    chaos_activated: false,
    report_directory: reportDirectory,
    phases: {
      parallel_load: loadResults.map(publicProcessResult),
      browser: browserResult ? publicProcessResult(browserResult) : null,
    },
  });
  deps.writeFileSync(path.join(reportDirectory, "run.json"), `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
  return result;
}

async function validatePreflight({ plan, browser, environment }, deps) {
  if (plan.safety_scope !== "isolated-local" || plan.infrastructure.starts_automatically !== false) {
    throw new Error("Refusing an execution plan outside the isolated-local safety scope");
  }
  if (plan.chaos.automatic_activation !== false) {
    throw new Error("Refusing a plan that automatically activates chaos");
  }
  if (truthy(environment.ALLOW_REMOTE_TARGET)) {
    throw new Error("ALLOW_REMOTE_TARGET is forbidden for orchestrated system tests");
  }

  const identity = safeHttpUrl(plan.api.environment.BASE_URL);
  const broker = safeBrokerUrl(findArgument(plan.devices.arguments, "--broker-url"));
  requireCredentialPair(environment, K6_SECRET_ENVIRONMENT.slice(0, 2), K6_SECRET_ENVIRONMENT.slice(2));
  if (browser) requireBrowserEnvironment(environment);

  const nodeExecutable = deps.nodeExecutable;
  const k6Executable = plan.api.executable;
  if (!deps.executableAvailable(nodeExecutable, ["--version"])) throw new Error(`Required executable is unavailable: ${nodeExecutable}`);
  if (!deps.executableAvailable(k6Executable, ["version"])) throw new Error(`Required executable is unavailable: ${k6Executable}`);
  if (browser && !deps.moduleAvailable("playwright", path.join(SYSTEM_TEST_ROOT, "browser"))) {
    throw new Error("Required browser dependency is unavailable: playwright");
  }

  await Promise.all([
    deps.endpointAvailable(identity),
    deps.endpointAvailable(broker),
  ]);
  return {
    identityUrl: identity.toString().replace(/\/$/, ""),
    nodeExecutable,
    k6Executable,
  };
}

function createProcessController(deps) {
  const active = new Set();
  let stopping = false;
  let interrupted = false;

  async function runParallel(specs) {
    const running = [];
    try {
      for (const spec of specs) running.push(start(spec));
    } catch (error) {
      await stopAll();
      throw error;
    }
    for (const entry of running) {
      entry.completion.then(
        (result) => { if (!result.ok) void stopAll(); },
        () => { void stopAll(); },
      );
    }
    const results = await Promise.all(running.map((entry) => entry.completion));
    return results;
  }

  async function runOne(spec) {
    return start(spec).completion;
  }

  function start(spec) {
    const stdout = deps.createWriteStream(spec.stdoutFile, { flags: "wx", mode: 0o600 });
    const stderr = deps.createWriteStream(spec.stderrFile, { flags: "wx", mode: 0o600 });
    let child;
    try {
      child = deps.spawn(spec.executable, spec.arguments, {
        cwd: SYSTEM_TEST_ROOT,
        env: spec.environment,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      stdout.destroy();
      stderr.destroy();
      throw new Error(`Could not start ${spec.name}: ${error.message}`);
    }

    const entry = { child, name: spec.name, stdout, stderr };
    active.add(entry);
    child.stdout?.pipe(stdout, { end: false });
    child.stderr?.pipe(stderr, { end: false });
    entry.completion = new Promise((resolve, reject) => {
      child.once("error", (error) => {
        active.delete(entry);
        stdout.end();
        stderr.end();
        reject(new Error(`${spec.name} process failed to start: ${error.message}`));
      });
      child.once("close", (code, signal) => {
        active.delete(entry);
        stdout.end();
        stderr.end();
        resolve(Object.freeze({ name: spec.name, ok: code === 0, exitCode: code, signal: signal || null }));
      });
    });
    return entry;
  }

  async function stopAll(signal = "SIGTERM") {
    if (stopping || active.size === 0) return;
    stopping = true;
    const entries = [...active];
    for (const entry of entries) {
      entry.child.kill(signal);
    }
    await deps.delay(deps.shutdownGraceMs);
    for (const entry of entries) {
      if (active.has(entry)) entry.child.kill("SIGKILL");
    }
    stopping = false;
  }

  function interrupt(signal) {
    interrupted = true;
    return stopAll(signal);
  }

  return { interrupt, runOne, runParallel, stopAll, wasInterrupted: () => interrupted };
}

function installSignalHandlers(controller, processObject) {
  const handlers = new Map();
  for (const signal of ["SIGINT", "SIGTERM"]) {
    const handler = () => { void controller.interrupt(signal); };
    handlers.set(signal, handler);
    processObject.once(signal, handler);
  }
  return () => {
    for (const [signal, handler] of handlers) processObject.removeListener(signal, handler);
  };
}

function dependenciesWithDefaults(overrides) {
  return {
    spawn,
    nodeExecutable: process.execPath,
    processObject: process,
    mkdirSync: fs.mkdirSync,
    writeFileSync: fs.writeFileSync,
    createWriteStream: fs.createWriteStream,
    executableAvailable: defaultExecutableAvailable,
    moduleAvailable: defaultModuleAvailable,
    endpointAvailable: defaultEndpointAvailable,
    delay: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
    shutdownGraceMs: 5_000,
    makeRunId: () => `${new Date().toISOString().replace(/[:.]/g, "-")}-${process.pid}`,
    ...overrides,
  };
}

function defaultExecutableAvailable(executable, argumentsList) {
  const result = spawnSync(executable, argumentsList, { stdio: "ignore", shell: false });
  return !result.error && result.status === 0;
}

function defaultModuleAvailable(moduleName, baseDirectory) {
  try {
    require.resolve(moduleName, { paths: [baseDirectory] });
    return true;
  } catch {
    return false;
  }
}

function defaultEndpointAvailable(url, timeoutMs = 2_000) {
  const port = Number(url.port || ({ "http:": 80, "https:": 443, "mqtt:": 1883 }[url.protocol]));
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host: normalizedHostname(url.hostname), port });
    const fail = (error) => {
      socket.destroy();
      reject(new Error(`Required loopback service is unavailable at ${url.origin}: ${error.message}`));
    };
    socket.setTimeout(timeoutMs, () => fail(new Error("connection timed out")));
    socket.once("error", fail);
    socket.once("connect", () => { socket.destroy(); resolve(); });
  });
}

function childEnvironment(source, additions = {}, forwardedSecrets = []) {
  const result = {};
  for (const name of FORWARDED_ENVIRONMENT) if (source[name] !== undefined) result[name] = String(source[name]);
  for (const name of forwardedSecrets) if (source[name] !== undefined) result[name] = String(source[name]);
  for (const [name, value] of Object.entries(additions)) result[name] = String(value);
  return result;
}

function absoluteRepositoryScript(argumentsList) {
  const repositoryRoot = path.resolve(SYSTEM_TEST_ROOT, "..", "..");
  return argumentsList.map((argument) => String(argument).startsWith("tools/system-tests/")
    ? path.resolve(repositoryRoot, argument)
    : argument);
}

function safeHttpUrl(value) {
  const url = new URL(value);
  if (!new Set(["http:", "https:"]).has(url.protocol)) throw new Error("Identity target must use HTTP or HTTPS");
  assertLoopback(url, "identity");
  if (url.username || url.password || url.search || url.hash) throw new Error("Identity target must not contain credentials, query, or fragment");
  if (url.port !== "14300") throw new Error("Identity target must use dedicated system-test port 14300");
  return url;
}

function safeBrokerUrl(value) {
  const url = new URL(value);
  if (url.protocol !== "mqtt:") throw new Error("Orchestrated broker target must use mqtt://");
  assertLoopback(url, "broker");
  if (url.username || url.password || (url.pathname && url.pathname !== "/")) throw new Error("Broker target must not contain credentials or a path");
  if (url.port !== "51883") throw new Error("Broker target must use dedicated system-test port 51883");
  return url;
}

function assertLoopback(url, label) {
  if (!new Set(["127.0.0.1", "localhost", "::1", "[::1]"]).has(url.hostname)) {
    throw new Error(`Refusing non-loopback ${label} target: ${url.hostname}`);
  }
}

function requireCredentialPair(environment, usernames, passwords) {
  if (!usernames.some((name) => nonEmpty(environment[name]))) throw new Error("USERNAME or USERNAME_TEMPLATE is required");
  if (!passwords.some((name) => nonEmpty(environment[name]))) throw new Error("PASSWORD or PASSWORD_TEMPLATE is required");
}

function requireBrowserEnvironment(environment) {
  for (const name of BROWSER_ENVIRONMENT.slice(0, 2)) {
    if (!nonEmpty(environment[name])) throw new Error(`${name} is required when --browser is enabled`);
  }
}

function findArgument(argumentsList, flag) {
  const index = argumentsList.indexOf(flag);
  if (index < 0 || !argumentsList[index + 1]) throw new Error(`Execution plan is missing ${flag}`);
  return argumentsList[index + 1];
}

function assertSuccessful(results, phase) {
  const failed = results.find((result) => !result.ok);
  if (failed) throw new Error(`${phase} failed: ${failed.name} exited with ${failed.exitCode ?? failed.signal}`);
}

function processSpec(spec) {
  return Object.freeze(spec);
}

function publicProcessResult(result) {
  return { name: result.name, ok: result.ok, exit_code: result.exitCode, signal: result.signal };
}

function nonEmpty(value) {
  return typeof value === "string" && value.length > 0;
}

function truthy(value) {
  return value === true || value === "true" || value === "1";
}

function safeRunId(value) {
  const id = String(value);
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(id)) throw new Error("Invalid report run id");
  return id;
}

function normalizedHostname(hostname) {
  return hostname === "[::1]" ? "::1" : hostname;
}

module.exports = {
  BROWSER_ENVIRONMENT,
  K6_SECRET_ENVIRONMENT,
  REPORT_ROOT,
  childEnvironment,
  createProcessController,
  runSystemTests,
  safeBrokerUrl,
  safeHttpUrl,
  validatePreflight,
};
