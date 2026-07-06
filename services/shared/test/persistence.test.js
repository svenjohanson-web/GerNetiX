const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { JsonFileStore, FileBackedMapRepository, SqliteSnapshotStore } = require("../index");

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

test("SqliteSnapshotStore persists service snapshots", () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-sqlite-store-")), "state.sqlite");
  const store = new SqliteSnapshotStore(dbPath, "device-management", { defaultState: { devices: [] } });
  store.save({ devices: [{ device_id: "device-1" }] });
  store.close();

  const reloaded = new SqliteSnapshotStore(dbPath, "device-management", { defaultState: { devices: [] } });
  assert.equal(reloaded.load().devices[0].device_id, "device-1");
  reloaded.close();
});
