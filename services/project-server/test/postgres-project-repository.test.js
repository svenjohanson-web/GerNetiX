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
  assert.match(pool.calls[0].text, /project_learning_progress/);
  assert.match(pool.calls[0].text, /idx_project_learning_progress_user/);
  assert.match(pool.calls[0].text, /project_versions/);
  assert.match(pool.calls[0].text, /repository_provider text/);
  assert.match(pool.calls[0].text, /idx_project_projects_repository/);
  assert.match(pool.calls[0].text, /snapshot_sha256 text/);
  assert.match(pool.calls[0].text, /idx_project_versions_parent/);
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

test("stores Forgejo binding and expected head as queryable project metadata", async () => {
  const pool = new RecordingPool();
  const repository = new PostgresProjectRepository(pool);
  await repository.saveProject({
    project_id: "project-1",
    user_id: "user-1",
    status: "active",
    repository_binding: {
      provider: "forgejo",
      repository_name: "project-hash",
      repository_id: "42",
      state: "active",
      default_branch: "main",
      head_sha: "a".repeat(40),
    },
    updated_at: "2026-08-03T10:00:00.000Z",
  });
  assert.match(pool.calls[0].text, /repository_provider=EXCLUDED\.repository_provider/);
  assert.deepEqual(pool.calls[0].values.slice(3, 9), ["forgejo", "project-hash", "42", "active", "main", "a".repeat(40)]);
});

test("stores Git-Light versions with queryable metadata and never overwrites them", async () => {
  const pool = new RecordingPool();
  const repository = new PostgresProjectRepository(pool);
  const version = {
    version_id: "version-1",
    project_id: "project-1",
    parent_version_id: "version-0",
    created_by_user_id: "user-1",
    state: "saved",
    snapshot_sha256: "a".repeat(64),
    includes_binary: true,
    created_at: "2026-07-30T10:00:00.000Z",
  };

  await repository.saveVersion(version);

  assert.match(pool.calls[0].text, /parent_version_id/);
  assert.match(pool.calls[0].text, /ON CONFLICT \(version_id\) DO NOTHING/);
  assert.deepEqual(pool.calls[0].values.slice(0, 8), [
    "version-1", "project-1", "version-0", "user-1", "saved",
    "a".repeat(64), true, "2026-07-30T10:00:00.000Z",
  ]);
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
