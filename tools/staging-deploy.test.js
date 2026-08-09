"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertSafeGitRef,
  assertSafeSshTarget,
  createDeploymentPlan,
  formatDeploymentPlan,
  parseArgs,
  parseEnvFile,
  remoteDeployCommand,
  remoteHeadCommand,
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
    plan: false,
    publicDemo: false,
    publishNexi: false,
    publishSystemRepositories: false,
    migrateArtifacts: false,
    host: "deploy@example.test",
    branch: "agent/test",
  });
});

test("rejects mutually exclusive local preview and remote plan", () => {
  assert.throws(() => parseArgs(["--dry-run", "--plan"]), /nicht gemeinsam/);
});

test("plans the frequent identity assistant change without a full VPS deployment", () => {
  const plan = createDeploymentPlan([
    "services/identity-server/public/app/app.js",
    "services/recovery-tool/src/services/hardware-lab-ai.js",
    "infra/vps/nginx/tls.conf",
    "services/identity-server/test/hardware-lab-ui.test.js",
    "docs/codex-staging-deployment.md",
  ], { historyIsLinear: true });

  assert.equal(plan.mode, "incremental");
  assert.deepEqual(plan.services, ["identity-server"]);
  assert.equal(plan.edge, true);
  assert.equal(plan.firewall, false);
});

test("plans edge and firewall changes as targeted infrastructure", () => {
  const plan = createDeploymentPlan([
    "infra/vps/nginx/default.conf",
    "infra/vps/security/firewall.nft",
  ], { historyIsLinear: true });
  assert.equal(plan.mode, "targeted-infrastructure");
  assert.equal(plan.edge, true);
  assert.equal(plan.firewall, true);
});

test("does not reload runtime infrastructure for test-only changes", () => {
  const plan = createDeploymentPlan([
    "infra/vps/nginx/nginx-tls-config.test.js",
    "tools/staging-deploy.test.js",
  ], { historyIsLinear: true });
  assert.equal(plan.mode, "none");
  assert.equal(plan.edge, false);
  assert.equal(plan.firewall, false);
});

test("uses the full safety path for compose, docker and unknown runtime files", () => {
  for (const file of ["compose.vps.yaml", "docker/node-service.Dockerfile", "scripts/staging/remote-deploy.sh"]) {
    const plan = createDeploymentPlan([file], { historyIsLinear: true });
    assert.equal(plan.mode, "full", file);
    assert.match(plan.reasons[0], new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("prints a concise and explained deployment plan", () => {
  const output = formatDeploymentPlan(createDeploymentPlan([
    "services/identity-server/src/dev-server.js",
  ], { historyIsLinear: true }), "a".repeat(40), "b".repeat(40));
  assert.match(output, /Deployment-Plan: incremental/);
  assert.match(output, /Dienste: identity-server/);
  assert.match(output, /VPS:\s+a{12}/);
});

test("preflights the clean VPS and reads its deployed commit without changing runtime state", () => {
  const command = remoteHeadCommand("/opt/gernetix");
  assert.match(command, /git status --porcelain --untracked-files=no/);
  assert.match(command, /docker info/);
  assert.match(command, /docker compose version/);
  assert.match(command, /test -f \.env\.vps/);
  assert.match(command, /git rev-parse HEAD/);
  assert.doesNotMatch(command, /git switch|docker compose (?:up|build|run|exec)/);
});

test("adds the verified PostgreSQL binary migration to staging only when requested", () => {
  const command = remoteDeployCommand({
    branch: "main",
    commit: "0123456789abcdef0123456789abcdef01234567",
    remoteDir: "/opt/gernetix",
    migrateArtifacts: true,
  });
  assert.match(command, /migrate-postgres-binaries-to-artifact-store\.js --quarantine-untraceable-artifacts/);
  assert.match(command, /audit-postgres-binaries\.js/);
});

test("adds a committed Nexi release publication to the controlled staging deploy", () => {
  const command = remoteDeployCommand({
    branch: "main",
    commit: "0123456789abcdef0123456789abcdef01234567",
    remoteDir: "/opt/gernetix",
    publishNexi: true,
  });
  assert.match(command, /NEXI_RELEASE_VERSION=.*0\.1\.0-0123456789ab/);
  assert.match(command, /NEXI_SOURCE_COMMIT=.*0123456789abcdef0123456789abcdef01234567/);
  assert.match(command, /platformio run --project-dir \/app\/basissoftware\/esp32 -e waveshare-esp32-s3-audio-voice-lab/);
  assert.match(command, /publish-nexi-release\.js/);
});

test("rejects unsafe refs and ssh targets", () => {
  assert.throws(() => assertSafeGitRef("main; reboot"), /Unsicherer/);
  assert.throws(() => assertSafeGitRef("../main"), /Unsicherer/);
  assert.throws(() => assertSafeSshTarget("root@example.test -o ProxyCommand=x"), /Ungueltiges/);
  assert.equal(assertSafeSshTarget("gernetix-vps"), "gernetix-vps");
});

test("quotes remote values and deploys an exact commit", () => {
  assert.equal(shellQuote("/opt/gernetix"), "'/opt/gernetix'");
  const command = remoteDeployCommand({
    branch: "agent/staging",
    commit: "0123456789abcdef",
    remoteDir: "/opt/gernetix",
  });
  assert.match(command, /git fetch origin .*agent\/staging/);
  assert.match(command, /previous_commit=\$\(git rev-parse HEAD\)/);
  assert.match(command, /git switch --detach .*0123456789abcdef/);
  assert.match(command, /remote-deploy\.sh "\$previous_commit"/);
  assert.match(command, /flock -E 75 -n \/var\/lock\/gernetix-staging-deploy\.lock/);
});

test("runs the controlled Forgejo system-source publisher only when requested", () => {
  const command = remoteDeployCommand({ branch: "main", commit: "0123456789abcdef0123456789abcdef01234567", remoteDir: "/opt/gernetix", publishSystemRepositories: true });
  assert.match(command, /scripts\/staging\/publish-forgejo-system-repositories\.sh \.env\.vps/);
});
