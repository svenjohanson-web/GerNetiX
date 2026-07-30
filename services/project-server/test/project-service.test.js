const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const test = require("node:test");

const { createConfig, createDefaultProjectServer, FileBackedProjectRepository, InMemoryProjectRepository, SqliteBackedProjectRepository } = require("../src");
const { ProjectService } = require("../src/services/project-service");
const { SqliteStateStore } = require("../../shared");

function createMemoryProjectServer() {
  return createDefaultProjectServer({ persistenceBackend: "memory" });
}

async function createDemoProject(service) {
  return await service.createProject({
    user_id: "user-1",
    title: "ESP32 Lernprojekt",
    description: "Blinken und OTA lernen",
    learning_project_id: "learning_project.esp32_ota_bootstrap",
    hardware_profile_id: "hardware.processor_board.generic_esp_wroom32",
    device_id: "device-1",
    build_config: {
      platform: "espressif32",
      board: "esp32dev",
      framework: "arduino",
      libraries: ["bblanchon/ArduinoJson"],
    },
  });
}

test("defaults project persistence to dedicated project sqlite storage", async () => {
  const config = createConfig({});

  assert.equal(config.persistenceBackend, "sqlite");
  assert.equal(path.isAbsolute(config.runtimeRoot), true);
  assert.equal(path.isAbsolute(config.sqlitePath), true);
  assert.equal(path.basename(config.sqlitePath), "gernetix-projects.sqlite");
});

test("configures the shared VPS project PostgreSQL backend explicitly", () => {
  const config = createConfig({
    PERSISTENCE_BACKEND: "postgres",
    PROJECT_POSTGRES_HOST: "project-postgres",
    PROJECT_POSTGRES_PORT: "5433",
    PROJECT_POSTGRES_DATABASE: "gernetix_projects",
    PROJECT_POSTGRES_USER: "project-user",
    PROJECT_POSTGRES_PASSWORD: "secret",
  });

  assert.equal(config.persistenceBackend, "postgres");
  assert.deepEqual(config.postgres, {
    connectionString: "",
    host: "project-postgres",
    port: 5433,
    database: "gernetix_projects",
    user: "project-user",
    password: "secret",
  });
});

test("creates project with default source and lists it by user", async () => {
  const service = createMemoryProjectServer();
  const project = await createDemoProject(service);

  assert.equal(project.user_id, "user-1");
  assert.equal(project.source_count, 1);
  assert.equal((await service.listProjects({ user_id: "user-1" })).length, 1);
});

test("stores an immutable project version and restores it through a new history entry", async () => {
  const service = createMemoryProjectServer();
  const project = await createDemoProject(service);
  await service.upsertSource(project.project_id, { path: "src/main.cpp", content: "int value = 1;" });
  const saved = await service.createVersion(project.project_id, {
    user_id: "user-1",
    message: "Vor Änderung",
    parent_version_id: "vom-client-erfunden",
    commit_kind: "restore",
    restored_from_version_id: "vom-client-erfunden",
  });
  await service.upsertSource(project.project_id, { path: "src/main.cpp", content: "int value = 2;" });
  await service.upsertSource(project.project_id, { path: "src/temporär.cpp", content: "int temporary = 1;" });

  const restored = await service.restoreVersion(project.project_id, saved.version_id, { user_id: "user-1" });
  const source = await service.getSource(project.project_id, "src/main.cpp");

  assert.equal(source.content, "int value = 1;");
  await assert.rejects(service.getSource(project.project_id, "src/temporär.cpp"), /nicht gefunden/);
  const versions = await service.listVersions(project.project_id);
  const preserved = versions.find((version) => version.version_id === restored.preserved_before_restore_version_id);
  assert.equal(restored.parent_version_id, preserved.version_id);
  assert.equal(versions.length, 3);
  assert.equal(preserved.message, "Stand vor Wiederherstellung");
  assert.equal(preserved.sources.find((source) => source.path === "src/main.cpp").content, "int value = 2;");
  assert.match(saved.snapshot_sha256, /^[a-f0-9]{64}$/);
  assert.equal(saved.parent_version_id, null);
  assert.equal(saved.commit_kind, "snapshot");
  assert.equal(saved.restored_from_version_id, null);
  assert.equal(restored.commit_kind, "restore");
  assert.equal(restored.restored_from_version_id, saved.version_id);
  assert.equal(restored.snapshot_sha256, saved.snapshot_sha256);
});

test("creates a binary version only from the exact successful build snapshot", async () => {
  const service = createMemoryProjectServer();
  const project = await createDemoProject(service);
  await service.upsertSource(project.project_id, { path: "src/main.cpp", content: "int frozen = 1;" });
  const job = await service.createBuildJob(project.project_id, { mode: "build" });
  await service.createBuildPackage(job.build_job_id);
  await service.upsertSource(project.project_id, { path: "src/main.cpp", content: "int changed = 2;" });
  await service.recordBuildResult(job.build_job_id, {
    status: "succeeded",
    artifacts: [{ name: "firmware.bin", sha256: "abc123", size: 42, url: "/artifact/firmware.bin" }],
  });

  const version = await service.createVersion(project.project_id, {
    user_id: "user-1", message: "Mit Firmware", include_binary: true, build_job_id: job.build_job_id,
  });

  assert.equal(version.includes_binary, true);
  assert.equal(version.sources.find((source) => source.path === "src/main.cpp").content, "int frozen = 1;");
  assert.deepEqual(version.binary_artifacts.map((artifact) => artifact.file_name), ["firmware.bin"]);
});

test("does not create a binary version for a failed build", async () => {
  const service = createMemoryProjectServer();
  const project = await createDemoProject(service);
  const job = await service.createBuildJob(project.project_id, { mode: "build" });
  await service.createBuildPackage(job.build_job_id);
  await service.recordBuildResult(job.build_job_id, { status: "failed", error: "Compilerfehler" });

  await assert.rejects(
    service.createVersion(project.project_id, { user_id: "user-1", include_binary: true, build_job_id: job.build_job_id }),
    /erfolgreichen Build/,
  );
  assert.equal((await service.listVersions(project.project_id)).length, 0);
});

test("persists the exact lesson and step position for a learning project", async () => {
  const repository = new InMemoryProjectRepository();
  const service = new ProjectService({ repository });
  const project = await service.createProject({
    user_id: "user-1",
    title: "Hausautomatisierung",
    learning_project_id: "learning_project.home_automation",
    view_manifest: {
      entry_mode: "project_story",
      views: [
        { id: "sensor-read", lesson_id: "lesson.sensorics", type: "explanation", title: "Sensor lesen" },
        { id: "sensor-state", lesson_id: "lesson.sensorics", type: "explanation", title: "Zustand ableiten" },
        { id: "actuator-switch", lesson_id: "lesson.actuatorics", type: "explanation", title: "Aktor schalten" },
      ],
    },
  });

  const initial = await service.getLearningProgress(project.project_id, "user-1");
  assert.equal(initial.status, "not_started");
  assert.equal(initial.current_lesson_id, "lesson.sensorics");
  assert.equal(initial.current_step_id, "sensor-read");

  await service.updateLearningProgress(project.project_id, {
    user_id: "user-1",
    current_lesson_id: "lesson.sensorics",
    current_step_id: "sensor-state",
    current_step_index: 1,
    completed_step_indexes: [0],
  });
  const saved = await service.updateLearningProgress(project.project_id, {
    user_id: "user-1",
    current_lesson_id: "lesson.forged",
    current_step_id: "actuator-switch",
    current_step_index: 2,
    completed_step_indexes: [0, 1],
    completed_step_ids: ["not-a-real-step"],
  });

  assert.equal(saved.current_lesson_id, "lesson.actuatorics");
  assert.equal(saved.current_step_id, "actuator-switch");
  assert.equal(saved.current_step_index, 2);
  assert.deepEqual(saved.completed_step_ids, ["sensor-read", "sensor-state"]);
  assert.equal(saved.lesson_progress.find((item) => item.lesson_id === "lesson.sensorics").status, "completed");
  assert.equal(saved.lesson_progress.find((item) => item.lesson_id === "lesson.actuatorics").status, "active");

  const restartedService = new ProjectService({ repository });
  const resumed = await restartedService.getLearningProgress(project.project_id, "user-1");
  assert.equal(resumed.current_lesson_id, "lesson.actuatorics");
  assert.equal(resumed.current_step_id, "actuator-switch");
});

test("rejects learning progress access from a different account", async () => {
  const service = createMemoryProjectServer();
  const project = await createDemoProject(service);

  await assert.rejects(
    service.getLearningProgress(project.project_id, "user-2"),
    (error) => error.status === 403 && error.code === "project_access_denied",
  );
  await assert.rejects(
    service.updateLearningProgress(project.project_id, { user_id: "user-2", current_step_index: 0 }),
    (error) => error.status === 403 && error.code === "project_access_denied",
  );
});

test("legacy comfort basis is normalized to full and preserves project web extensions", async () => {
  const service = createMemoryProjectServer();
  const project = await service.createProject({
    user_id: "user-1",
    title: "Web Device",
    build_config: {
      firmware_basis_id: "gernetix-runtime-basissoftware",
      firmware_basis_variant: "comfort",
      component_features: {
        enabled: ["measurement_chart"],
        webserver: { measurement_chart: true, measurement_label: "Temperatur", measurement_unit: "°C" },
      },
    },
  });

  assert.equal(project.build_config.firmware_basis_variant, "full");
  assert.deepEqual(project.build_config.component_features.immutable, ["wifi", "mqtt", "ota", "http", "webserver"]);
  assert.equal(project.build_config.component_features.enabled.includes("mqtt"), true);
  assert.equal(project.build_config.component_features.enabled.includes("measurement_chart"), true);
  assert.equal(project.build_config.component_features.webserver.measurement_label, "Temperatur");
});

test("stores project sources with hashes and rejects path traversal", async () => {
  const service = createMemoryProjectServer();
  const project = await createDemoProject(service);
  const source = await service.upsertSource(project.project_id, {
    path: "include/settings.h",
    content: "#define GNX 1\n",
  });

  assert.equal(source.role, "header");
  assert.equal(source.content_sha256.length, 64);
  await assert.rejects(
    service.upsertSource(project.project_id, { path: "../secret.txt", content: "x" }),
    /Source-Pfad/,
  );
});

test("searches project sources for a known task instead of returning the whole project", async () => {
  const service = createMemoryProjectServer();
  const project = await createDemoProject(service);
  await service.upsertSource(project.project_id, {
    path: "Architektur/system.puml",
    content: "@startuml\nnode ESP32\n@enduml\n",
  });
  await service.upsertSource(project.project_id, {
    path: "Komponenten/IoT-Device 1/Sensoren/temperature.cpp",
    content: "void readTemperatureSensor() {}\n",
  });
  await service.upsertSource(project.project_id, {
    path: "docs/unrelated.md",
    content: "Abrechnung und Vertrag\n",
  });

  const matches = await service.searchSources(project.project_id, {
    query: "Temperature Sensor in die Architektur aufnehmen",
    current_path: "Architektur/system.puml",
    limit: 2,
  });

  assert.deepEqual(matches.map((source) => source.path), [
    "Architektur/system.puml",
    "Komponenten/IoT-Device 1/Sensoren/temperature.cpp",
  ]);
  assert.equal(matches[0].content.includes("@startuml"), true);

  const architectureOnly = await service.searchSources(project.project_id, {
    query: "neues Prozessorboard ESP32",
    current_path: "Komponenten/IoT-Device 1/Sensoren/temperature.cpp",
    source_kind: "architecture",
    limit: 3,
  });
  assert.deepEqual(architectureOnly.map((source) => source.path), ["Architektur/system.puml"]);
});

test("creates reproducible build package for build deploy server", async () => {
  const service = createMemoryProjectServer();
  const project = await createDemoProject(service);
  await service.upsertSource(project.project_id, {
    path: "src/app.cpp",
    content: "void app() {}\n",
  });
  const job = await service.createBuildJob(project.project_id, { mode: "build_and_flash" });
  const buildPackage = await service.createBuildPackage(job.build_job_id);

  assert.equal(buildPackage.build_job.mode, "build_and_flash");
  assert.equal(buildPackage.files.some((file) => file.path === "platformio.ini"), true);
  assert.equal(buildPackage.files.some((file) => file.path === "src/app.cpp"), true);
});

test("composes ESP32 basissoftware with only the project-owned user main", async () => {
  const service = new ProjectService({
    repository: new InMemoryProjectRepository(),
    loadEsp32BasissoftwareFiles: () => [
      { path: "platformio.ini", content: "framework = espidf\n", content_type: "text/plain" },
      { path: "src/main.cpp", content: "extern \"C\" void app_main() {}\n", content_type: "text/x-c++src" },
      { path: "src/user/user_app.cpp", content: "void oldUserMain() {}\n", content_type: "text/x-c++src" },
    ],
  });
  const project = await service.createProject({
    user_id: "user-1",
    title: "ESP32 Durchstich",
    build_config: {
      platform: "espressif32",
      board: "esp32dev",
      framework: "espidf",
      firmware_basis_id: "gernetix-runtime-basissoftware",
      firmware_basis_version: "test",
      user_source_path: "Komponenten/IoT-Device 1/src/user_main.cpp",
      user_target_path: "src/user/user_app.cpp",
    },
    sources: [{ path: "Komponenten/IoT-Device 1/src/user_main.cpp", content: "extern \"C\" void userMain() {}\n" }],
  });
  const job = await service.createBuildJob(project.project_id);
  const buildPackage = await service.createBuildPackage(job.build_job_id);

  assert.equal(project.build_config.firmware_basis_variant, "full");
  assert.equal(buildPackage.platformio_ini, "framework = espidf\n");
  assert.equal(buildPackage.files.some((file) => file.path === "src/main.cpp"), true);
  assert.equal(buildPackage.files.find((file) => file.path === "src/user/user_app.cpp").content, "extern \"C\" void userMain() {}\n");
  assert.equal(buildPackage.files.some((file) => file.path === "Komponenten/IoT-Device 1/src/user_main.cpp"), false);
});

test("stores project view manifest and includes it in build package", async () => {
  const service = createMemoryProjectServer();
  const project = await service.createProject({
    user_id: "user-1",
    title: "Gefuehrte IDE",
    view_manifest: {
      title: "Quellcode verstehen",
      template_id: "sensor_actuator_control",
      template_ref: { template_id: "sensor_actuator_control", model_schema_version: 1 },
      architecture_dialog: { messages: [{ role: "user", content: "Hallo" }] },
      home_automation_configuration: { schema_version: 1, coordinator: "gernetix_home_server", nodes: [] },
      game_configuration: { schema_version: 1, pattern_id: "touchscreen_game_loop", selected_game_ids: ["snake"] },
      pwa_dashboard: { schema_version: 1, title: "Messwerte unterwegs", visible_cards: ["current_values", "history", "not_allowed"] },
      primary_source_path: "src/main.cpp",
      hide_source_editor: true,
      views: [
        {
          id: "analyse",
          type: "source_analysis",
          title: "Quellcode analysieren",
          summary: "Startpunkt fuer die IDE-Erklaerung.",
          source_path: "src/main.cpp",
          source_lines: [1, 2, 3],
          editable_lines: [2],
          completion: { type: "acknowledge", label: "Analyse verstanden" },
          validation: { type: "source_contains_all", must_contain: ["void setup"] },
          required_functions: ["source_focus", "guided_next"],
          controls: {
            actions: [
              { id: "next", function: "next_step", label: "Analyse verstanden" },
            ],
          },
        },
        {
          id: "uml",
          type: "plantuml",
          title: "Zustandsmodell",
          payload: { source: "@startuml\n[*] --> Alive\n@enduml" },
        },
      ],
    },
  });
  const stored = await service.getProject(project.project_id);
  const job = await service.createBuildJob(project.project_id);
  const buildPackage = await service.createBuildPackage(job.build_job_id);
  const manifestFile = buildPackage.files.find((file) => file.path === "project-view-manifest.json");

  assert.equal(stored.view_manifest.views.length, 2);
  assert.equal(stored.view_manifest.template_id, "sensor_actuator_control");
  assert.deepEqual(stored.view_manifest.template_ref, {
    template_id: "sensor_actuator_control",
    model_schema_version: 1,
  });
  assert.equal(stored.view_manifest.architecture_dialog.messages[0].content, "Hallo");
  assert.equal(stored.view_manifest.home_automation_configuration.coordinator, "gernetix_home_server");
  assert.equal(stored.view_manifest.game_configuration.pattern_id, "touchscreen_game_loop");
  assert.deepEqual(stored.view_manifest.game_configuration.selected_game_ids, ["snake"]);
  assert.equal(stored.view_manifest.pwa_dashboard.title, "Messwerte unterwegs");
  assert.deepEqual(stored.view_manifest.pwa_dashboard.visible_cards, ["current_values", "history"]);
  assert.equal(stored.view_manifest.primary_source_path, "src/main.cpp");
  assert.equal(stored.view_manifest.hide_source_editor, true);
  assert.equal(stored.view_manifest.views[0].editable_lines[0], 2);
  assert.equal(stored.view_manifest.views[0].completion.label, "Analyse verstanden");
  assert.equal(stored.view_manifest.views[0].validation.type, "source_contains_all");
  assert.equal(stored.view_manifest.views[0].required_functions[0], "source_focus");
  assert.equal(stored.view_manifest.views[0].controls.actions[0].function, "next_step");
  assert.ok(manifestFile);
  assert.equal(JSON.parse(manifestFile.content).views[1].type, "plantuml");
});

test("rejects build jobs for model-only projects without build config", async () => {
  const service = createMemoryProjectServer();
  const project = await service.createProject({
    user_id: "user-1",
    title: "Tamagotchi Verhaltensmodell",
    build_config: null,
    view_manifest: {
      title: "Tamagotchi Verhaltensmodell",
      hide_source_editor: true,
      views: [{ id: "state-intro", type: "story_slide", title: "Einfuehrung in Zustaende" }],
    },
  });

  await assert.rejects(
    service.createBuildJob(project.project_id),
    /keine Build-Konfiguration/
  );
});

test("creates atmel avr build package without arduino framework", async () => {
  const service = createMemoryProjectServer();
  const project = await service.createProject({
    user_id: "user-1",
    title: "Arduino Atmel Bare Metal",
    build_config: {
      platform: "atmelavr",
      board: "nanoatmega328",
      framework: "",
      environment: "nanoatmega328",
    },
    sources: [{ path: "src/main.c", content: "int main(void) { return 0; }\n" }],
  });
  const job = await service.createBuildJob(project.project_id, { mode: "build_and_usb_flash" });
  const buildPackage = await service.createBuildPackage(job.build_job_id);
  const platformioIni = buildPackage.files.find((file) => file.path === "platformio.ini").content;

  assert.match(platformioIni, /platform = atmelavr/);
  assert.doesNotMatch(platformioIni, /framework = arduino/);
});

test("records build result and firmware artifacts in project history", async () => {
  const service = createMemoryProjectServer();
  const project = await createDemoProject(service);
  const job = await service.createBuildJob(project.project_id);
  await service.markBuildSubmitted(job.build_job_id, { build_deploy_job_id: "bd-1" });

  const result = await service.recordBuildResult(job.build_job_id, {
    status: "succeeded",
    artifacts: [{ file_name: "firmware.bin", url: "http://127.0.0.1/artifacts/job/firmware.bin", sha256: "abc" }],
  });
  const artifacts = await service.listArtifacts({ project_id: project.project_id });

  assert.equal(result.status, "succeeded");
  assert.equal(artifacts[0].file_name, "firmware.bin");
});

test("feedback hides contact data until explicit feedback consent exists", async () => {
  const service = createMemoryProjectServer();
  const project = await createDemoProject(service);
  const feedback = await service.createFeedback({
    project_id: project.project_id,
    message: "Ich haenge bei OTA.",
    contact_mode: "email",
    contact_email: "sven@example.test",
  });

  assert.equal(feedback.contact_email, "");
  await service.createFeedbackConsent(feedback.feedback_id, { valid_until: "2099-01-01T00:00:00.000Z" });
  const visible = (await service.listFeedback({ project_id: project.project_id }))[0];
  assert.equal(visible.contact_email, "sven@example.test");
});

test("anonymizes expired feedback after maximum retention window", async () => {
  const service = createMemoryProjectServer();
  const project = await createDemoProject(service);
  await service.createFeedback({
    project_id: project.project_id,
    user_id: "user-1",
    message: "Bitte anonymisieren.",
    contact_email: "sven@example.test",
    anonymize_after: "2020-01-01T00:00:00.000Z",
  });

  const anonymized = await service.anonymizeExpiredFeedback(new Date("2026-01-01T00:00:00.000Z"));
  assert.equal(anonymized[0].user_id, "anonymous");
  assert.equal(anonymized[0].contact_email, "");
});

test("json repository persists projects, sources and build jobs across reload", async () => {
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gnx-project-server-"));
  const service = new ProjectService({
    repository: FileBackedProjectRepository.create(runtimeRoot),
  });
  const project = await createDemoProject(service);
  const job = await service.createBuildJob(project.project_id, { mode: "prebuild" });

  const reloaded = new ProjectService({
    repository: FileBackedProjectRepository.create(runtimeRoot),
  });

  assert.equal((await reloaded.getProject(project.project_id)).title, "ESP32 Lernprojekt");
  assert.equal((await reloaded.listSources(project.project_id)).length, 1);
  assert.equal((await reloaded.getBuildJob(job.build_job_id)).mode, "prebuild");
});

test("sqlite repository persists projects, learning progress, sources and build jobs across reload", async () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-project-server-sqlite-")), "state.sqlite");
  const service = new ProjectService({
    repository: SqliteBackedProjectRepository.create(dbPath),
  });
  const project = await createDemoProject(service);
  const job = await service.createBuildJob(project.project_id, { mode: "prebuild" });
  await service.updateLearningProgress(project.project_id, {
    user_id: "user-1",
    current_step_index: 0,
    completed_step_indexes: [0],
  });

  const reloaded = new ProjectService({
    repository: SqliteBackedProjectRepository.create(dbPath),
  });

  assert.equal((await reloaded.getProject(project.project_id)).title, "ESP32 Lernprojekt");
  assert.equal((await reloaded.listSources(project.project_id)).length, 1);
  assert.equal((await reloaded.getBuildJob(job.build_job_id)).mode, "prebuild");
  assert.equal((await reloaded.getLearningProgress(project.project_id, "user-1")).status, "active");

  const db = new DatabaseSync(dbPath);
  assert.equal(collectionCount(db, "project-server", "projects"), 1);
  assert.equal(collectionCount(db, "project-server", "sources"), 1);
  assert.equal(collectionCount(db, "project-server", "build_jobs"), 1);
  assert.equal(collectionCount(db, "project-server", "learning_progress"), 1);
  assert.equal(tableCount(db, "project_server_projects"), 1);
  assert.equal(tableCount(db, "project_server_sources"), 1);
  assert.equal(tableCount(db, "project_server_build_jobs"), 1);
  assert.equal(tableCount(db, "project_server_learning_progress"), 1);
  assert.equal(
    db.prepare("SELECT title FROM project_server_projects WHERE project_id = ?").get(project.project_id).title,
    "ESP32 Lernprojekt",
  );
  db.close();
});

test("enforces centrally configurable free resource limits", async () => {
  const service = createMemoryProjectServer();
  await service.updateResourcePolicy("free", { max_projects: 2, max_storage_bytes: 200, max_monthly_traffic_bytes: 1024 });
  await service.createProject({ user_id: "free-user", plan_id: "free", title: "Eins" });
  await service.createProject({ user_id: "free-user", plan_id: "free", title: "Zwei" });
  await assert.rejects(
    service.createProject({ user_id: "free-user", plan_id: "free", title: "Drei" }),
    /Maximal 2 Projekte/,
  );
  const summary = await service.resourceSummary();
  assert.equal(summary.policies.find((policy) => policy.plan_id === "free").max_projects, 2);
});

test("enforces the generous premium project-count limit without storage enforcement", async () => {
  const service = createMemoryProjectServer();
  const first = await service.createProject({ user_id: "premium-storage-user", plan_id: "premium", title: "Mit Quelltext" });
  await service.upsertSource(first.project_id, { path: "src/main.cpp", content: "void setup() {}" });
  for (let index = 0; index < 200; index += 1) {
    await service.createProject({ user_id: "premium-user", plan_id: "premium", title: `Projekt ${index}` });
  }
  await assert.rejects(
    service.createProject({ user_id: "premium-user", plan_id: "premium", title: "Zu viel" }),
    /Maximal 200 Projekte/,
  );
  assert.equal((await service.resourceSummary()).policies.find((policy) => policy.plan_id === "premium").max_projects, 200);
});

test("treats zero resource limits as unlimited", async () => {
  const service = createMemoryProjectServer();
  const policy = await service.updateResourcePolicy("free", {
    max_projects: 0,
    max_storage_bytes: 0,
    max_monthly_traffic_bytes: 0,
  });
  assert.equal(policy.max_projects, null);
  assert.equal(policy.max_storage_bytes, null);
  assert.equal(policy.max_monthly_traffic_bytes, null);
  const project = await service.createProject({ user_id: "unlimited-user", plan_id: "free", title: "Ohne Grenze" });
  await assert.doesNotReject(
    service.upsertSource(project.project_id, { path: "src/main.cpp", content: "void setup() {}" }),
  );
});

test("deletes a project together with its stored project data", async () => {
  const service = createMemoryProjectServer();
  const project = await service.createProject({ project_id: "delete-me", user_id: "user-1", title: "Loeschbar" });
  await service.upsertSource(project.project_id, { path: "src/main.cpp", content: "void setup() {}" });
  const result = await service.deleteProject(project.project_id);
  assert.equal(result.project_id, project.project_id);
  assert.equal(result.deleted.sources, 1);
  await assert.rejects(service.getProject(project.project_id), /Projekt wurde nicht gefunden/);
});

test("sqlite repository migrates the legacy ESP32 component path to IoT-Device 1", async () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-project-path-migration-")), "state.sqlite");
  const store = new SqliteStateStore(dbPath, "project-server", {
    defaultState: { projects: [], sources: [], buildJobs: [], artifacts: [], feedback: [], consents: [] },
    collectionMap: { projects: "projects", sources: "sources", buildJobs: "build_jobs", artifacts: "artifacts", feedback: "feedback", consents: "consents" },
  });
  store.save({
    projects: [{
      project_id: "legacy-project",
      user_id: "user-1",
      title: "IoT-Device only",
      build_config: {
        user_source_path: "Komponenten/ESP32/src/user_main.cpp",
        component_device_allocations: [{ component_path: "Komponenten/ESP32", device_id: "device-1" }],
      },
      view_manifest: { primary_source_path: "Komponenten/ESP32/src/user_main.cpp" },
    }],
    sources: [
      { project_id: "legacy-project", path: "Komponenten/ESP32/src/user_main.cpp", content: "void setup() {}" },
      { project_id: "legacy-project", path: "Architektur/statische-architektur/architektur.puml", content: '@startuml\nrectangle "IoT Device / ESP32" as device\n@enduml' },
    ],
    buildJobs: [], artifacts: [], feedback: [], consents: [],
  });
  store.close();

  const repository = SqliteBackedProjectRepository.create(dbPath);
  const project = repository.findProject("legacy-project");
  assert.equal(project.build_config.user_source_path, "Komponenten/IoT-Device 1/src/user_main.cpp");
  assert.equal(project.build_config.component_device_allocations[0].component_path, "Komponenten/IoT-Device 1");
  assert.equal(project.view_manifest.primary_source_path, "Komponenten/IoT-Device 1/src/user_main.cpp");
  assert.deepEqual(repository.listSources("legacy-project").map((source) => source.path), [
    "Architektur/statische-architektur/architektur.puml",
    "Komponenten/IoT-Device 1/src/user_main.cpp",
  ]);
  assert.match(
    repository.findSource("legacy-project", "Architektur/statische-architektur/architektur.puml").content,
    /rectangle "IoT-Device 1" as device/,
  );
  assert.equal(repository.store.schemaVersion("project-server-content"), 1);
  repository.store.close();
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
