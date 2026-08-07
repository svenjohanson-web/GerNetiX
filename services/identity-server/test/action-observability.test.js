"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(path.resolve(__dirname, "../public/app/action-observability.js"), "utf8");

test("carries one action id through trigger, spans and completion", async () => {
  const requests = [];
  let nextId = 1;
  const timers = new Map();
  let timerId = 0;
  const window = {
    location: { pathname: "/nachbauprojekte/nexi-sprachassistent/" },
    crypto: { randomUUID: () => `${String(nextId++).padStart(8, "0")}-0000-4000-8000-000000000000` },
    fetch: async (_url, options) => { requests.push(JSON.parse(options.body)); return { ok: true }; },
    document: { addEventListener() {} },
  };
  const context = vm.createContext({
    window, globalThis: window, module: { exports: {} },
    setTimeout(fn) { timerId += 1; timers.set(timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    Map, Date, JSON, Number, String, Promise,
  });
  vm.runInContext(source, context);

  window.GerNetiXActionOps.observeActivation({ dataset: { actionType: "nexi.flash.usb.start", actionRelease: "0.1.0-test" } });
  const action = window.GerNetiXActionOps.begin("nexi.flash.usb.start", { releaseId: "0.1.0-test" });
  await action.step("helper.status", async () => true);
  action.succeed();
  await Promise.resolve();

  assert.equal(new Set(requests.map((event) => event.action_id)).size, 1);
  assert.deepEqual(requests.map((event) => `${event.span_type}:${event.phase}`), [
    "action:triggered", "action:started", "helper.status:started", "helper.status:succeeded", "action:succeeded",
  ]);
  assert.ok(requests.find((event) => event.span_type === "helper.status").parent_span_id);
});

test("reports a visible action without a claiming handler as unhandled", async () => {
  const requests = [];
  const timers = new Map();
  let timerId = 0;
  const window = {
    location: { pathname: "/nachbauprojekte/nexi-sprachassistent/" },
    crypto: { randomUUID: () => "00000001-0000-4000-8000-000000000000" },
    fetch: async (_url, options) => { requests.push(JSON.parse(options.body)); return { ok: true }; },
    document: { addEventListener() {} },
  };
  const context = vm.createContext({
    window, globalThis: window, module: { exports: {} },
    setTimeout(fn) { timerId += 1; timers.set(timerId, fn); return timerId; },
    clearTimeout(id) { timers.delete(id); },
    Map, Date, JSON, Number, String, Promise,
  });
  vm.runInContext(source, context);

  window.GerNetiXActionOps.observeActivation({ dataset: { actionType: "nexi.flash.usb.start" } });
  timers.values().next().value();
  await Promise.resolve();

  assert.deepEqual(requests.map((event) => event.phase), ["triggered", "unhandled"]);
  assert.equal(requests[1].reason_code, "action_handler_missing");
  assert.equal(requests[0].action_id, requests[1].action_id);
});
