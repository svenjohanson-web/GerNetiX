"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertSafeGitRef,
  assertSafeSshTarget,
  parseArgs,
  parseEnvFile,
  remoteDeployCommand,
  shellQuote,
} = require("./staging-deploy");

test("parses cross-platform staging config", () => {
  assert.deepEqual(parseEnvFile("# local\nGERNETIX_STAGING_SSH=root@example.test\r\nVALUE='hello world'\n"), {
    GERNETIX_STAGING_SSH: "root@example.test",
    VALUE: "hello world",
  });
});

test("parses deploy arguments", () => {
  assert.deepEqual(parseArgs(["--dry-run", "--host", "deploy@example.test", "--branch", "agent/test"]), {
    dryRun: true,
    host: "deploy@example.test",
    branch: "agent/test",
  });
});

test("rejects unsafe refs and ssh targets", () => {
  assert.throws(() => assertSafeGitRef("main; reboot"), /Unsicherer/);
  assert.throws(() => assertSafeGitRef("../main"), /Unsicherer/);
  assert.throws(() => assertSafeSshTarget("root@example.test -o ProxyCommand=x"), /Ungueltiges/);
});

test("quotes remote values and deploys an exact commit", () => {
  assert.equal(shellQuote("/opt/gernetix"), "'/opt/gernetix'");
  const command = remoteDeployCommand({
    branch: "agent/staging",
    commit: "0123456789abcdef",
    remoteDir: "/opt/gernetix",
  });
  assert.match(command, /git fetch origin 'agent\/staging'/);
  assert.match(command, /git switch --detach '0123456789abcdef'/);
  assert.match(command, /remote-deploy\.sh/);
});

