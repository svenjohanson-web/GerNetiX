"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");
const {
  buildDryRunReport,
  canonicalJson,
  classifyFile,
  gitObjectOid,
  gitTreeOid,
  main,
  parseArguments,
  readPostgresInventory,
  readSqliteInventory,
} = require("./forgejo-migration-dry-run");

test("produces a byte-identical dry-run with preserved eligible paths and contents", () => {
  const inventory = representativeInventory();
  const first = `${canonicalJson(buildDryRunReport(inventory))}\n`;
  const second = `${canonicalJson(buildDryRunReport(structuredClone(inventory)))}\n`;
  assert.equal(first, second);

  const report = JSON.parse(first);
  assert.equal(report.mode, "dry_run_read_only");
  assert.equal(report.write_gate.allowed, true);
  assert.equal(report.projects[0].current.source_comparison.eligible_paths_preserved, true);
  assert.equal(report.projects[0].current.source_comparison.eligible_contents_preserved, true);
  assert.match(report.projects[0].current.tree_oid, /^[a-f0-9]{40}$/);
  assert.match(report.projects[0].target_head_commit_oid, /^[a-f0-9]{40}$/);
  assert.equal(report.projects[0].commits.length, 2);
  assert.equal(report.projects[0].commits[1].parent_commit_oid, report.projects[0].commits[0].commit_oid);
  assert.equal(first.includes("void setup"), false, "Bericht darf keine Dateiinhalte ausgeben");
  assert.equal(first.includes("user-private-id"), false, "Bericht darf keine rohe Account-ID ausgeben");
});

test("computes Git blob and tree object IDs without creating a repository", () => {
  assert.equal(gitObjectOid("blob", Buffer.from("test content\n")), "d670460b4b4aece5915caf5c68d12f560a9fe3e4");
  const files = [{ path: "hello.txt", content: "test content\n" }];
  assert.equal(gitTreeOid(files), "e4cc8b3b601ce58ee02233915fee2a5bdbcbb44d");
});

test("classifies runtime secrets, generated binaries and oversized files as blocking", () => {
  assert.equal(classifyFile({ path: ".env", content_type: "text/plain" }, "API_TOKEN=private-value\n"), "secret");
  assert.equal(classifyFile({ path: "firmware.bin", content_type: "application/octet-stream" }, "binary-payload"), "binary");
  assert.equal(classifyFile({ path: "large.txt", content_type: "text/plain" }, "x".repeat(1024 * 1024 + 1)), "oversized");
  assert.equal(classifyFile({ path: "gernetix/config.json", content_type: "application/json" }, '{"token":"<runtime-secret>"}\n'), "text");
  assert.equal(classifyFile({ path: "config.yaml", content_type: "application/x-yaml" }, "api_key: private-value\n"), "secret");

  const inventory = representativeInventory();
  inventory.sources.push(
    source(".env", "API_TOKEN=private-value\n", "text/plain"),
    source("build/firmware.bin", "binary-payload", "application/octet-stream"),
  );
  const report = buildDryRunReport(inventory);
  const files = new Map(report.projects[0].current.files.map((file) => [file.path, file]));
  assert.equal(report.write_gate.allowed, false);
  assert.equal(files.get(".env").classification, "secret");
  assert.equal(files.get(".env").disposition, "runtime_secret_required");
  assert.equal(files.get("build/firmware.bin").classification, "binary");
  assert.equal(files.get("build/firmware.bin").disposition, "artifact_store_required");
  assert.ok(report.issues.some((entry) => entry.code === "secret_source_requires_resolution"));
  assert.ok(report.issues.some((entry) => entry.code === "binary_source_requires_resolution"));
  assert.equal(canonicalJson(report).includes("private-value"), false);
});

test("rechecks projected configuration for secret keys not redacted by the legacy projector", () => {
  const inventory = representativeInventory();
  inventory.projects[0].view_manifest.communication_setup = { api_key: "must-not-enter-git" };
  const report = buildDryRunReport(inventory);
  assert.equal(report.write_gate.allowed, false);
  assert.ok(report.issues.some((entry) => entry.code === "secret_projection_requires_resolution"));
  assert.equal(canonicalJson(report).includes("must-not-enter-git"), false);
});

test("requires complete Artifact Store references for SQL binary versions", () => {
  const inventory = representativeInventory();
  inventory.versions[0].includes_binary = true;
  inventory.versions[0].binary_artifacts = [];
  let report = buildDryRunReport(inventory);
  assert.equal(report.write_gate.allowed, false);
  assert.ok(report.issues.some((entry) => entry.code === "binary_artifact_reference_missing"));

  inventory.versions[0].binary_artifacts = [{
    artifact_id: "artifact-1", file_name: "firmware.bin", sha256: "a".repeat(64), size_bytes: 42,
  }];
  report = buildDryRunReport(inventory);
  assert.equal(report.write_gate.allowed, true);
  assert.deepEqual(report.projects[0].commits[0].binary_artifact_references, [{
    artifact_id: "artifact-1",
    file_name_sha256: crypto.createHash("sha256").update("firmware.bin").digest("hex"),
    sha256: "a".repeat(64),
    size_bytes: 42,
  }]);
  const payload = require("./forgejo-migration-dry-run").buildMigrationPayload(inventory);
  assert.match(payload.projects[0].commits[0].message, /GerNetiX-Artifact: artifact-1 sha256=/);
  assert.equal(payload.projects[0].commits[0].message.includes("firmware.bin"), false);
});

test("blocks duplicate paths, projection conflicts, path rewrites and broken source hashes", () => {
  const inventory = representativeInventory();
  inventory.sources.push(source("src/main.cpp", "different\n"));
  inventory.sources.push(source("folder\\legacy.cpp", "legacy\n"));
  inventory.sources.push({
    ...source("gernetix/project.json", "{}\n", "application/json"),
    content_sha256: "0".repeat(64),
  });
  inventory.sources.push(source("config/broken.json", "{not-json\n", "application/json"));
  const report = buildDryRunReport(inventory);
  assert.equal(report.write_gate.allowed, false);
  const codes = new Set(report.issues.map((entry) => entry.code));
  assert.ok(codes.has("conflicting_source_path"));
  assert.ok(codes.has("projection_source_conflict"));
  assert.ok(codes.has("path_requires_rewrite"));
  assert.ok(codes.has("source_hash_mismatch"));
  assert.ok(codes.has("json_source_unreadable"));
});

test("blocks unreadable and ambiguous SQL version history", () => {
  const inventory = representativeInventory();
  inventory.versions.push({
    ...inventory.versions[0],
    version_id: "version-2",
    parent_version_id: "missing-version",
    created_at: "not-a-date",
  });
  const report = buildDryRunReport(inventory);
  assert.equal(report.write_gate.allowed, false);
  assert.ok(report.issues.some((entry) => entry.code === "version_parent_missing"));
  assert.ok(report.issues.some((entry) => entry.code === "version_history_has_multiple_heads"));
  assert.ok(report.issues.some((entry) => entry.code === "commit_timestamp_missing"));
});

test("reads typed SQLite project state read-only and reports invalid legacy JSON", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "forgejo-dry-run-sqlite-"));
  const sqlitePath = path.join(directory, "projects.sqlite");
  const db = new DatabaseSync(sqlitePath);
  db.exec(`
    CREATE TABLE project_server_projects (project_id TEXT PRIMARY KEY, raw_json TEXT NOT NULL);
    CREATE TABLE project_server_sources (
      project_id TEXT NOT NULL, path TEXT NOT NULL, raw_json TEXT NOT NULL,
      PRIMARY KEY (project_id, path)
    );
    CREATE TABLE project_server_versions (version_id TEXT PRIMARY KEY, raw_json TEXT NOT NULL);
  `);
  db.prepare("INSERT INTO project_server_projects VALUES (?, ?)").run("project-1", JSON.stringify(project()));
  db.prepare("INSERT INTO project_server_sources VALUES (?, ?, ?)").run(
    "project-1", "src/main.cpp", JSON.stringify(source("src/main.cpp", "void setup() {}\n")),
  );
  db.prepare("INSERT INTO project_server_versions VALUES (?, ?)").run("broken", "{not-json");
  db.close();
  const before = fileSha256(sqlitePath);

  const inventory = readSqliteInventory(sqlitePath);
  const after = fileSha256(sqlitePath);
  assert.equal(after, before);
  assert.equal(inventory.projects.length, 1);
  assert.equal(inventory.sources.length, 1);
  assert.equal(inventory.versions.length, 0);
  assert.ok(inventory.read_errors.some((entry) => entry.code === "legacy_json_unreadable"));
  assert.equal(buildDryRunReport(inventory).write_gate.allowed, false);
});

test("runs the complete SQLite CLI path twice with byte-identical private reports", async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "forgejo-dry-run-cli-"));
  const sqlitePath = path.join(directory, "projects.sqlite");
  const firstReport = path.join(directory, "first.json");
  const secondReport = path.join(directory, "second.json");
  const db = new DatabaseSync(sqlitePath);
  db.exec(`
    CREATE TABLE project_server_projects (project_id TEXT PRIMARY KEY, raw_json TEXT NOT NULL);
    CREATE TABLE project_server_sources (
      project_id TEXT NOT NULL, path TEXT NOT NULL, raw_json TEXT NOT NULL,
      PRIMARY KEY (project_id, path)
    );
    CREATE TABLE project_server_versions (version_id TEXT PRIMARY KEY, raw_json TEXT NOT NULL);
  `);
  db.prepare("INSERT INTO project_server_projects VALUES (?, ?)").run("project-1", JSON.stringify(project()));
  db.prepare("INSERT INTO project_server_sources VALUES (?, ?, ?)").run(
    "project-1", "src/main.cpp", JSON.stringify(source("src/main.cpp", "void setup() {}\n")),
  );
  db.close();
  const sourceBefore = fileSha256(sqlitePath);

  assert.equal(await main(["--sqlite", sqlitePath, "--output", firstReport, "--assert-ready"], {}), 0);
  assert.equal(await main(["--sqlite", sqlitePath, "--output", secondReport, "--assert-ready"], {}), 0);
  assert.equal(fs.readFileSync(firstReport, "utf8"), fs.readFileSync(secondReport, "utf8"));
  assert.equal(fileSha256(sqlitePath), sourceBefore);
  assert.equal(fs.statSync(firstReport).mode & 0o777, 0o600);
  await assert.rejects(
    main(["--sqlite", sqlitePath, "--output", firstReport], {}),
    (error) => error?.code === "EEXIST",
  );
});

test("uses a repeatable-read read-only PostgreSQL transaction and always rolls it back", async () => {
  const calls = [];
  const pool = {
    async query(text) {
      calls.push(text);
      if (text.startsWith("SELECT project_id, raw_json")) return { rows: [{ project_id: "project-1", raw_json: project() }] };
      if (text.startsWith("SELECT project_id, path")) return { rows: [{ project_id: "project-1", path: "src/main.cpp", raw_json: source("src/main.cpp", "void setup() {}\n") }] };
      if (text.startsWith("SELECT project_id, version_id")) return { rows: [] };
      return { rows: [] };
    },
  };
  const inventory = await readPostgresInventory(pool);
  assert.equal(inventory.projects.length, 1);
  assert.deepEqual(calls, [
    "BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY",
    "SELECT project_id, raw_json FROM project_projects ORDER BY project_id",
    "SELECT project_id, path, raw_json FROM project_sources ORDER BY project_id, path",
    "SELECT project_id, version_id, raw_json FROM project_versions ORDER BY project_id, created_at, version_id",
    "ROLLBACK",
  ]);
  assert.equal(calls.some((statement) => /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i.test(statement)), false);
});

test("has no apply argument or implicit source selection", () => {
  assert.throws(() => parseArguments([]), /Genau eine Quelle/);
  assert.throws(() => parseArguments(["--apply", "--sqlite", "x.sqlite"]), /Unbekanntes Argument/);
  assert.throws(() => parseArguments(["--sqlite", "x.sqlite", "--postgres"]), /Genau eine Quelle/);
  assert.deepEqual(parseArguments(["--sqlite", "x.sqlite", "--assert-ready"]), {
    sqlite: "x.sqlite", postgres: false, output: "", assertReady: true, help: false,
  });
});

test("keeps the documented report schema version aligned with the implementation", () => {
  const schema = JSON.parse(fs.readFileSync(
    path.join(__dirname, "../docs/forgejo-migration-dry-run-report.schema.json"),
    "utf8",
  ));
  const report = buildDryRunReport(representativeInventory());
  assert.equal(schema.properties.schema_version.const, report.schema_version);
  assert.equal(schema.properties.mode.const, report.mode);
  assert.deepEqual(
    [...schema.required].sort(),
    ["schema_version", "mode", "source_kind", "source_fingerprint_sha256", "summary", "write_gate", "projects", "issues"].sort(),
  );
  for (const required of schema.$defs.project.required) assert.ok(Object.hasOwn(report.projects[0], required), required);
  for (const required of schema.$defs.tree.required) assert.ok(Object.hasOwn(report.projects[0].current, required), required);
  for (const required of schema.$defs.commit.required) assert.ok(Object.hasOwn(report.projects[0].commits[0], required), required);
});

function representativeInventory() {
  const currentProject = project();
  return {
    source_kind: "test",
    projects: [currentProject],
    sources: [source("src/main.cpp", "void setup() {}\n")],
    versions: [{
      version_id: "version-1",
      project_id: "project-1",
      parent_version_id: null,
      created_by_user_id: "user-private-id",
      message: "Erster Projektstand",
      state: "saved",
      includes_binary: false,
      snapshot_sha256: "",
      project_snapshot: { ...currentProject, title: "Version 1" },
      sources: [source("src/main.cpp", "void setup() {}\n")],
      created_at: "2026-08-01T10:00:00.000Z",
    }],
    read_errors: [],
  };
}

function project() {
  return {
    project_id: "project-1",
    user_id: "user-private-id",
    title: "Dry-run Projekt",
    description: "Deterministischer Bestand",
    learning_project_id: "",
    hardware_profile_id: "board.esp32",
    device_id: null,
    build_config: null,
    software_units: [],
    active_software_unit_id: "",
    view_manifest: { schema_version: 1, views: [] },
    status: "active",
    created_at: "2026-08-01T09:00:00.000Z",
    updated_at: "2026-08-02T10:00:00.000Z",
  };
}

function source(sourcePath, content, contentType = "text/x-c++src") {
  return {
    project_id: "project-1",
    path: sourcePath,
    content,
    content_sha256: crypto.createHash("sha256").update(content).digest("hex"),
    content_type: contentType,
    role: "user_code",
    updated_at: "2026-08-02T10:00:00.000Z",
  };
}

function fileSha256(filePath) {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}
