"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { readForSandbox } = require("../test-support/platform-app-source");
const vm = require("node:vm");

const clientSource = readForSandbox("serial-service-client.js");

test("uses TLS for both localhost helper addresses", async () => {
  const requests = [];
  const window = { location: { protocol: "http:" } };
  const context = vm.createContext({
    window,
    AbortController,
    clearTimeout,
    Uint8Array,
    btoa,
    crypto,
    setTimeout,
    fetch: async (url) => {
      requests.push(url);
      if (url.startsWith("https://127.0.0.1:43123")) return jsonResponse(200, { version: "0.3.10" });
      throw new TypeError("connection failed");
    },
  });
  vm.runInContext(clientSource, context);

  const status = await window.GerNetiXSerialService.create().status();

  assert.equal(status.version, "0.3.10");
  assert.deepEqual(requests, [
    "https://localhost:43123/v1/status",
    "https://127.0.0.1:43123/v1/status",
  ]);
});

test("renews an invalid local serial session and retries the request once", async () => {
  const requests = [];
  let issuedSessions = 0;
  const window = { location: { protocol: "https:" } };
  const context = vm.createContext({
    window,
    AbortController,
    clearTimeout,
    Uint8Array,
    btoa,
    crypto,
    setTimeout,
    fetch: async (url, init) => {
      requests.push({ url, session: init.headers["X-GerNetiX-Serial-Session"] || "" });
      if (url.endsWith("/v1/status")) return jsonResponse(200, { service: "gernetix-serial-service" });
      if (url.endsWith("/v1/sessions")) {
        issuedSessions += 1;
        return jsonResponse(201, { token: issuedSessions === 1 ? "expired-token" : "fresh-token" });
      }
      if (url.endsWith("/v1/ports") && init.headers["X-GerNetiX-Serial-Session"] === "expired-token") {
        return jsonResponse(401, { error: "serial_session_invalid" });
      }
      if (url.endsWith("/v1/ports") && init.headers["X-GerNetiX-Serial-Session"] === "fresh-token") {
        return jsonResponse(200, { items: [{ path: "/dev/cu.usbmodem1" }] });
      }
      return jsonResponse(500, { error: "unexpected_request" });
    },
  });
  vm.runInContext(clientSource, context);

  const ports = await window.GerNetiXSerialService.create().ports();

  assert.equal(ports.length, 1);
  assert.equal(issuedSessions, 2);
  assert.deepEqual(requests.filter((request) => request.url.endsWith("/v1/ports")).map((request) => request.session), [
    "expired-token",
    "fresh-token",
  ]);
});

test("does not retry an invalid serial session indefinitely", async () => {
  let portRequests = 0;
  let issuedSessions = 0;
  const window = { location: { protocol: "https:" } };
  const context = vm.createContext({
    window,
    AbortController,
    clearTimeout,
    Uint8Array,
    btoa,
    crypto,
    setTimeout,
    fetch: async (url) => {
      if (url.endsWith("/v1/status")) return jsonResponse(200, {});
      if (url.endsWith("/v1/sessions")) {
        issuedSessions += 1;
        return jsonResponse(201, { token: `invalid-token-${issuedSessions}` });
      }
      portRequests += 1;
      return jsonResponse(401, { error: "serial_session_invalid" });
    },
  });
  vm.runInContext(clientSource, context);

  await assert.rejects(
    window.GerNetiXSerialService.create().ports(),
    (error) => error.code === "serial_session_invalid" && error.status === 401,
  );
  assert.equal(issuedSessions, 2);
  assert.equal(portRequests, 2);
});

test("treats macOS tty and cu paths as one device and prefers cu", () => {
  const window = { location: { protocol: "https:" } };
  const context = vm.createContext({ window, AbortController, clearTimeout, Uint8Array, btoa, crypto, setTimeout, fetch: async () => jsonResponse(500, {}) });
  vm.runInContext(clientSource, context);

  const ports = window.GerNetiXSerialService.preferredPorts([
    { path: "/dev/tty.usbmodem101", label: "TTY" },
    { path: "/dev/cu.usbmodem101", label: "CU" },
    { path: "/dev/cu.usbserial-210", label: "zweites Gerät" },
  ]);

  assert.equal(ports.length, 2);
  assert.equal(ports[0].path, "/dev/cu.usbmodem101");
  assert.equal(ports[1].path, "/dev/cu.usbserial-210");
});

test("passes a bounded board-operation timeout to the local serial service", async () => {
  let requestBody = null;
  const window = { location: { protocol: "https:" } };
  const context = vm.createContext({
    window,
    AbortController,
    clearTimeout,
    Uint8Array,
    btoa,
    crypto,
    setTimeout,
    fetch: async (url, init) => {
      if (url.endsWith("/v1/status")) return jsonResponse(200, {});
      if (url.endsWith("/v1/sessions")) return jsonResponse(201, { token: "session" });
      if (url.endsWith("/v1/serial/requests")) {
        requestBody = JSON.parse(init.body);
        return jsonResponse(200, { event: "nexi_voice_test", payload: { detected: true } });
      }
      return jsonResponse(500, { error: "unexpected_request" });
    },
  });
  vm.runInContext(clientSource, context);

  await window.GerNetiXSerialService.create().serialRequest(
    "/dev/cu.usbmodem1", "nexi_voice_test", {}, { timeoutMs: 30000 });

  assert.equal(requestBody.timeoutMs, 30000);
  assert.equal(requestBody.request.action, "nexi_voice_test");
});

test("blocks USB flashing when the helper cannot verify the written flash", async () => {
  let flashRequests = 0;
  const window = { location: { protocol: "https:" } };
  const context = vm.createContext({
    window,
    AbortController,
    clearTimeout,
    Uint8Array,
    btoa,
    crypto,
    setTimeout,
    fetch: async (url) => {
      if (url.endsWith("/v1/status")) return jsonResponse(200, { version: "0.3.9" });
      if (url.endsWith("/v1/flash-jobs")) flashRequests += 1;
      return jsonResponse(500, { error: "unexpected_request" });
    },
  });
  vm.runInContext(clientSource, context);

  await assert.rejects(
    window.GerNetiXSerialService.create({ updateFlow: false }).flash({
      port: "/dev/cu.usbmodem1",
      files: [{ name: "firmware.bin", address: 0x20000, data: new Uint8Array([1, 2, 3]) }],
    }),
    (error) => error.code === "serial_service_update_required" && /0\.3\.10/.test(error.message),
  );
  assert.equal(flashRequests, 0);
});

test("continues USB flashing after an explicitly approved helper update", async () => {
  let statusRequests = 0;
  let flashRequests = 0;
  let updateDetails = null;
  let flashRequestBody = null;
  const window = { location: { protocol: "https:" } };
  const context = vm.createContext({
    window,
    AbortController,
    clearTimeout,
    Uint8Array,
    btoa,
    crypto,
    setTimeout,
    fetch: async (url, init = {}) => {
      if (url.endsWith("/v1/status")) {
        statusRequests += 1;
        return jsonResponse(200, { version: statusRequests === 1 ? "0.3.9" : "0.3.10" });
      }
      if (url.endsWith("/v1/sessions")) return jsonResponse(201, { token: "session" });
      if (url.endsWith("/v1/flash-jobs")) {
        flashRequests += 1;
        flashRequestBody = JSON.parse(init.body);
        return jsonResponse(202, { id: "flash-1", status: "succeeded" });
      }
      return jsonResponse(500, { error: "unexpected_request" });
    },
  });
  vm.runInContext(clientSource, context);

  const result = await window.GerNetiXSerialService.create({
    async updateFlow(details) { updateDetails = details; },
  }).flash({
    actionId: "12345678-1234-4234-8234-123456789abc",
    port: "/dev/cu.usbmodem1",
    files: [{ name: "firmware.bin", address: 0x20000, data: new Uint8Array([1, 2, 3]) }],
  });

  assert.equal(updateDetails.installedVersion, "0.3.9");
  assert.equal(updateDetails.requiredVersion, "0.3.10");
  assert.equal(result.status, "succeeded");
  assert.equal(flashRequests, 1);
  assert.equal(flashRequestBody.actionId, "12345678-1234-4234-8234-123456789abc");
});

test("downloads the approved platform package and waits for the required helper version", async () => {
  let clickedDownload = null;
  let revokedDownload = null;
  const progress = [];
  const body = { append() {} };
  const window = {
    location: { protocol: "https:" },
    navigator: { platform: "MacIntel" },
    confirm: () => true,
    Blob,
    URL: {
      createObjectURL: () => "blob:helper-update",
      revokeObjectURL: (url) => { revokedDownload = url; },
    },
    setTimeout: (callback) => { callback(); return 1; },
    document: {
      body,
      createElement() {
        return {
          href: "", download: "", hidden: false,
          click() { clickedDownload = { href: this.href, download: this.download }; },
          remove() {},
        };
      },
    },
  };
  const context = vm.createContext({
    window,
    AbortController,
    clearTimeout,
    Uint8Array,
    btoa,
    crypto,
    setTimeout: (callback) => { callback(); return 1; },
    fetch: async (url) => {
      if (url === "/api/platform/downloads") return jsonResponse(200, { downloads: [{
          platform: "macos", available: true, version: "0.3.10", size_bytes: 4,
          file_name: "GerNetiX-Serial-Service-0.3.10-mac-arm64.pkg",
          url: "/downloads/usb-serial-helper/GerNetiX-Serial-Service-0.3.10-mac-arm64.pkg",
        }] });
      assert.equal(url, "/downloads/usb-serial-helper/GerNetiX-Serial-Service-0.3.10-mac-arm64.pkg");
      const chunks = [new Uint8Array([1, 2]), new Uint8Array([3, 4])];
      return {
        status: 200,
        ok: true,
        headers: { get: (name) => name === "content-length" ? "4" : null },
        body: { getReader: () => ({ async read() { return chunks.length ? { done: false, value: chunks.shift() } : { done: true }; } }) },
      };
    },
  });
  vm.runInContext(clientSource, context);

  await window.GerNetiXSerialService.requestBrowserUpdate({
    installedVersion: "0.3.9",
    requiredVersion: "0.3.10",
    onProgress: (message) => progress.push(message),
    readStatus: async () => ({ version: "0.3.10" }),
  });

  assert.deepEqual(clickedDownload, {
    href: "blob:helper-update",
    download: "GerNetiX-Serial-Service-0.3.10-mac-arm64.pkg",
  });
  assert.equal(revokedDownload, "blob:helper-update");
  assert.deepEqual(progress.map((entry) => entry.phase), ["preparing", "download", "download", "install", "ready"]);
  assert.deepEqual(progress.map((entry) => entry.percent), [5, 40, 75, 80, 100]);
});

test("compares helper versions numerically", () => {
  const window = { location: { protocol: "https:" } };
  const context = vm.createContext({ window, AbortController, clearTimeout, Uint8Array, btoa, crypto, setTimeout, fetch: async () => jsonResponse(500, {}) });
  vm.runInContext(clientSource, context);

  assert.equal(window.GerNetiXSerialService.compareVersions("0.3.10", "0.3.10"), 0);
  assert.equal(window.GerNetiXSerialService.compareVersions("0.3.11", "0.3.10") > 0, true);
  assert.equal(window.GerNetiXSerialService.compareVersions("0.3.9", "0.3.10") < 0, true);
});

function jsonResponse(status, payload) {
  return {
    status,
    ok: status >= 200 && status < 300,
    async json() { return payload; },
  };
}
