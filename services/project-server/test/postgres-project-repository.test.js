const assert = require("node:assert/strict");
const test = require("node:test");
const { PostgresProjectRepository } = require("../src/repositories/postgres-project-repository");

test("creates separated project tables with cascading ownership", async () => {
  const pool = new RecordingPool();
  const repository = new PostgresProjectRepository(pool);

  await repository.ensureSchema();

  assert.match(pool.calls[0].text, /CREATE TABLE IF NOT EXISTS project_projects/);
  assert.match(pool.calls[0].text, /project_sources/);
  assert.match(pool.calls[0].text, /REFERENCES project_projects\(project_id\) ON DELETE CASCADE/);
  assert.match(pool.calls[0].text, /project_resource_policies/);
});

test("stores projects and sources as queryable ownership plus JSON documents", async () => {
  const pool = new RecordingPool();
  const repository = new PostgresProjectRepository(pool);
  const project = {
    project_id: "project-1",
    user_id: "user-1",
    status: "active",
    updated_at: "2026-07-23T10:00:00.000Z",
  };
  const source = {
    project_id: "project-1",
    path: "src/main.cpp",
    content: "void setup() {}",
    updated_at: "2026-07-23T10:01:00.000Z",
  };

  await repository.saveProject(project);
  await repository.saveSource(source);

  assert.deepEqual(pool.calls[0].values.slice(0, 3), ["project-1", "user-1", "active"]);
  assert.deepEqual(pool.calls[1].values.slice(0, 2), ["project-1", "src/main.cpp"]);
});

class RecordingPool {
  constructor() {
    this.calls = [];
  }

  async query(text, values = []) {
    this.calls.push({ text, values });
    return { rows: [], rowCount: 1 };
  }
}
