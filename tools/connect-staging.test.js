"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseArgs, sshTunnelArgs } = require("./connect-staging");

test("forwards platform and admin access only", () => {
  const args = sshTunnelArgs({
    host: "root@gernetix-vps",
    localPort: 14600,
    remotePort: 4610,
    platformPort: 14300,
    remotePlatformPort: 8080,
  });
  assert.equal(args.filter((arg) => arg === "-L").length, 2);
  assert.equal(args.at(-1), "root@gernetix-vps");
});
