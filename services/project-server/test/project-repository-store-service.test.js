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
  await assert.rejects(service.commitRepositoryChanges(project.project_id, {
    expected_head_sha: project.repository_binding.head_sha,
    changes: [{ path: "gernetix/project.json", operation: "delete" }],
  }), (error) => error.code === "project_schema_manifest_missing");

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

test("reads searches renames deletes and restores only through the active repository binding", async () => {
  const store = new RecordingRepositoryStore();
  const sql = new InMemoryProjectRepository();
  const service = new ProjectService({ repository: sql, projectRepositoryStore: store });
  const project = await service.createProject({ project_id: "project-git-read", user_id: "user-1", title: "Git Read" });
  const initialHead = project.repository_binding.head_sha;
  assert.ok((await service.listSources(project.project_id)).some((source) => source.commit_sha === initialHead));
  assert.ok((await service.searchSources(project.project_id, { query: "Serial" })).length > 0);

  const renamed = await service.renameSource(project.project_id, {
    expected_head_sha: initialHead, from_path: "Komponenten/IoT-Device 1/src/main.cpp", to_path: "Komponenten/IoT-Device 1/src/Grüße.cpp",
  });
  assert.equal((await service.getSource(project.project_id, "Komponenten/IoT-Device 1/src/Grüße.cpp")).content.includes("Serial"), true);
  await assert.rejects(service.getSource(project.project_id, "Komponenten/IoT-Device 1/src/main.cpp"), (error) => error.code === "repository_file_not_found");

  const deleted = await service.deleteSource(project.project_id, "Komponenten/IoT-Device 1/src/Grüße.cpp", {
    expected_head_sha: renamed.commit.head_sha,
  });
  assert.equal(deleted.deleted, true);
  const restored = await service.restoreRepository(project.project_id, {
    expected_head_sha: deleted.commit.head_sha, restore_commit_sha: initialHead,
  });
  assert.notEqual(restored.commit.head_sha, initialHead);
  assert.equal((await service.getSource(project.project_id, "Komponenten/IoT-Device 1/src/main.cpp")).content.includes("Serial"), true);
});

test("stores active named versions as commit metadata and restores them without source snapshots", async () => {
  const store = new RecordingRepositoryStore();
  const service = new ProjectService({ repository: new InMemoryProjectRepository(), projectRepositoryStore: store });
  const project = await service.createProject({ project_id: "project-git-version", user_id: "user-1", title: "Git Version" });
  const version = await service.createVersion(project.project_id, { user_id: "user-1", message: "Freigabe" });
  assert.equal(version.commit_sha, project.repository_binding.head_sha);
  assert.equal(Object.hasOwn(version, "sources"), false);
  assert.equal(Object.hasOwn(version, "project_snapshot"), false);

  const changed = await service.commitRepositoryChanges(project.project_id, {
    expected_head_sha: project.repository_binding.head_sha,
    changes: [{ path: "README.md", content: "changed\n" }],
  });
  const restored = await service.restoreVersion(project.project_id, version.version_id, {
    user_id: "user-1", expected_head_sha: changed.commit.head_sha,
  });
  assert.equal(restored.commit_kind, "restore");
  assert.equal(restored.restored_from_version_id, version.version_id);
  assert.equal(Object.hasOwn(restored, "sources"), false);
});

test("materializes an account project from the exact active template commit", async () => {
  const store = new RecordingRepositoryStore();
  const service = new ProjectService({ repository: new InMemoryProjectRepository(), projectRepositoryStore: store });
  const template = await service.createProject({
    project_id: "template-git", user_id: "system", status: "template", title: "Git Template",
    sources: [{ path: "docs/template.md", content: "immutable template content\n" }],
  });
  const copy = await service.createProject({
    project_id: "copy-git", template_project_id: template.project_id, user_id: "user-1", title: "Copy",
  });
  assert.equal(copy.view_manifest.template_ref.commit_sha, template.repository_binding.head_sha);
  assert.equal((await service.getSource(copy.project_id, "docs/template.md")).content, "immutable template content\n");
});

test("pins a build to one repository commit and never stores source snapshots", async () => {
  const store = new RecordingRepositoryStore();
  const repository = new InMemoryProjectRepository();
  const service = new ProjectService({ repository, projectRepositoryStore: store });
  const project = await service.createProject({
    project_id: "project-commit-build", user_id: "user-1", title: "Commit Build",
    build_config: { platform: "espressif32", board: "esp32dev", framework: "arduino" },
  });
  const pinnedHead = project.repository_binding.head_sha;
  const job = await service.createBuildJob(project.project_id, { commit_sha: pinnedHead });
  assert.equal(job.repository_id, "42");
  assert.equal(job.commit_sha, pinnedHead);
  assert.equal(job.build_config, null);
  assert.equal(job.software_unit, null);

  const changed = await service.commitRepositoryChanges(project.project_id, {
    expected_head_sha: pinnedHead,
    message: "Quellcode nach BuildJob geändert",
    changes: [{ path: "Komponenten/IoT-Device 1/src/main.cpp", content: "int newer = 2;\n" }],
  });
  assert.notEqual(changed.commit.head_sha, pinnedHead);

  const firstPackage = await service.createBuildPackage(job.build_job_id);
  const secondPackage = await service.createBuildPackage(job.build_job_id);
  const repeatedJob = await service.createBuildJob(project.project_id, { commit_sha: pinnedHead });
  const repeatedPackage = await service.createBuildPackage(repeatedJob.build_job_id);
  assert.equal(firstPackage.commit_sha, pinnedHead);
  assert.equal(firstPackage.package_sha256, secondPackage.package_sha256);
  assert.equal(firstPackage.package_sha256, repeatedPackage.package_sha256,
    "jobbezogene Transportmetadaten dürfen den Build-Input-Hash nicht verändern");
  assert.equal(firstPackage.files.some((file) => file.content === "int newer = 2;\n"), false);
  const persisted = await service.getBuildJob(job.build_job_id);
  assert.equal(Object.hasOwn(persisted, "project_snapshot"), false);
  assert.equal(Object.hasOwn(persisted, "source_snapshot"), false);

  await service.recordBuildResult(job.build_job_id, { status: "succeeded", commit_sha: pinnedHead });
  const reuse = await service.buildReuseStatus(job.build_job_id);
  assert.equal(reuse.reusable, false);
  assert.equal(reuse.reason, "project_commit_changed");
  await assert.rejects(
    service.recordBuildResult(job.build_job_id, { status: "succeeded", commit_sha: "f".repeat(40) }),
    (error) => error.code === "build_result_commit_mismatch",
  );
});

test("rejects a build commit that is not reachable in the bound project repository", async () => {
  const store = new RecordingRepositoryStore();
  const service = new ProjectService({ repository: new InMemoryProjectRepository(), projectRepositoryStore: store });
  const project = await service.createProject({
    project_id: "project-missing-commit", user_id: "user-1", title: "Missing Commit",
    build_config: { platform: "espressif32", board: "esp32dev", framework: "arduino" },
  });
  await assert.rejects(
    service.createBuildJob(project.project_id, { commit_sha: "f".repeat(40) }),
    (error) => error.code === "repository_commit_not_found",
  );
});

class RecordingRepositoryStore {
  constructor() { this.commits = []; this.files = new Map(); this.snapshots = new Map(); }
  async provisionProject(input) {
    this.provisioned = input;
    for (const change of input.changes) this.files.set(change.path, change.content);
    this.snapshots.set("a".repeat(40), new Map(this.files));
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
    for (const change of input.changes) {
      if (change.operation === "delete") this.files.delete(change.path);
      else this.files.set(change.path, change.content);
    }
    const head = String.fromCharCode(97 + this.commits.length).repeat(40);
    this.snapshots.set(head, new Map(this.files));
    return { head_sha: head, branch: "main", changed_paths: input.changes.map((change) => change.path), no_change: false };
  }
  async readFile(_binding, commitSha, path) {
    const files = this.snapshots.get(commitSha);
    if (!files) {
      const error = new Error("commit not found"); error.code = "repository_commit_not_found"; throw error;
    }
    if (!files.has(path)) {
      const error = new Error("not found"); error.code = "repository_file_not_found"; throw error;
    }
    return { path, content: files.get(path), size_bytes: Buffer.byteLength(files.get(path)), blob_sha: "c".repeat(40) };
  }
  async readFiles(_binding, commitSha) {
    const files = this.snapshots.get(commitSha);
    if (!files) {
      const error = new Error("commit not found"); error.code = "repository_commit_not_found"; throw error;
    }
    return [...files].map(([path, content]) => ({ path, content, size_bytes: Buffer.byteLength(content), blob_sha: "c".repeat(40) }));
  }
  async restore(_binding, input) {
    this.files = new Map(this.snapshots.get(input.restore_commit_sha));
    this.commits.push(input);
    const head = String.fromCharCode(97 + this.commits.length).repeat(40);
    this.snapshots.set(head, new Map(this.files));
    return { head_sha: head, branch: "main", changed_paths: [...this.files.keys()], no_change: false, restored_from_commit_sha: input.restore_commit_sha };
  }
}
