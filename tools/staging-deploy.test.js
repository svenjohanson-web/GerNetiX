"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  additionalServicesByFile,
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
    migrateArtifacts: false,
    forceFull: false,
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


test("rejects unsafe refs and ssh targets", () => {
  assert.throws(() => assertSafeGitRef("main; reboot"), /Unsicherer/);
  assert.throws(() => assertSafeGitRef("../main"), /Unsicherer/);
  assert.throws(() => assertSafeSshTarget("root@example.test -o ProxyCommand=x"), /Ungueltiges/);
  assert.equal(assertSafeSshTarget("gernetix-vps"), "gernetix-vps");
});

test("parses an explicit full-deployment recovery", () => {
  assert.equal(parseArgs(["--force-full"]).forceFull, true);
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

test("uses a validated earlier commit to repeat a full deployment", () => {
  const previousCommit = "f".repeat(40);
  const command = remoteDeployCommand({
    branch: "main",
    commit: "0".repeat(40),
    remoteDir: "/opt/gernetix",
    forcedPreviousCommit: previousCommit,
  });
  assert.match(command, /previous_commit=/);
  assert.match(command, new RegExp(previousCommit));
  assert.throws(() => remoteDeployCommand({
    branch: "main",
    commit: "0".repeat(40),
    remoteDir: "/opt/gernetix",
    forcedPreviousCommit: "main; reboot",
  }), /ungueltig/);
});

/*
 * Eine Datei, die ein zweiter Dienst liest, muss auch bei ihm ankommen.
 *
 * admin-tool bindet das Komponentenmetamodell aus dem Browserverzeichnis von
 * identity-server mit require ein. Ohne einen Eintrag in
 * additionalServicesByFile erreicht eine Aenderung daran nur identity-server;
 * admin-tool laeuft mit dem alten Stand weiter. Genau so ist ein Deployment
 * abgebrochen, und der Fix erreichte den kaputten Dienst danach nicht.
 *
 * Die Liste wird deshalb nicht geglaubt, sondern gegen die Quellen geprueft.
 */
test("every browser file a second service requires is routed to that service too", () => {
  const wurzel = path.resolve(__dirname, "..");
  const dienste = fs.readdirSync(path.join(wurzel, "services"), { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => e.name);

  const jsDateien = (verzeichnis, gesammelt = []) => {
    for (const eintrag of fs.readdirSync(verzeichnis, { withFileTypes: true })) {
      if (eintrag.name === "node_modules" || eintrag.name === "dist" || eintrag.name === "public") continue;
      const voll = path.join(verzeichnis, eintrag.name);
      if (eintrag.isDirectory()) jsDateien(voll, gesammelt);
      else if (eintrag.name.endsWith(".js") && !eintrag.name.endsWith(".test.js")) gesammelt.push(voll);
    }
    return gesammelt;
  };

  const fehlend = [];
  for (const dienst of dienste) {
    const dienstWurzel = path.join(wurzel, "services", dienst);
    for (const datei of jsDateien(dienstWurzel)) {
      for (const treffer of fs.readFileSync(datei, "utf8").matchAll(/require\("([^"]*public\/app\/[^"]+)"\)/g)) {
        const basis = path.resolve(path.dirname(datei), treffer[1]);
        const ziel = [basis, `${basis}.js`].find((k) => fs.existsSync(k));
        if (!ziel) continue;
        const relativ = path.relative(wurzel, ziel).replace(/\\/g, "/");
        // Liegt die Datei im eigenen Dienst, greift die Verzeichniszuordnung.
        if (relativ.startsWith(`services/${dienst}/`)) continue;
        const zugeordnet = additionalServicesByFile.get(relativ) || [];
        if (!zugeordnet.includes(dienst)) fehlend.push(`${relativ} -> ${dienst}`);
      }
    }
  }
  assert.deepEqual(fehlend, []);
});
