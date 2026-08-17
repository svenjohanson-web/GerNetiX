const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const restoreScript = path.join(root, "tools", "restore-forgejo-backup.sh");
const composeFile = path.join(root, "tools", "forgejo-backup-restore-test.compose.yaml");
const e2eScript = fs.readFileSync(path.join(root, "tools", "forgejo-backup-restore-e2e.sh"), "utf8");
const runbook = fs.readFileSync(path.join(root, "docs", "forgejo-backup-restore-runbook.md"), "utf8");
const encryptionScript = fs.readFileSync(path.join(root, "tools", "encrypt-forgejo-backup.sh"), "utf8");
const upgradeScript = fs.readFileSync(path.join(root, "tools", "verify-forgejo-upgrade.sh"), "utf8");
const reportingScript = fs.readFileSync(path.join(root, "tools", "report-forgejo-operation.sh"), "utf8");

function createBackupSet(directory) {
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  fs.writeFileSync(path.join(directory, "forgejo-database.dump"), "synthetic-database\n");
  const archive = spawnSync("tar", ["-czf", "-", "--files-from", "/dev/null"]);
  assert.equal(archive.status, 0, archive.stderr.toString());
  fs.writeFileSync(path.join(directory, "forgejo-data.tar.gz"), archive.stdout);
  fs.writeFileSync(path.join(directory, "forgejo-version.txt"), "codeberg.org/forgejo/forgejo:15.0.6-rootless\n");
  const checksum = spawnSync("sha256sum", ["forgejo-database.dump", "forgejo-data.tar.gz", "forgejo-version.txt"], {
    cwd: directory,
    encoding: "utf8",
  });
  assert.equal(checksum.status, 0, checksum.stderr);
  fs.writeFileSync(path.join(directory, "SHA256SUMS"), checksum.stdout);
}

function runPreflight(backupDirectory) {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-forgejo-restore-contract-"));
  const dockerLog = path.join(temp, "docker-called");
  const fakeDocker = path.join(temp, "docker");
  const envFile = path.join(temp, "restore.env");
  fs.writeFileSync(fakeDocker, "#!/bin/sh\ntouch '" + dockerLog + "'\nexit 99\n", { mode: 0o700 });
  fs.writeFileSync(envFile, "FORGEJO_TEST_POSTGRES_PASSWORD=synthetic-only\n");
  const result = spawnSync("sh", [restoreScript, backupDirectory], {
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: temp + ":" + process.env.PATH,
      RESTORE_COMPOSE_PROJECT: "gernetix-forgejo-restore-contract-negative",
      RESTORE_COMPOSE_FILE: composeFile,
      RESTORE_ENV_FILE: envFile,
      RESTORE_EXPECTED_FORGEJO_VERSION: "15.0.6",
    },
  });
  return { ...result, dockerCalled: fs.existsSync(dockerLog) };
}

test("aborts before Docker when a required backup member is missing", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-incomplete-backup-"));
  createBackupSet(directory);
  fs.unlinkSync(path.join(directory, "forgejo-data.tar.gz"));
  const result = runPreflight(directory);
  assert.notEqual(result.status, 0);
  assert.equal(result.dockerCalled, false);
  assert.match(result.stderr, /Unvollstaendiger/);
});

test("aborts before Docker when a checksum is wrong", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-corrupt-backup-"));
  createBackupSet(directory);
  fs.appendFileSync(path.join(directory, "forgejo-database.dump"), "tampered\n");
  const result = runPreflight(directory);
  assert.notEqual(result.status, 0);
  assert.equal(result.dockerCalled, false);
  assert.match(result.stderr, /Pruefsummenfehler/);
});

test("pins an isolated empty restore and rollback boundary", () => {
  const script = fs.readFileSync(restoreScript, "utf8");
  assert.match(script, /gernetix-forgejo-restore-/);
  assert.match(script, /compose ps -aq/);
  assert.match(script, /docker volume ls --filter/);
  assert.match(script, /Restore-Datenbank ist nicht leer/);
  assert.match(script, /Restore-forgejo_data ist nicht leer/);
  assert.match(script, /compose down --volumes --remove-orphans/);
  assert.doesNotMatch(script, /compose\.vps\.yaml|\.env\.vps|gernetix_runtime/);
});

test("requires a shared database and forgejo_data restore point with exact version", () => {
  const script = fs.readFileSync(restoreScript, "utf8");
  assert.match(script, /sha256sum -c SHA256SUMS/);
  assert.match(script, /forgejo-database\.dump/);
  assert.match(script, /forgejo-data\.tar\.gz/);
  assert.match(script, /forgejo-version\.txt/);
  assert.match(script, /pg_restore/);
  assert.match(script, /tar -C \/var\/lib\/gitea -xzf/);
  assert.match(script, /codeberg\.org\/forgejo\/forgejo:\$\{expected_version\}-rootless/);
});

test("runbook makes clone, tree, history, no-go and rollback evidence mandatory", () => {
  for (const phrase of [
    "Clone-Nachweis",
    "Dateibaum",
    "Commit-Historie",
    "NO-GO",
    "Rollback",
    "falscher Pruefsumme",
    "unvollstaendig",
  ]) {
    assert.match(runbook, new RegExp(phrase, "i"));
  }
  assert.match(runbook, /keine vorhandenen\s+Backups, Container, Datenbanken oder Volumes/i);
});

test("synthetic E2E contract proves restored clone, tree, history and safe negative cases", () => {
  assert.match(e2eScript, /git clone/);
  assert.match(e2eScript, /ls-tree -r --full-tree/);
  assert.match(e2eScript, /log --reverse --format=/);
  assert.match(e2eScript, /cmp "\$work_dir\/source-tree\.txt" "\$work_dir\/restored-tree\.txt"/);
  assert.match(e2eScript, /cmp "\$work_dir\/source-history\.txt" "\$work_dir\/restored-history\.txt"/);
  assert.match(e2eScript, /bad_checksum_project/);
  assert.match(e2eScript, /incomplete_project/);
  assert.match(e2eScript, /docker volume ls --filter/);
  assert.match(e2eScript, /down --volumes --remove-orphans/);
  assert.doesNotMatch(e2eScript, /compose\.vps\.yaml|\.env\.vps|staging|deploy/);
});

test("external backup encryption validates checksums and never overwrites an existing target", () => {
  assert.match(encryptionScript, /FORGEJO_BACKUP_AGE_RECIPIENT/);
  assert.match(encryptionScript, /sha256sum -c SHA256SUMS/);
  assert.match(encryptionScript, /age --encrypt --recipient/);
  assert.match(encryptionScript, /Verschluesseltes Ziel existiert bereits/);
  assert.match(encryptionScript, /chmod 0600/);
});

test("upgrade verification restores in isolation, pins both versions and runs forgejo doctor", () => {
  assert.match(upgradeScript, /RESTORE_COMPOSE_PROJECT/);
  assert.match(upgradeScript, /UPGRADE_FROM_VERSION/);
  assert.match(upgradeScript, /UPGRADE_TO_VERSION/);
  assert.match(upgradeScript, /forgejo doctor check --all/);
  assert.match(upgradeScript, /down --volumes --remove-orphans/);
  assert.doesNotMatch(upgradeScript, /compose\.vps\.yaml|\.env\.vps/);
});

test("operations reporting accepts only fixed events and safe ingest targets", () => {
  assert.match(reportingScript, /forgejo\.backup\.completed/);
  assert.match(reportingScript, /forgejo\.restore\.completed/);
  assert.match(reportingScript, /forgejo\.upgrade\.completed/);
  assert.match(reportingScript, /https:\/\/\*/);
  assert.match(reportingScript, /http:\/\/127\.0\.0\.1:\*/);
  assert.match(reportingScript, /X-GerNetiX-System-Event-Token/);
});
