"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { createNexiCourseModel } = require("../../identity-server/src/dev/project-models/nexi-course");
const { FileBackedProjectRepository } = require("../src/repositories/file-backed-project-repository");
const { ProjectService } = require("../src/services/project-service");

test("starts Nexi, persists its Project-App settings and resumes them after a reload", async () => {
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-nexi-e2e-"));
  try {
    const accountId = "account-nexi-e2e";
    const projectId = "learning-nexi-e2e";
    const model = createNexiCourseModel();
    const definition = model.createProject(
      (slug, title, area, summary, steps, options) => ({ slug, title, area, summary, steps, ...options }),
      (title, text, insight) => ({ title, text, insight }),
    );
    const approvedCommit = "c".repeat(40);
    const productStore = {
      readProtectedFiles: async () => [
        { path: "voice_lab.cpp", content: "void userSetup() { nexi::ApplicationManager app; }\n" },
        { path: "src/project_entry.cpp", content: "extern \"C\" void onProjectInit() {}\n" },
        { path: "include/nexi/voice_types.h", content: "enum class VoiceEffect { Robot, Echo, };\n" },
        { path: "gernetix/system-repository.json", content: "{}\n" },
      ],
      provisionProject: async () => ({}),
    };
    const serviceOptions = {
      projectRepositoryStore: productStore,
      systemRepositories: [{
        source_id: "gernetix-product-nexi", title: "Nexi", kind: "product", provider: "forgejo",
        organization: "gernetix-products", repository_name: "nexi", default_branch: "main",
        commit_sha: approvedCommit, protected: true,
        materialization: {
          target_root: "Komponenten/IoT-Device 1",
          path_mappings: { "voice_lab.cpp": "src/user_main.cpp" },
          excluded_paths: ["gernetix/system-repository.json"],
        },
      }],
    };
    const service = new ProjectService({ repository: FileBackedProjectRepository.create(runtimeRoot), ...serviceOptions });
    const created = await service.createProject({
      project_id: projectId,
      user_id: accountId,
      title: definition.title,
      description: definition.summary,
      learning_project_id: "learning_project.nexi_voice_assistant",
      hardware_profile_id: definition.hardware_profile_id,
      device_ids: ["nexi-living-room", "nexi-child-room"],
      build_config: definition.build_config,
      system_source_id: definition.system_source_id,
      sources: model.createSources(),
    });

    assert.ok(created.source_files.some((source) => source.path === "project-app/manifest.json"));
    assert.ok(created.source_files.some((source) => source.path === definition.build_config.user_source_path));
    assert.equal(created.build_config.environment, "waveshare_esp32_s3_audio_board");
    assert.equal(created.build_config.flash_size_mb, 16);
    assert.equal(created.build_config.firmware_basis_id, "gernetix-runtime-basissoftware");
    assert.equal(created.view_manifest.product_source_reference.commit_sha, approvedCommit);
    assert.equal(created.view_manifest.product_source_reference.repository_name, "nexi");
    assert.equal(created.source_files.some((source) => source.path.endsWith("gernetix/system-repository.json")), false);
    assert.match((await service.getSource(projectId, definition.build_config.user_source_path)).content, /nexi::ApplicationManager/);
    assert.match((await service.getSource(
      projectId,
      "Komponenten/IoT-Device 1/include/nexi/voice_types.h",
    )).content, /enum class VoiceEffect[\s\S]*\bEcho,/);
    const initial = await service.getProjectAppSettings(projectId, accountId);
    assert.equal(initial.manifest.app_id, "nexi");
    assert.equal(initial.values.cloud_enabled, false);
    assert.equal(initial.values.voice, "warm");
    assert.deepEqual(initial.assigned_device_ids, ["nexi-living-room", "nexi-child-room"]);

    const saved = await service.updateProjectAppSettings(projectId, {
      account_id: accountId,
      manifest_version: initial.manifest_version,
      expected_revision: initial.revision,
      values: { cloud_enabled: true, voice: "calm" },
    });
    assert.equal(saved.revision, 1);
    await service.updateProjectAppDevices(projectId, {
      account_id: accountId,
      device_ids: ["nexi-child-room", "nexi-travel"],
    });

    const resumedService = new ProjectService({ repository: FileBackedProjectRepository.create(runtimeRoot), ...serviceOptions });
    const resumed = await resumedService.getProjectAppSettings(projectId, accountId);
    assert.equal(resumed.revision, 1);
    assert.equal(resumed.values.cloud_enabled, true);
    assert.equal(resumed.values.voice, "calm");
    assert.deepEqual(resumed.assigned_device_ids, ["nexi-child-room", "nexi-travel"]);
    const resumedManifest = JSON.parse((await resumedService.getSource(projectId, "project-app/manifest.json")).content);
    assert.equal(resumedManifest.manifest_version, 3);
    assert.equal(resumedManifest.hardware_requirements.processor_variant, "ESP32-S3");
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
