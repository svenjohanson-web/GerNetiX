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
    publicDemo: false,
    publishNexi: false,
    migrateArtifacts: false,
    host: "deploy@example.test",
    branch: "agent/test",
  });
});

test("adds the verified PostgreSQL binary migration to staging only when requested", () => {
  const command = remoteDeployCommand({
    branch: "main",
    commit: "0123456789abcdef0123456789abcdef01234567",
    remoteDir: "/opt/gernetix",
    migrateArtifacts: true,
  });
  assert.match(command, /migrate-postgres-binaries-to-artifact-store\.js --remove-untraceable-test-artifacts/);
  assert.match(command, /audit-postgres-binaries\.js/);
});

test("adds a committed Nexi release publication to the controlled staging deploy", () => {
  const command = remoteDeployCommand({
    branch: "main",
    commit: "0123456789abcdef0123456789abcdef01234567",
    remoteDir: "/opt/gernetix",
    publishNexi: true,
  });
  assert.match(command, /NEXI_RELEASE_VERSION='0\.1\.0-0123456789ab'/);
  assert.match(command, /NEXI_SOURCE_COMMIT='0123456789abcdef0123456789abcdef01234567'/);
  assert.match(command, /platformio run --project-dir \/app\/basissoftware\/esp32 -e waveshare-esp32-s3-audio-voice-lab/);
  assert.match(command, /publish-nexi-release\.js/);
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
  assert.match(command, /previous_commit=\$\(git rev-parse HEAD\)/);
  assert.match(command, /git switch --detach '0123456789abcdef'/);
  assert.match(command, /remote-deploy\.sh "\$previous_commit"/);
});
