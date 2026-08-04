"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const nexiCourse = require("../../identity-server/src/dev/project-models/nexi-course.json");
const { FileBackedProjectRepository } = require("../src/repositories/file-backed-project-repository");
const { ProjectService } = require("../src/services/project-service");

test("starts Nexi, persists its Project-App settings and resumes them after a reload", async () => {
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-nexi-e2e-"));
  try {
    const accountId = "account-nexi-e2e";
    const projectId = "learning-nexi-e2e";
    const service = new ProjectService({ repository: FileBackedProjectRepository.create(runtimeRoot) });
    const created = await service.createProject({
      project_id: projectId,
      user_id: accountId,
      title: nexiCourse.project.title,
      description: nexiCourse.project.summary,
      learning_project_id: "learning_project.nexi_voice_assistant",
      hardware_profile_id: nexiCourse.project.hardware_profile_id,
      sources: nexiCourse.sources,
    });

    assert.ok(created.source_files.some((source) => source.path === "project-app/manifest.json"));
    const initial = await service.getProjectAppSettings(projectId, accountId);
    assert.equal(initial.manifest.app_id, "nexi");
    assert.equal(initial.values.cloud_enabled, false);
    assert.equal(initial.values.voice, "warm");

    const saved = await service.updateProjectAppSettings(projectId, {
      account_id: accountId,
      manifest_version: initial.manifest_version,
      expected_revision: initial.revision,
      values: { cloud_enabled: true, voice: "calm" },
    });
    assert.equal(saved.revision, 1);

    const resumedService = new ProjectService({ repository: FileBackedProjectRepository.create(runtimeRoot) });
    const resumed = await resumedService.getProjectAppSettings(projectId, accountId);
    assert.equal(resumed.revision, 1);
    assert.equal(resumed.values.cloud_enabled, true);
    assert.equal(resumed.values.voice, "calm");
    assert.equal(JSON.parse((await resumedService.getSource(projectId, "project-app/manifest.json")).content).manifest_version, 1);
  } finally {
    fs.rmSync(runtimeRoot, { recursive: true, force: true });
  }
});

test("never exposes source contents in project summaries", async () => {
  const service = new ProjectService({ repository: new (require("../src/repositories/in-memory-project-repository").InMemoryProjectRepository)() });
  const created = await service.createProject({
    project_id: "project-summary-contract",
    user_id: "account-summary-contract",
    title: "Summary contract",
    sources: [{ path: "project-app/manifest.json", role: "project_app_manifest", content: "secret-content" }],
  });
  assert.deepEqual(created.source_files.find((source) => source.path === "project-app/manifest.json"), {
    path: "project-app/manifest.json",
    role: "project_app_manifest",
  });
  assert.equal(created.source_files.every((source) => Object.keys(source).sort().join(",") === "path,role"), true);
  assert.equal(JSON.stringify(created).includes("secret-content"), false);
});
