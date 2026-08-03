"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { InMemoryProjectRepository } = require("../src/repositories/in-memory-project-repository");
const { ProjectService } = require("../src/services/project-service");

test("provisions a repository and commits projected configuration with head compare-and-swap", async () => {
  const store = new RecordingRepositoryStore();
  const service = new ProjectService({ repository: new InMemoryProjectRepository(), projectRepositoryStore: store });
  const project = await service.createProject({
    project_id: "project-repository-test",
    user_id: "user-1",
    title: "Repository-Projekt",
    build_config: { platform: "espressif32", board: "esp32dev", framework: "arduino" },
  });
  assert.equal(project.repository_binding.state, "active");
  assert.equal(project.repository_binding.head_sha, "a".repeat(40));
  assert.ok(store.provisioned.changes.some((change) => change.path === "gernetix/project.json"));

  const updated = await service.updateProject(project.project_id, {
    expected_head_sha: project.repository_binding.head_sha,
    title: "Neuer Titel",
  });
  assert.equal(updated.repository_binding.head_sha, "b".repeat(40));
  assert.equal(updated.repository_commit.no_change, false);
  assert.ok(store.commits[0].changes.some((change) => change.path === "gernetix/project.json"));

  await assert.rejects(service.updateProject(project.project_id, {
    expected_head_sha: "a".repeat(40),
    title: "Veralteter Autor",
  }), (error) => error.code === "repository_head_conflict");
});

test("requires expected_head_sha for an atomic multi-file commit and mirrors its result into the SQL transition cache", async () => {
  const store = new RecordingRepositoryStore();
  const service = new ProjectService({ repository: new InMemoryProjectRepository(), projectRepositoryStore: store });
  const project = await service.createProject({ project_id: "project-batch", user_id: "user-1", title: "Batch" });
  await assert.rejects(service.commitRepositoryChanges(project.project_id, {
    changes: [{ path: "src/a.cpp", content: "a" }],
  }), (error) => error.code === "invalid_repository_sha");

  const result = await service.commitRepositoryChanges(project.project_id, {
    expected_head_sha: project.repository_binding.head_sha,
    message: "Zwei Dateien atomar",
    changes: [
      { path: "src/a.cpp", content: "a" },
      { path: "src/b.cpp", content: "b" },
    ],
  });
  assert.equal(result.commit.head_sha, "b".repeat(40));
  assert.equal((await service.getSource(project.project_id, "src/a.cpp")).content, "a");
  assert.equal((await service.getSource(project.project_id, "src/b.cpp")).content, "b");
});

class RecordingRepositoryStore {
  constructor() { this.commits = []; }
  async provisionProject(input) {
    this.provisioned = input;
    return {
      provider: "forgejo",
      organization: "gernetix-projects",
      repository_name: "project-test",
      repository_id: "42",
      clone_url: "http://forgejo:3000/gernetix-projects/project-test.git",
      default_branch: "main",
      head_sha: "a".repeat(40),
      state: "active",
    };
  }
  async commitChanges(_binding, input) {
    this.commits.push(input);
    const head = String.fromCharCode(97 + this.commits.length).repeat(40);
    return { head_sha: head, branch: "main", changed_paths: input.changes.map((change) => change.path), no_change: false };
  }
}
