const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { PersistenceService } = require("../src");

test("stores and reloads service snapshots in sqlite", () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-persistence-server-")), "state.sqlite");
  const service = new PersistenceService({ dbPath });

  service.putSnapshot("project-server", {
    state: {
      projects: [{ project_id: "project-1" }],
    },
  });

  const snapshot = service.getSnapshot("project-server");
  assert.equal(snapshot.state.projects[0].project_id, "project-1");
});
