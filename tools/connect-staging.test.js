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
    remoteIdentityDbHost: "10.77.0.1",
    remoteIdentityDbPort: 25432,
    buildRouterPort: 14400,
    remoteBuildRouterHost: "127.0.0.1",
    remoteBuildRouterPort: 14400,
    forgejoPort: 13300,
    remoteForgejoPort: 3300,
  });
  assert.equal(args.filter((arg) => arg === "-L").length, 5 + REMOTE_DEV_SERVICE_FORWARDS.length);
  assert.ok(args.includes("127.0.0.1:25432:10.77.0.1:25432"));
  assert.ok(args.includes("127.0.0.1:14400:127.0.0.1:14400"));
  assert.ok(args.includes("127.0.0.1:13300:127.0.0.1:3300"));
  for (const [localPort, remotePort] of REMOTE_DEV_SERVICE_FORWARDS) {
    assert.ok(args.includes(`127.0.0.1:${localPort}:127.0.0.1:${remotePort}`));
  }
  assert.equal(args.at(-1), "root@gernetix-vps");
});
