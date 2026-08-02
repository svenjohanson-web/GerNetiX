"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const clientSource = fs.readFileSync(path.resolve(__dirname, "../public/app/serial-service-client.js"), "utf8");

test("renews an invalid local serial session and retries the request once", async () => {
  const requests = [];
  let issuedSessions = 0;
  const window = { location: { protocol: "https:" } };
  const context = vm.createContext({
    window,
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
  const context = vm.createContext({ window, Uint8Array, btoa, crypto, setTimeout, fetch: async () => jsonResponse(500, {}) });
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

test("blocks USB flashing when the helper cannot verify the written flash", async () => {
  let flashRequests = 0;
  const window = { location: { protocol: "https:" } };
  const context = vm.createContext({
    window,
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
    window.GerNetiXSerialService.create().flash({
      port: "/dev/cu.usbmodem1",
      files: [{ name: "firmware.bin", address: 0x20000, data: new Uint8Array([1, 2, 3]) }],
    }),
    (error) => error.code === "serial_service_update_required" && /0\.3\.10/.test(error.message),
  );
  assert.equal(flashRequests, 0);
});

test("compares helper versions numerically", () => {
  const window = { location: { protocol: "https:" } };
  const context = vm.createContext({ window, Uint8Array, btoa, crypto, setTimeout, fetch: async () => jsonResponse(500, {}) });
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
