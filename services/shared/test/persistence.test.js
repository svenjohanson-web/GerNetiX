const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { JsonFileStore, FileBackedMapRepository, SqliteStateStore } = require("../index");

test("JsonFileStore loads default state and persists updates", () => {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-store-")), "state.json");
  const store = new JsonFileStore(filePath, { defaultState: { items: {} } });

  assert.deepEqual(store.load(), { items: {} });
  store.save({ items: { one: { id: "one" } } });
  assert.equal(store.load().items.one.id, "one");
});

test("FileBackedMapRepository stores map collections", () => {
  const filePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-repo-")), "state.json");
  const store = new JsonFileStore(filePath, { defaultState: { questions: {} } });
  const repository = new FileBackedMapRepository(store, ["questions"]);

  repository.saveItem("questions", "q1", { question_id: "q1", title: "Test" });
  const reloaded = new FileBackedMapRepository(store, ["questions"]);

  assert.equal(reloaded.findItem("questions", "q1").title, "Test");
  assert.equal(reloaded.listItems("questions").length, 1);
});

test("SqliteStateStore persists service state as collections", () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-sqlite-store-")), "state.sqlite");
  const store = new SqliteStateStore(dbPath, "device-management", { defaultState: { devices: [] } });
  store.save({ devices: [{ device_id: "device-1" }] });
  store.close();

  const reloaded = new SqliteStateStore(dbPath, "device-management", { defaultState: { devices: [] } });
  assert.equal(reloaded.load().devices[0].device_id, "device-1");
  reloaded.close();
});

test("SqliteStateStore tracks schema, exports, backs up and restores", () => {
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gnx-sqlite-hardening-"));
  const dbPath = path.join(runtimeRoot, "state.sqlite");
  const backupPath = path.join(runtimeRoot, "backup.sqlite");
  const restoredPath = path.join(runtimeRoot, "restored.sqlite");
  const store = new SqliteStateStore(dbPath, "project-server", {
    defaultState: { projects: [] },
    collectionMap: { projects: "projects" },
  });

  store.ensureSchema([
    "CREATE TABLE IF NOT EXISTS test_schema_marker (id TEXT PRIMARY KEY);",
  ], { namespace: "test-schema", version: 3 });
  store.replaceCollection("projects", [{ project_id: "project-1", title: "Demo", device_secret: "secret", password_hash: "hash" }], "project_id");
  assert.equal(store.load().projects[0].title, "Demo");

  assert.equal(store.schemaVersion("test-schema"), 3);
  assert.equal(store.load().projects[0].project_id, "project-1");
  const exported = store.exportJson();
  assert.equal(exported.service_documents[0].document.project_id, "project-1");
  assert.equal(exported.service_documents[0].document.device_secret, "[redacted]");
  assert.equal(exported.service_documents[0].document.password_hash, "[redacted]");

  store.backupTo(backupPath);
  store.close();

  SqliteStateStore.restoreBackup(backupPath, restoredPath);
  const restored = new SqliteStateStore(restoredPath, "project-server", {
    defaultState: { projects: [] },
    collectionMap: { projects: "projects" },
  });
  assert.equal(restored.load().projects[0].project_id, "project-1");
  restored.close();
});
