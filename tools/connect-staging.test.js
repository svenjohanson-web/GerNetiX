"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { parseArgs, sshTunnelArgs } = require("./connect-staging");

test("parses hardware catalog tunnel ports", () => {
  assert.deepEqual(parseArgs(["--hardware-catalog-port", "14911", "--remote-hardware-catalog-port", "4911"]), {
    dryRun: false,
    hardwareCatalogPort: "14911",
    remoteHardwareCatalogPort: "4911",
  });
});

test("forwards the hardware catalog only through a local tunnel", () => {
  const args = sshTunnelArgs({
    host: "root@gernetix-vps",
    localPort: 14600,
    remotePort: 4610,
    platformPort: 14300,
    remotePlatformPort: 8080,
    hardwareCatalogPort: 14910,
    remoteHardwareCatalogPort: 4910,
  });
  assert.ok(args.includes("14910:127.0.0.1:4910"));
  assert.equal(args.at(-1), "root@gernetix-vps");
});
