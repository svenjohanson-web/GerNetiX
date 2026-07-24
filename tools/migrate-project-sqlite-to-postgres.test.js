const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");
const {
  readLegacyProjectState,
  readLegacyProjectStateWithFallback,
  requiredSecret,
} = require("./migrate-project-sqlite-to-postgres");

test("reads typed project rows from the dedicated SQLite database", () => {
  const sqlitePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "project-migration-")), "projects.sqlite");
  const db = new DatabaseSync(sqlitePath);
  db.exec(`
    CREATE TABLE project_server_projects (
      project_id TEXT PRIMARY KEY,
      raw_json TEXT NOT NULL
    );
    CREATE TABLE project_server_sources (
      project_id TEXT NOT NULL,
      path TEXT NOT NULL,
      raw_json TEXT NOT NULL,
      PRIMARY KEY (project_id, path)
    );
  `);
  db.prepare("INSERT INTO project_server_projects VALUES (?, ?)").run(
    "project-1",
    JSON.stringify({ project_id: "project-1", user_id: "user-1", status: "active" }),
  );
  db.prepare("INSERT INTO project_server_sources VALUES (?, ?, ?)").run(
    "project-1",
    "src/main.cpp",
    JSON.stringify({ project_id: "project-1", path: "src/main.cpp", content: "void setup() {}" }),
  );
  db.close();

  const state = readLegacyProjectState(sqlitePath);
  assert.equal(state.projects.length, 1);
  assert.equal(state.sources.length, 1);
  assert.equal(state.projects[0].user_id, "user-1");
});

test("requires an explicit Project PostgreSQL secret", () => {
  assert.throws(() => requiredSecret(""), /PROJECT_POSTGRES_PASSWORD/);
  assert.equal(requiredSecret("secret"), "secret");
});

test("falls back to the former shared service SQLite when the dedicated database is empty", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "project-migration-fallback-"));
  const primaryPath = path.join(directory, "projects.sqlite");
  const fallbackPath = path.join(directory, "services.sqlite");
  const primary = new DatabaseSync(primaryPath);
  primary.exec(`
    CREATE TABLE project_server_resource_policies (
      plan_id TEXT PRIMARY KEY,
      raw_json TEXT NOT NULL
    );
  `);
  primary.prepare("INSERT INTO project_server_resource_policies VALUES (?, ?)").run(
    "free",
    JSON.stringify({ plan_id: "free", max_projects: 5 }),
  );
  primary.close();
  const fallback = new DatabaseSync(fallbackPath);
  fallback.exec(`
    CREATE TABLE service_documents (
      service_key TEXT NOT NULL,
      collection_name TEXT NOT NULL,
      document_id TEXT NOT NULL,
      document_json TEXT NOT NULL
    );
  `);
  fallback.prepare("INSERT INTO service_documents VALUES (?, ?, ?, ?)").run(
    "project-server",
    "projects",
    "project-legacy",
    JSON.stringify({ project_id: "project-legacy", user_id: "user-legacy" }),
  );
  fallback.close();

  const state = readLegacyProjectStateWithFallback(primaryPath, fallbackPath);
  assert.equal(state.projects.length, 1);
  assert.equal(state.projects[0].project_id, "project-legacy");
});
