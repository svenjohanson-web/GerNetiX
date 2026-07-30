"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { REMOTE_DEV_SERVICE_FORWARDS, parseArgs, sshTunnelArgs } = require("./connect-staging");

test("forwards platform, admin and loopback-only identity PostgreSQL access", () => {
  const args = sshTunnelArgs({
    host: "root@gernetix-vps",
    localPort: 14600,
    remotePort: 4610,
    platformPort: 14300,
    remotePlatformPort: 8080,
    identityDbPort: 25432,
    remoteIdentityDbPort: 25432,
  });
  assert.equal(args.filter((arg) => arg === "-L").length, 3 + REMOTE_DEV_SERVICE_FORWARDS.length);
  assert.ok(args.includes("127.0.0.1:25432:127.0.0.1:25432"));
  for (const [localPort, remotePort] of REMOTE_DEV_SERVICE_FORWARDS) {
    assert.ok(args.includes(`127.0.0.1:${localPort}:127.0.0.1:${remotePort}`));
  }
  assert.equal(args.at(-1), "root@gernetix-vps");
});
