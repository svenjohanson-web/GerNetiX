"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
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
  assert.match(updated.repository_commit.summary, /Projektdatei/);
  assert.ok(store.commits[0].changes.some((change) => change.path === "gernetix/project.json"));

  await assert.rejects(service.updateProject(project.project_id, {
    expected_head_sha: "a".repeat(40),
    title: "Veralteter Autor",
  }), (error) => error.code === "repository_head_conflict");
});

test("archives the private Forgejo repository before deleting its project metadata", async () => {
  const store = new RecordingRepositoryStore();
  const repository = new InMemoryProjectRepository();
  const service = new ProjectService({ repository, projectRepositoryStore: store });
  const project = await service.createProject({ project_id: "project-delete", user_id: "user-1", title: "Delete" });

  const result = await service.deleteProject(project.project_id);

  assert.equal(store.archived.length, 1);
  assert.equal(store.archived[0].repository_id, "42");
  assert.equal(result.repository_archive.state, "archived");
  await assert.rejects(service.getProject(project.project_id), (error) => error.code === "project_not_found");
});

test("requires expected_head_sha for an atomic multi-file commit without writing a SQL source cache", async () => {
  const store = new RecordingRepositoryStore();
  const repository = new InMemoryProjectRepository();
  const service = new ProjectService({ repository, projectRepositoryStore: store });
  const project = await service.createProject({ project_id: "project-batch", user_id: "user-1", title: "Batch" });
  assert.equal(repository.sources.size, 0, "Aktive Forgejo-Projekte dürfen keine SQL-Quellkopie anlegen");
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
  assert.equal(repository.sources.size, 0, "Auch bestätigte Commits dürfen keine SQL-Quellkopie schreiben");
  assert.equal((await service.getSource(project.project_id, "src/a.cpp")).content, "a");
  assert.equal((await service.getSource(project.project_id, "src/b.cpp")).content, "b");
});

test("never calls SQL source persistence for an active Forgejo project", async () => {
  const store = new RecordingRepositoryStore();
  const repository = new SourceWriteGuardRepository();
  const service = new ProjectService({ repository, projectRepositoryStore: store });
  const project = await service.createProject({
    project_id: "project-source-guard", user_id: "user-guard", title: "Source Guard",
    build_config: { platform: "espressif32", board: "esp32dev", framework: "arduino" },
  });
  const updated = await service.updateProject(project.project_id, {
    expected_head_sha: project.repository_binding.head_sha,
    description: "Konfiguration nur über Git aktualisiert",
  });
  await service.commitRepositoryChanges(project.project_id, {
    expected_head_sha: updated.repository_binding.head_sha,
    changes: [{ path: "docs/source-of-truth.md", content: "Forgejo\n" }],
  });
  assert.equal(repository.sourceAccesses, 0);
});

test("blocks SQL source fallback for an unbound project while Forgejo runtime is active", async () => {
  const repository = new InMemoryProjectRepository();
  const legacyService = new ProjectService({ repository });
  await legacyService.createProject({
    project_id: "project-unbound-legacy", user_id: "user-legacy", title: "Legacy ohne Bindung",
    build_config: { platform: "espressif32", board: "esp32dev", framework: "arduino" },
  });
  for (const method of ["saveSource", "findSource", "listSources", "deleteSource"]) {
    repository[method] = async () => { throw new Error(`unexpected_sql_source_access:${method}`); };
  }
  const service = new ProjectService({ repository, projectRepositoryStore: new RecordingRepositoryStore() });
  const project = await service.getProject("project-unbound-legacy");
  assert.equal(project.source_count, 0);
  const actions = [
    () => service.listSources(project.project_id),
    () => service.searchSources(project.project_id, { query: "setup" }),
    () => service.getSource(project.project_id, "src/main.cpp"),
    () => service.upsertSource(project.project_id, { path: "src/main.cpp", content: "void setup() {}" }),
    () => service.deleteSource(project.project_id, "src/main.cpp"),
    () => service.updateProject(project.project_id, { title: "Kein SQL-Fallback" }),
    () => service.createVersion(project.project_id, { user_id: "user-legacy" }),
    () => service.createBuildJob(project.project_id),
    () => service.startDebugSession(project.project_id),
  ];
  for (const action of actions) {
    await assert.rejects(action(), (error) => error.code === "repository_not_active");
  }
});

test("commits board, basis, peripheral, web and communication dialogs end-to-end into one reproducible build", async () => {
  const store = new RecordingRepositoryStore();
  const repository = new SourceWriteGuardRepository();
  const service = new ProjectService({ repository, projectRepositoryStore: store });
  let project = await service.createProject({
    project_id: "project-dialog-e2e", user_id: "user-dialog", title: "Dialog E2E",
    build_config: { platform: "espressif32", board: "esp32dev", framework: "arduino" },
  });
  const steps = [
    (current) => {
      const board = { source: "project", name: "Dialog Board", base_board_profile_id: "hardware.processor_board.generic_esp_wroom32", board_features: { display: { enabled: true, driver: "ili9341", connection: "spi", pins: { cs: 5 } } } };
      return {
        build_config: { ...current.build_config, board_configuration: board },
        view_manifest: { ...current.view_manifest, views: [{ id: "hardware-configuration", type: "hardware_configuration", payload: { schema_version: 1, components: [{ component_id: "iot_device_1", component_path: "Komponenten/IoT-Device 1", label: "IoT-Device 1", abstract_type: "iot_device", board_configuration: board }] } }] },
      };
    },
    (current) => ({ build_config: { ...current.build_config, basissoftware_configuration: { schema_version: 1, wifi: { enabled: true, mode: "station" }, mqtt: { enabled: false } } } }),
    (current) => ({ build_config: { ...current.build_config, component_hardware_features: { iot_device_1: { enabled: ["adc", "pwm"] } } } }),
    (current) => ({ build_config: { ...current.build_config, component_features: { enabled: ["webserver"], webserver: { title: "Dialog-Webserver" } } } }),
    (current) => ({ view_manifest: { ...current.view_manifest, communication_setup: { schema_version: 2, mode: "device_access_point", access_point: { ssid: "Dialog-Netz", password: "runtime-secret" } } } }),
  ];
  const stepResults = [];
  for (const step of steps) {
    project = await service.updateProject(project.project_id, { ...step(project), expected_head_sha: project.repository_binding.head_sha });
    stepResults.push(project.repository_commit.no_change);
  }
  assert.ok(stepResults.filter((noChange) => !noChange).length >= 4, `Unerwartete Dialogergebnisse: ${stepResults.join(",")}`);
  const commitCount = store.commits.length;
  const unchanged = await service.updateProject(project.project_id, {
    expected_head_sha: project.repository_binding.head_sha,
    view_manifest: project.view_manifest,
  });
  assert.equal(unchanged.repository_commit.no_change, true);
  assert.equal(unchanged.repository_commit.summary, "Keine Projektdatei geändert");
  assert.equal(store.commits.length, commitCount);

  const job = await service.createBuildJob(project.project_id, { commit_sha: project.repository_binding.head_sha });
  const buildPackage = await service.createBuildPackage(job.build_job_id);
  const byPath = new Map(buildPackage.files.map((file) => [file.path, file.content]));
  const softwareFeatures = buildPackage.files.find((file) => file.path.startsWith("gernetix/configuration/software-features/"));
  assert.match(byPath.get("gernetix/configuration/communication.json"), /Dialog-Netz/);
  assert.match(softwareFeatures?.content, /Dialog-Webserver/);
  assert.match(byPath.get("gernetix/configuration/board-peripherals/iot_device_1.json"), /pwm/);
  assert.match(byPath.get("gernetix/hardware/boards/iot_device_1.json"), /Dialog Board/);
  assert.equal(repository.sourceAccesses, 0);
});

test("reads searches renames deletes and restores only through the active repository binding", async () => {
  const store = new RecordingRepositoryStore();
  const sql = new InMemoryProjectRepository();
  const service = new ProjectService({ repository: sql, projectRepositoryStore: store });
  const project = await service.createProject({ project_id: "project-git-read", user_id: "user-1", title: "Git Read" });
  const initialHead = project.repository_binding.head_sha;
  assert.ok((await service.listSources(project.project_id)).some((source) => source.commit_sha === initialHead));
  assert.equal(store.treeReads, 1);
  assert.equal(store.fullReads, 0, "Der IDE-Dateibaum darf keine Git-Dateiinhalte lesen");
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

test("rejects a build when a generated repository file drifts from its commit configuration", async () => {
  const store = new RecordingRepositoryStore();
  const service = new ProjectService({ repository: new InMemoryProjectRepository(), projectRepositoryStore: store });
  const project = await service.createProject({
    project_id: "project-build-drift", user_id: "user-1", title: "Build Drift",
    build_config: { platform: "espressif32", board: "esp32dev", framework: "arduino" },
  });
  const platformioPath = (await service.listSources(project.project_id)).find((source) => source.path.endsWith("/platformio.ini")).path;
  const changed = await service.commitRepositoryChanges(project.project_id, {
    expected_head_sha: project.repository_binding.head_sha,
    message: "Erzeugte Builddatei absichtlich widersprüchlich machen",
    changes: [{ path: platformioPath, content: "[env:manipulated]\nplatform = native\n" }],
  });
  const job = await service.createBuildJob(project.project_id, { commit_sha: changed.commit.head_sha });
  await assert.rejects(
    service.createBuildPackage(job.build_job_id),
    (error) => error.code === "build_configuration_drift"
      && error.status === 409
      && error.details.drifted_paths.includes(platformioPath),
  );
});

test("builds an IoT template from one canonical board snapshot when the hardware view omits its name", async () => {
  const store = new RecordingRepositoryStore();
  const service = new ProjectService({ repository: new InMemoryProjectRepository(), projectRepositoryStore: store });
  const boardConfiguration = {
    schema_version: 1,
    source: "catalog",
    name: "ESP32-S3 ES3C28P Touch-Board",
    base_board_profile_id: "hardware.processor_board.esp32_s3_es3c28p",
    board_features: { display: { enabled: true, hardware: "tft_lcd", driver: "ili9341", connection: "spi", pins: { cs: 10 }, value: "" } },
  };
  const project = await service.createProject({
    project_id: "project-board-snapshot",
    user_id: "user-1",
    title: "IoT-Device only",
    build_config: { platform: "espressif32", board: "esp32-s3-devkitc-1", framework: "arduino", board_configuration: boardConfiguration },
    view_manifest: {
      views: [{
        id: "hardware-configuration",
        type: "hardware_configuration",
        payload: {
          schema_version: 6,
          components: [{
            component_id: "device",
            component_path: "Komponenten/IoT-Device 1",
            label: "IoT-Device 1",
            abstract_type: "iot_device",
            board_configuration: { ...boardConfiguration, name: "" },
          }],
        },
      }],
    },
  });
  const boardPath = (await service.listSources(project.project_id))
    .find((source) => source.path.startsWith("gernetix/hardware/boards/")).path;
  const boardDocument = JSON.parse((await service.getSource(project.project_id, boardPath)).content);
  const job = await service.createBuildJob(project.project_id, { commit_sha: project.repository_binding.head_sha });

  assert.equal(boardDocument.name, boardConfiguration.name);
  await assert.doesNotReject(service.createBuildPackage(job.build_job_id));
});

test("pins a complex board support release while standard PlatformIO boards stay repository-free", async () => {
  const approvedCommit = "d".repeat(40);
  const store = new RecordingRepositoryStore();
  store.protectedFiles = boardSupportFixture();
  const service = new ProjectService({
    repository: new InMemoryProjectRepository(),
    projectRepositoryStore: store,
    systemRepositories: [{
      source_id: "gernetix-board-support-esp32-s3-es3c28p",
      title: "Board-Support ESP32-S3 ES3C28P",
      kind: "board_support",
      provider: "forgejo",
      organization: "gernetix-platform",
      repository_name: "board-support-esp32-s3-es3c28p",
      commit_sha: approvedCommit,
      manifest_path: "gernetix/board-support.json",
      hardware_item_id: "hardware.processor_board.esp32_s3_es3c28p",
      release_version: "1.0.0",
    }],
  });
  const standard = await service.createProject({
    project_id: "project-standard-board", user_id: "user-1", title: "Standard",
    build_config: { platform: "espressif32", board: "esp32dev", framework: "arduino" },
  });
  assert.equal(standard.build_config.board_support_reference, null);

  const project = await service.createProject({
    project_id: "project-board-support", user_id: "user-1", title: "ES3C28P",
    build_config: {
      platform: "espressif32", board: "es3c28p", framework: "arduino",
      board_support_source_id: "gernetix-board-support-esp32-s3-es3c28p",
      board_configuration: { source: "catalog", base_board_profile_id: "hardware.processor_board.esp32_s3_es3c28p" },
    },
    view_manifest: { views: [{
      id: "hardware-configuration", type: "hardware_configuration",
      payload: { schema_version: 1, components: [{
        component_id: "iot-device_1", component_path: "Komponenten/IoT-Device 1", label: "IoT-Device 1", abstract_type: "iot_device",
        board_configuration: { source: "catalog", base_board_profile_id: "hardware.processor_board.esp32_s3_es3c28p" },
      }] },
    }] },
  });
  assert.equal(project.build_config.board_support_reference.commit_sha, approvedCommit);
  const boardSnapshot = JSON.parse((await service.getSource(project.project_id, "gernetix/hardware/boards/iot-device_1.json")).content);
  assert.equal(boardSnapshot.board_support_release.commit_sha, approvedCommit);
  const job = await service.createBuildJob(project.project_id, { commit_sha: project.repository_binding.head_sha });
  const buildPackage = await service.createBuildPackage(job.build_job_id);
  assert.ok(buildPackage.files.some((file) => file.path === "boards/es3c28p.json"));
  assert.ok(buildPackage.files.some((file) => file.path === "partitions_full_16mb.csv"));
  assert.equal(store.protectedReads[0].commit_sha, approvedCommit);
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

test("checks account storage before Forgejo commits and repository restores", async () => {
  const store = new RecordingRepositoryStore();
  const repository = new InMemoryProjectRepository();
  const service = new ProjectService({ repository, projectRepositoryStore: store });
  await service.updateResourcePolicy("free", { max_storage_bytes: 0, change_reason: "Forgejo-Quotentest vorbereiten" });
  await service.createProject({ project_id: "quota-repository-peer", user_id: "quota-repository-user", title: "Peer" });
  const project = await service.createProject({ project_id: "quota-repository-main", user_id: "quota-repository-user", title: "Main" });
  const large = await service.commitRepositoryChanges(project.project_id, {
    expected_head_sha: project.repository_binding.head_sha,
    changes: [{ path: "large.txt", content: "0123456789" }],
  });
  const small = await service.commitRepositoryChanges(project.project_id, {
    expected_head_sha: large.commit.head_sha,
    changes: [{ path: "large.txt", content: "x" }],
  });
  const currentBytes = (await service.resourceSummary()).accounts
    .find((account) => account.account_id === "quota-repository-user").storage_bytes;
  await service.updateResourcePolicy("free", { max_storage_bytes: currentBytes, change_reason: "Kein weiteres Wachstum erlauben" });
  const commitsBeforeRejectedWrite = store.commits.length;

  await assert.rejects(service.commitRepositoryChanges(project.project_id, {
    expected_head_sha: small.commit.head_sha,
    changes: [{ path: "new.txt", content: "grow" }],
  }), (error) => error.code === "storage_quota_exceeded");
  assert.equal(store.commits.length, commitsBeforeRejectedWrite, "Quota-Prüfung muss vor dem Forgejo-Commit erfolgen");

  await assert.rejects(service.restoreRepository(project.project_id, {
    expected_head_sha: small.commit.head_sha,
    restore_commit_sha: large.commit.head_sha,
  }), (error) => error.code === "storage_quota_exceeded");
  assert.equal(store.commits.length, commitsBeforeRejectedWrite, "Quota-Prüfung muss vor dem Forgejo-Restore erfolgen");
});

test("does not leave a failed project record when initial Forgejo quota admission rejects it", async () => {
  const store = new RecordingRepositoryStore();
  const repository = new InMemoryProjectRepository();
  const service = new ProjectService({ repository, projectRepositoryStore: store });
  await service.updateResourcePolicy("free", { max_storage_bytes: 1, change_reason: "Initiale Forgejo-Aufnahme ablehnen" });
  await assert.rejects(service.createProject({ project_id: "quota-create-rejected", user_id: "quota-create-user", title: "Zu gross" }), (error) => error.code === "storage_quota_exceeded");
  assert.equal(await repository.findProject("quota-create-rejected"), null);
  assert.equal(store.provisioned, undefined, "Quota muss vor der Forgejo-Provisionierung greifen");
});

class RecordingRepositoryStore {
  constructor() { this.commits = []; this.files = new Map(); this.snapshots = new Map(); this.treeReads = 0; this.fullReads = 0; this.archived = []; this.protectedFiles = []; this.protectedReads = []; }
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
    this.fullReads += 1;
    const files = this.snapshots.get(commitSha);
    if (!files) {
      const error = new Error("commit not found"); error.code = "repository_commit_not_found"; throw error;
    }
    return [...files].map(([path, content]) => ({ path, content, size_bytes: Buffer.byteLength(content), blob_sha: "c".repeat(40) }));
  }
  async tree(_binding, commitSha) {
    this.treeReads += 1;
    const files = this.snapshots.get(commitSha);
    if (!files) {
      const error = new Error("commit not found"); error.code = "repository_commit_not_found"; throw error;
    }
    return [...files.keys()].sort();
  }
  async restore(_binding, input) {
    this.files = new Map(this.snapshots.get(input.restore_commit_sha));
    this.commits.push(input);
    const head = String.fromCharCode(97 + this.commits.length).repeat(40);
    this.snapshots.set(head, new Map(this.files));
    return { head_sha: head, branch: "main", changed_paths: [...this.files.keys()], no_change: false, restored_from_commit_sha: input.restore_commit_sha };
  }
  async archive(binding) {
    this.archived.push(binding);
    return { ...binding, state: "archived" };
  }
  async readProtectedFiles(reference) {
    this.protectedReads.push(reference);
    return structuredClone(this.protectedFiles);
  }
}

class SourceWriteGuardRepository extends InMemoryProjectRepository {
  constructor() { super(); this.sourceAccesses = 0; }
  sourceAccess() { this.sourceAccesses += 1; throw new Error("active_forgejo_sql_source_access"); }
  saveSource() { return this.sourceAccess(); }
  findSource() { return this.sourceAccess(); }
  listSources() { return this.sourceAccess(); }
  deleteSource() { return this.sourceAccess(); }
}

function boardSupportFixture() {
  const entries = [
    { path: "boards/es3c28p.json", target_path: "boards/es3c28p.json", role: "board_definition", content: "{\"name\":\"ES3C28P\"}\n" },
    { path: "partitions/partitions_full_16mb.csv", target_path: "partitions_full_16mb.csv", role: "partition_table", content: "nvs,data,nvs,0x9000,0x5000\n" },
  ];
  const manifest = {
    schema_id: "gernetix.board-support",
    schema_version: 1,
    hardware_item_id: "hardware.processor_board.esp32_s3_es3c28p",
    release_version: "1.0.0",
    files: entries.map((entry) => ({
      path: entry.path,
      target_path: entry.target_path,
      role: entry.role,
      sha256: crypto.createHash("sha256").update(entry.content).digest("hex"),
    })),
  };
  return [
    { path: "gernetix/board-support.json", content: `${JSON.stringify(manifest)}\n` },
    ...entries.map((entry) => ({ path: entry.path, content: entry.content })),
  ];
}
