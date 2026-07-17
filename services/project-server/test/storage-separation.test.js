const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");
const { migrateRuntimeStorage } = require("../../../tools/migrate-runtime-storage");
const { createConfig: projectConfig } = require("../src/config");
const { createConfig: telemetryConfig } = require("../../telemetry-server/src/config");

test("uses separate default SQLite files for projects and telemetry", () => {
  assert.match(projectConfig({}).sqlitePath, /gernetix-projects\.sqlite$/);
  assert.match(telemetryConfig({}).sqlitePath, /gernetix-telemetry\.sqlite$/);
});

test("migrates only project and telemetry tables out of shared runtime storage", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-storage-separation-"));
  const sourcePath = path.join(root, "services.sqlite");
  const source = new DatabaseSync(sourcePath);
  source.exec("CREATE TABLE project_server_projects (project_id TEXT PRIMARY KEY, title TEXT); INSERT INTO project_server_projects VALUES ('project-a', 'A'); CREATE TABLE telemetry_measurements (measurement_id TEXT PRIMARY KEY, metric TEXT); INSERT INTO telemetry_measurements VALUES ('measurement-a', 'temperature'); CREATE TABLE unrelated_state (id TEXT); INSERT INTO unrelated_state VALUES ('keep');");
  source.close();
  const result = migrateRuntimeStorage({ sourcePath, projectPath: path.join(root, "projects.sqlite"), telemetryPath: path.join(root, "telemetry.sqlite") });
  assert.equal(result.project.tables.project_server_projects, 1);
  assert.equal(result.telemetry.tables.telemetry_measurements, 1);
  const projects = new DatabaseSync(path.join(root, "projects.sqlite"), { readOnly: true });
  const telemetry = new DatabaseSync(path.join(root, "telemetry.sqlite"), { readOnly: true });
  assert.equal(projects.prepare("SELECT title FROM project_server_projects").get().title, "A");
  assert.equal(telemetry.prepare("SELECT metric FROM telemetry_measurements").get().metric, "temperature");
  assert.equal(Boolean(projects.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'unrelated_state'").get()), false);
  projects.close(); telemetry.close();
});
