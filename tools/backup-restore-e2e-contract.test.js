"use strict";

// Vertragspruefungen fuer den Container-Nachweis der Kundendaten-Sicherung.
// Sie laufen ohne Docker und sichern die Eigenschaften, die der eigentliche
// End-to-End-Lauf voraussetzt: harte Isolation, vollstaendige Vorpruefung vor
// dem ersten schreibenden Schritt und ein Nachweis, der beide Sicherungsmodi
// und beide Negativfaelle abdeckt.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const applyScriptPath = path.join(root, "tools", "apply-restored-backup-set.sh");
const e2eScriptPath = path.join(root, "tools", "backup-restore-e2e.sh");
const composePath = path.join(root, "tools", "backup-restore-test.compose.yaml");

const applyScript = fs.readFileSync(applyScriptPath, "utf8");
const e2eScript = fs.readFileSync(e2eScriptPath, "utf8");
const composeModel = fs.readFileSync(composePath, "utf8");
const runbook = fs.readFileSync(path.join(root, "docs", "customer-data-restore-runbook.md"), "utf8");

const REQUIRED_MEMBERS = [
  "runtime-database.dump",
  "runtime-roles.sql",
  "forgejo-database.dump",
  "forgejo-data.tar.gz",
  "artifact-objects.tar",
];

function hasPosixShell() {
  const probe = spawnSync("sh", ["-c", "exit 0"]);
  return !probe.error && probe.status === 0;
}

// Fuehrt das Apply-Werkzeug mit einem gefaelschten docker aus, das jeden
// Aufruf protokolliert und scheitert. Damit laesst sich beweisen, dass die
// Vorpruefung vor jedem Docker-Zugriff greift.
function runApplyPreflight(options) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-apply-preflight-"));
  const dockerLog = path.join(temp, "docker-called");
  fs.writeFileSync(path.join(temp, "docker"), `#!/bin/sh\ntouch '${dockerLog}'\nexit 99\n`, { mode: 0o700 });

  const membersDir = path.join(temp, "bestandteile");
  const artifactsDir = path.join(temp, "artefakte");
  fs.mkdirSync(membersDir);
  fs.mkdirSync(artifactsDir);
  for (const member of REQUIRED_MEMBERS) {
    if (options.omitMember === member) continue;
    fs.writeFileSync(path.join(membersDir, member), "synthetisch\n");
  }
  if (!options.omitArtifactArchive) {
    fs.writeFileSync(path.join(artifactsDir, "artifact-objects-20260820T101500Z-daily-0123456789abcdef.tar"), "");
  }
  const envFile = path.join(temp, "restore.env");
  fs.writeFileSync(envFile, "BACKUP_TEST_POSTGRES_PASSWORD=synthetic-only\n");

  const result = spawnSync("sh", [applyScriptPath, membersDir, artifactsDir], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${temp}:${process.env.PATH}`,
      RESTORE_COMPOSE_PROJECT: options.project ?? "gernetix-restore-vertrag",
      RESTORE_COMPOSE_FILE: options.composeFile ?? composePath,
      RESTORE_ENV_FILE: envFile,
      RESTORE_EXPECTED_FORGEJO_VERSION: options.version ?? "15.0.6",
    },
  });
  return { ...result, dockerCalled: fs.existsSync(dockerLog) };
}

test("das Einspielen richtet sich niemals gegen ein anderes Compose-Projekt", (t) => {
  if (!hasPosixShell()) return t.skip("Keine POSIX-Shell verfuegbar; laeuft in CI");
  for (const project of ["gernetix-vps", "gernetix", "gernetix-restore", "produktion", ""]) {
    const result = runApplyPreflight({ project });
    assert.notEqual(result.status, 0, `Projektname ${project} muss abgelehnt werden`);
    assert.equal(result.dockerCalled, false);
    assert.match(result.stderr, /Unsicherer Restore-Projektname/);
  }
});

test("das Einspielen bricht vor Docker ab, wenn ein Bestandteil fehlt", (t) => {
  if (!hasPosixShell()) return t.skip("Keine POSIX-Shell verfuegbar; laeuft in CI");
  for (const member of REQUIRED_MEMBERS) {
    const result = runApplyPreflight({ omitMember: member });
    assert.notEqual(result.status, 0);
    assert.equal(result.dockerCalled, false, `Fehlendes ${member} darf Docker nicht erreichen`);
    assert.match(result.stderr, /Unvollstaendige oder unsichere Bestandteile/);
  }
});

test("das Einspielen bricht vor Docker ab, wenn kein Artefaktarchiv vorliegt", (t) => {
  if (!hasPosixShell()) return t.skip("Keine POSIX-Shell verfuegbar; laeuft in CI");
  const result = runApplyPreflight({ omitArtifactArchive: true });
  assert.notEqual(result.status, 0);
  assert.equal(result.dockerCalled, false);
  assert.match(result.stderr, /Keine Artefaktarchive/);
});

test("das Einspielen verlangt eine feste Forgejo-Patchversion", (t) => {
  if (!hasPosixShell()) return t.skip("Keine POSIX-Shell verfuegbar; laeuft in CI");
  for (const version of ["15.0", "latest", "15.0.6-rootless", ""]) {
    const result = runApplyPreflight({ version });
    assert.notEqual(result.status, 0, `Version ${version} muss abgelehnt werden`);
    assert.equal(result.dockerCalled, false);
  }
});

test("das Einspielen prueft ein leeres Ziel und raeumt bei Fehlern nur sich selbst auf", () => {
  assert.match(applyScript, /gernetix-restore-/);
  assert.match(applyScript, /compose ps -aq/);
  assert.match(applyScript, /docker volume ls --filter/);
  assert.match(applyScript, /Restore-Datenbank gernetix_runtime ist nicht leer/);
  assert.match(applyScript, /Restore-Datenbank forgejo ist nicht leer/);
  assert.match(applyScript, /Restore-forgejo_data ist nicht leer/);
  assert.match(applyScript, /compose down --volumes --remove-orphans/);
  assert.doesNotMatch(applyScript, /docker (system|volume) prune/);
  assert.doesNotMatch(applyScript, /compose\.vps\.yaml|\.env\.vps/);
});

test("das Einspielen weist Rollen, Datenbanken, Repository-Volume und Artefakte nach", () => {
  assert.match(applyScript, /pg_restore[^\n]*--dbname "\$POSTGRES_DB"[^\n]*--exit-on-error/);
  assert.match(applyScript, /pg_restore[^\n]*--dbname forgejo[^\n]*--exit-on-error/);
  assert.match(applyScript, /tar -C \/var\/lib\/gitea -xzf/);
  assert.match(applyScript, /artifact-objects-\*\.tar/);
  // Rollen gelten erst als eingespielt, wenn sie danach nachweislich existieren.
  assert.match(applyScript, /Rolle aus dem Sicherungssatz fehlt nach dem Restore/);
  assert.match(applyScript, /pg_catalog\.pg_roles WHERE rolname/);
  // Content-addressed Objekte duerfen einander nie ueberschreiben.
  assert.match(applyScript, /--keep-old-files/);
  assert.match(applyScript, /unsichere Pfade/);
});

test("der Nachweislauf deckt beide Sicherungsmodi und die Inkrementalitaet ab", () => {
  assert.match(e2eScript, /--mode daily/);
  assert.match(e2eScript, /--mode hourly/);
  assert.match(e2eScript, /1 neu, 1 uebernommen/);
  assert.match(e2eScript, /1 aus diesem Satz, 1 aus 1 frueheren/);
  // Forgejo muss nach dem taeglichen Lauf nachweislich wieder anlaufen.
  assert.match(e2eScript, /lief nach dem taeglichen Sicherungslauf nicht wieder an/);
});

test("der Nachweislauf belegt Projektdateien, Repository-Bindung und Artefakte", () => {
  assert.match(e2eScript, /git clone/);
  assert.match(e2eScript, /ls-tree -r --full-tree/);
  assert.match(e2eScript, /log --reverse --format=/);
  assert.match(e2eScript, /cmp "\$work_dir\/source-tree\.txt" "\$work_dir\/restored-tree\.txt"/);
  assert.match(e2eScript, /cmp "\$work_dir\/source-history\.txt" "\$work_dir\/restored-history\.txt"/);
  // Die Kette Projekt -> Repository -> erwarteter Commit wird gegen den Clone gehalten.
  assert.match(e2eScript, /head_sha FROM project_projects/);
  assert.match(e2eScript, /zeigt nach dem Restore auf/);
  // Beide Artefakte muessen im wiederhergestellten Store liegen und stimmen.
  assert.match(e2eScript, /for expected_object in "\$artifact_one" "\$artifact_two"/);
  assert.match(e2eScript, /fehlt oder ist beschaedigt/);
  assert.match(e2eScript, /check-restored-runtime\.js/);
  assert.match(e2eScript, /--expected-row-counts/);
});

test("der Nachweislauf fuehrt beide Negativfaelle aus und raeumt vollstaendig auf", () => {
  assert.match(e2eScript, /veraendertes Objekt im Sicherungssatz/);
  assert.match(e2eScript, /fehlender frueherer Satz/);
  assert.match(e2eScript, /unerwartet akzeptiert/);
  assert.match(e2eScript, /down --volumes --remove-orphans/);
  assert.match(e2eScript, /trap cleanup EXIT/);
  assert.doesNotMatch(e2eScript, /compose\.vps\.yaml|\.env\.vps|staging|deploy/);
});

test("der Nachweislauf nutzt ausschliesslich synthetische, kurzlebige Geheimnisse", () => {
  assert.match(e2eScript, /openssl rand -hex 32/);
  assert.match(e2eScript, /mktemp -d/);
  assert.match(e2eScript, /chmod 0600 "\$env_file"/);
  assert.match(e2eScript, /example\.invalid/);
  assert.doesNotMatch(e2eScript, /gernetix\.(de|com|net)/);
});

test("die Test-Compose spricht dieselben Dienste an wie die Produktion, aber eigene Volumes", () => {
  for (const service of ["runtime-postgres:", "forgejo:", "public-demo-server:"]) {
    assert.match(composeModel, new RegExp(`^  ${service.replace(/:/, ":")}`, "m"), `Dienst ${service} fehlt`);
  }
  assert.match(composeModel, /POSTGRES_DB: gernetix_runtime/);
  assert.match(composeModel, /codeberg\.org\/forgejo\/forgejo:15\.0\.6-rootless/);
  assert.match(composeModel, /build_state:\/var\/lib\/gernetix\/build/);
  // Keine Bindmounts in echte Zustandsverzeichnisse, nur benannte Volumes und
  // die eine schreibgeschuetzte Init-Datei.
  const bindMounts = composeModel.match(/^\s+- \.\/[^\n]*$/gm) || [];
  assert.deepEqual(
    bindMounts.map((line) => line.trim()),
    ["- ./backup/e2e-init-databases.sh:/docker-entrypoint-initdb.d/10-databases.sh:ro"],
  );
});

test("das Runbook und der Nachweislauf beschreiben denselben Ablauf", () => {
  for (const phrase of [
    "restore-backup-set.js",
    "apply-restored-backup-set.sh",
    "check-restored-runtime.js",
    "gernetix-restore-",
    "NO-GO",
    "GO",
  ]) {
    assert.ok(runbook.includes(phrase), `Runbook nennt ${phrase} nicht`);
  }
});
