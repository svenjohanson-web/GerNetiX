const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { PersistenceService } = require("../src");

test("stores and reloads service state in sqlite collections", () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-persistence-server-")), "state.sqlite");
  const service = new PersistenceService({ dbPath });

  service.putState("project-server", {
    state: {
      projects: [{ project_id: "project-1" }],
    },
  });

  const state = service.getState("project-server");
  assert.equal(state.state.projects[0].project_id, "project-1");
});

test("exports and backs up sqlite persistence database", () => {
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gnx-persistence-backup-"));
  const dbPath = path.join(runtimeRoot, "state.sqlite");
  const backupPath = path.join(runtimeRoot, "backup.sqlite");
  const service = new PersistenceService({ dbPath });

  service.putState("identity-server", {
    state: {
      userAccounts: [{ id: "usr-1" }],
    },
  });

  const exported = service.exportDatabase();
  assert.equal(exported.service_documents[0].service_key, "identity-server");

  const backup = service.backupDatabase(backupPath);
  assert.equal(backup.backup_path, backupPath);
  assert.equal(fs.existsSync(backupPath), true);
});
