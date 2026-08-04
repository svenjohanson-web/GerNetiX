"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

test("detects one Serial Helper board automatically without a user click", async () => {
  const calls = [];
  const elements = Object.fromEntries([
    "choose-port", "port-status", "flash-button", "flash-status", "serial-service-port",
    "serial-support-dialog", "serial-support-copy", "mac-serial-helper-option", "flash-title",
  ].map((id) => [id, element(id)]));
  const helper = {
    async available() { calls.push("available"); return true; },
    async ports() { calls.push("ports"); return [{ path: "/dev/cu.usbmodem-nexi", displayName: "Nexi" }]; },
    async probe(port) { calls.push(`probe:${port}`); return { chipName: "ESP32-S3", flashSize: "16MB" }; },
  };
  const context = {
    console, URL, Uint8Array,
    crypto: require("node:crypto").webcrypto,
    navigator: { platform: "MacIntel", userAgent: "Safari" },
    location: { href: "http://localhost:4300/nachbauprojekte/nexi-sprachassistent/" },
    document: { querySelector(selector) { return elements[selector.replace(/^#/, "")]; } },
    fetch: async () => ({ ok: true, async json() { return { releases: [{ version: "1.0.0", firmware_sha256: "a".repeat(64), source_commit_sha: "b".repeat(40) }] }; } }),
  };
  context.window = context;
  context.window.clearTimeout = clearTimeout;
  context.window.setTimeout = setTimeout;
  context.window.GerNetiXSerialService = { create: () => helper };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../public/nachbauprojekte/nexi-sprachassistent/nexi-flash.js"), "utf8"), context);

  await new Promise((resolve) => setTimeout(resolve, 20));

  assert.deepEqual(calls, ["available", "ports", "probe:/dev/cu.usbmodem-nexi"]);
  assert.equal(elements["flash-button"].disabled, false);
  assert.match(elements["port-status"].textContent, /ESP32-S3 erkannt/);
  assert.equal(elements["choose-port"].textContent, "USB-Gerät erneut prüfen");
  assert.match(elements["flash-status"].textContent, /kann jetzt geflasht werden/);
});

function element(id) {
  const listeners = {};
  const result = {
    id, textContent: "", disabled: false, hidden: false, value: "", attributes: new Set(),
    classList: { toggle() {} },
    addEventListener(type, listener) { listeners[type] = listener; },
    toggleAttribute(name, enabled) { if (enabled) this.attributes.add(name); else this.attributes.delete(name); },
    setAttribute(name) { this.attributes.add(name); }, removeAttribute(name) { this.attributes.delete(name); },
  };
  Object.defineProperty(result, "innerHTML", {
    set(value) { this._innerHTML = value; this.value = value.match(/value="([^"]+)"/)?.[1] || ""; },
    get() { return this._innerHTML || ""; },
  });
  return result;
}
