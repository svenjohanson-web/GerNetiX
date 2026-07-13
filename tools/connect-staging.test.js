"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseArgs, parsePort, sshTunnelArgs } = require("./connect-staging");

test("parses connect arguments on every platform", () => {
  assert.deepEqual(parseArgs(["--host", "root@example.test", "--local-port", "14600", "--dry-run"]), {
    dryRun: true,
    host: "root@example.test",
    localPort: "14600",
  });
});

test("validates TCP ports", () => {
  assert.equal(parsePort("14600", "Port"), 14600);
  assert.throws(() => parsePort("0", "Port"), /kein gueltiger/);
  assert.throws(() => parsePort("abc", "Port"), /kein gueltiger/);
});

test("builds a loopback-only SSH tunnel", () => {
  const args = sshTunnelArgs({
    host: "root@example.test",
    localPort: 14600,
    remotePort: 4600,
    platformPort: 14300,
    remotePlatformPort: 8080,
  });
  assert.deepEqual(args.slice(-3), ["-L", "14600:127.0.0.1:4600", "root@example.test"]);
  assert.ok(args.includes("14300:127.0.0.1:8080"));
  assert.ok(args.includes("ExitOnForwardFailure=yes"));
});
