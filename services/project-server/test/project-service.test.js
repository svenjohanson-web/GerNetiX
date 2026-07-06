const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const test = require("node:test");

const { createDefaultProjectServer, FileBackedProjectRepository, SqliteBackedProjectRepository } = require("../src");
const { ProjectService } = require("../src/services/project-service");

function createDemoProject(service) {
  return service.createProject({
    user_id: "user-1",
    title: "ESP32 Lernprojekt",
    description: "Blinken und OTA lernen",
    learning_project_id: "learning_project.esp32_ota_bootstrap",
    hardware_profile_id: "hardware.processor_board.esp32_devkit",
    device_id: "device-1",
    build_config: {
      platform: "espressif32",
      board: "esp32dev",
      framework: "arduino",
      libraries: ["bblanchon/ArduinoJson"],
    },
  });
}

test("creates project with default source and lists it by user", () => {
  const service = createDefaultProjectServer();
  const project = createDemoProject(service);

  assert.equal(project.user_id, "user-1");
  assert.equal(project.source_count, 1);
  assert.equal(service.listProjects({ user_id: "user-1" }).length, 1);
});

test("stores project sources with hashes and rejects path traversal", () => {
  const service = createDefaultProjectServer();
  const project = createDemoProject(service);
  const source = service.upsertSource(project.project_id, {
    path: "include/settings.h",
    content: "#define GNX 1\n",
  });

  assert.equal(source.role, "header");
  assert.equal(source.content_sha256.length, 64);
  assert.throws(() => service.upsertSource(project.project_id, { path: "../secret.txt", content: "x" }), /Source-Pfad/);
});

test("creates reproducible build package for build deploy server", () => {
  const service = createDefaultProjectServer();
  const project = createDemoProject(service);
  service.upsertSource(project.project_id, {
    path: "src/app.cpp",
    content: "void app() {}\n",
  });
  const job = service.createBuildJob(project.project_id, { mode: "build_and_flash" });
  const buildPackage = service.createBuildPackage(job.build_job_id);

  assert.equal(buildPackage.build_job.mode, "build_and_flash");
  assert.equal(buildPackage.files.some((file) => file.path === "platformio.ini"), true);
  assert.equal(buildPackage.files.some((file) => file.path === "src/app.cpp"), true);
});

test("records build result and firmware artifacts in project history", () => {
  const service = createDefaultProjectServer();
  const project = createDemoProject(service);
  const job = service.createBuildJob(project.project_id);
  service.markBuildSubmitted(job.build_job_id, { build_deploy_job_id: "bd-1" });

  const result = service.recordBuildResult(job.build_job_id, {
    status: "succeeded",
    artifacts: [{ file_name: "firmware.bin", url: "http://127.0.0.1/artifacts/job/firmware.bin", sha256: "abc" }],
  });
  const artifacts = service.listArtifacts({ project_id: project.project_id });

  assert.equal(result.status, "succeeded");
  assert.equal(artifacts[0].file_name, "firmware.bin");
});

test("feedback hides contact data until explicit feedback consent exists", () => {
  const service = createDefaultProjectServer();
  const project = createDemoProject(service);
  const feedback = service.createFeedback({
    project_id: project.project_id,
    message: "Ich haenge bei OTA.",
    contact_mode: "email",
    contact_email: "sven@example.test",
  });

  assert.equal(feedback.contact_email, "");
  service.createFeedbackConsent(feedback.feedback_id, { valid_until: "2099-01-01T00:00:00.000Z" });
  const visible = service.listFeedback({ project_id: project.project_id })[0];
  assert.equal(visible.contact_email, "sven@example.test");
});

test("anonymizes expired feedback after maximum retention window", () => {
  const service = createDefaultProjectServer();
  const project = createDemoProject(service);
  service.createFeedback({
    project_id: project.project_id,
    user_id: "user-1",
    message: "Bitte anonymisieren.",
    contact_email: "sven@example.test",
    anonymize_after: "2020-01-01T00:00:00.000Z",
  });

  const anonymized = service.anonymizeExpiredFeedback(new Date("2026-01-01T00:00:00.000Z"));
  assert.equal(anonymized[0].user_id, "anonymous");
  assert.equal(anonymized[0].contact_email, "");
});

test("json repository persists projects, sources and build jobs across reload", () => {
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gnx-project-server-"));
  const service = new ProjectService({
    repository: FileBackedProjectRepository.create(runtimeRoot),
  });
  const project = createDemoProject(service);
  const job = service.createBuildJob(project.project_id, { mode: "prebuild" });

  const reloaded = new ProjectService({
    repository: FileBackedProjectRepository.create(runtimeRoot),
  });

  assert.equal(reloaded.getProject(project.project_id).title, "ESP32 Lernprojekt");
  assert.equal(reloaded.listSources(project.project_id).length, 1);
  assert.equal(reloaded.getBuildJob(job.build_job_id).mode, "prebuild");
});

test("sqlite repository persists projects, sources and build jobs across reload", () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-project-server-sqlite-")), "state.sqlite");
  const service = new ProjectService({
    repository: SqliteBackedProjectRepository.create(dbPath),
  });
  const project = createDemoProject(service);
  const job = service.createBuildJob(project.project_id, { mode: "prebuild" });

  const reloaded = new ProjectService({
    repository: SqliteBackedProjectRepository.create(dbPath),
  });

  assert.equal(reloaded.getProject(project.project_id).title, "ESP32 Lernprojekt");
  assert.equal(reloaded.listSources(project.project_id).length, 1);
  assert.equal(reloaded.getBuildJob(job.build_job_id).mode, "prebuild");

  const db = new DatabaseSync(dbPath);
  assert.equal(collectionCount(db, "project-server", "projects"), 1);
  assert.equal(collectionCount(db, "project-server", "sources"), 1);
  assert.equal(collectionCount(db, "project-server", "build_jobs"), 1);
  assert.equal(tableCount(db, "project_server_projects"), 1);
  assert.equal(tableCount(db, "project_server_sources"), 1);
  assert.equal(tableCount(db, "project_server_build_jobs"), 1);
  assert.equal(
    db.prepare("SELECT title FROM project_server_projects WHERE project_id = ?").get(project.project_id).title,
    "ESP32 Lernprojekt",
  );
  db.close();
});

function collectionCount(db, serviceKey, collectionName) {
  return db.prepare(`
    SELECT COUNT(*) AS count
    FROM service_documents
    WHERE service_key = ? AND collection_name = ?
  `).get(serviceKey, collectionName).count;
}

function tableCount(db, tableName) {
  return db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count;
}
