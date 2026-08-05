"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const { validateProjectAppManifest, validateProjectAppValues } = require("../src/modules/project-app-manifest");
const { InMemoryProjectRepository } = require("../src/repositories/in-memory-project-repository");
const { FileBackedProjectRepository } = require("../src/repositories/file-backed-project-repository");
const { PostgresProjectRepository } = require("../src/repositories/postgres-project-repository");
const { ProjectService } = require("../src/services/project-service");

function nexiManifest() {
  return {
    schema: "gernetix.project-app/v1",
    manifest_version: 1,
    app_id: "nexi",
    title: "Nexi verwalten",
    description: "Einstellungen fuer den Sprachassistenten",
    settings: [
      { key: "cloud_enabled", type: "boolean", label: "Cloud-Funktionen", default: false },
      { key: "voice", type: "select", label: "Stimme", default: "warm", options: [{ value: "warm", label: "Warm" }, { value: "calm", label: "Ruhig" }] },
      { key: "volume", type: "integer", label: "Lautstaerke", min: 0, max: 5, default: 3 },
    ],
    bindings: [
      { id: "cloud", type: "setting", key: "cloud_enabled" },
      { id: "volume_value", type: "setting", key: "volume" },
      { id: "connection", type: "device_status", field: "connection_state" },
      { id: "temperature", type: "telemetry", metric_id: "room.temperature" },
    ],
    actions: [
      { id: "save_cloud", type: "update_setting", setting_key: "cloud_enabled" },
      { id: "save_volume", type: "update_setting", setting_key: "volume" },
      { id: "restart", type: "device_command", command_id: "assistant.restart", confirmation: "Nexi wirklich neu starten?" },
    ],
    pages: [{
      id: "overview", title: "Uebersicht", widgets: [
        { id: "intro", type: "text", text: "Hier wird Nexi verwaltet." },
        { id: "online", type: "status", title: "Verbindung", binding_id: "connection" },
      { id: "cloud_toggle", type: "toggle", title: "Cloud", binding_id: "cloud", action_id: "save_cloud" },
        { id: "volume_input", type: "input", title: "Lautstaerke", binding_id: "volume_value", action_id: "save_volume" },
        { id: "restart_button", type: "button", title: "Neu starten", action_id: "restart" },
      ],
    }],
  };
}

function seededRepository(manifest = nexiManifest()) {
  return new InMemoryProjectRepository({
    projects: [{ project_id: "project-nexi", user_id: "account-1", title: "Nexi", status: "active", created_at: "2026-08-04T10:00:00.000Z", updated_at: "2026-08-04T10:00:00.000Z" }],
    sources: [{ project_id: "project-nexi", path: "project-app/manifest.json", content: JSON.stringify(manifest), content_sha256: "a".repeat(64), content_type: "application/json", updated_at: "2026-08-04T10:00:00.000Z" }],
  });
}

test("validates and normalizes a declarative Project-App manifest v1", () => {
  const manifest = validateProjectAppManifest(nexiManifest());
  assert.equal(manifest.schema, "gernetix.project-app/v1");
  assert.deepEqual(validateProjectAppValues(manifest, { voice: "calm", volume: 4 }), {
    cloud_enabled: false, voice: "calm", volume: 4,
  });
});

test("validates declarative hardware requirements without executable matching rules", () => {
  const input = nexiManifest();
  input.hardware_requirements = {
    processor_variant: "ESP32-S3",
    supported_hardware_profile_ids: ["hardware.processor_board.waveshare_esp32_s3_audio_board"],
    features: [
      { id: "audio_driver", label: "Audio-Treiber", capability_id: "capability.audio_output", board_feature: "speaker", require_driver: true },
      { id: "buttons", label: "3 Bedientasten", capability_id: "capability.digital_input", board_feature: "buttons", require_included: true, min_count: 3 },
    ],
  };
  const manifest = validateProjectAppManifest(input);
  assert.equal(manifest.hardware_requirements.processor_variant, "ESP32-S3");
  assert.equal(manifest.hardware_requirements.features[1].min_count, 3);
  input.hardware_requirements.matcher = "device => true";
  assert.throws(() => validateProjectAppManifest(input), /matcher ist nicht erlaubt/);
});

test("rejects executable hooks, free URLs and dangling references", () => {
  const executable = nexiManifest();
  executable.pages[0].widgets[0].onClick = "fetch('https://example.test')";
  assert.throws(() => validateProjectAppManifest(executable), (error) => error.code === "invalid_project_app_manifest" && /onClick/.test(error.message));

  const url = nexiManifest();
  url.actions[0].endpoint = "https://example.test/settings";
  assert.throws(() => validateProjectAppManifest(url), (error) => error.code === "invalid_project_app_manifest" && /endpoint/.test(error.message));

  const dangling = nexiManifest();
  dangling.pages[0].widgets[1].binding_id = "foreign_binding";
  assert.throws(() => validateProjectAppManifest(dangling), /verweist nicht auf eine definierte Bindung/);
});

test("bounds telemetry fan-out in a project-authored manifest", () => {
  const excessive = nexiManifest();
  excessive.bindings = Array.from({ length: 21 }, (_, index) => ({
    id: `metric_${index}`,
    type: "telemetry",
    metric_id: `room.metric_${index}`,
  }));
  assert.throws(() => validateProjectAppManifest(excessive), /hoechstens 20 Telemetrie-Bindungen/);
});

test("enforces setting types, choices and numeric limits", () => {
  const manifest = nexiManifest();
  assert.throws(() => validateProjectAppValues(manifest, { voice: "unknown" }), /keine erlaubte Auswahl/);
  assert.throws(() => validateProjectAppValues(manifest, { volume: 6 }), /hoechstens 5/);
  assert.throws(() => validateProjectAppValues(manifest, { injected: true }), /nicht definiert/);
});

test("only binds text and number settings to generic input widgets", () => {
  const manifest = nexiManifest();
  manifest.pages[0].widgets.find((widget) => widget.id === "volume_input").binding_id = "cloud";
  manifest.pages[0].widgets.find((widget) => widget.id === "volume_input").action_id = "save_cloud";
  assert.throws(() => validateProjectAppManifest(manifest), /auf Text oder eine Zahl zeigen/);
});

test("loads the versioned manifest and stores account-bound runtime settings with CAS", async () => {
  const repository = seededRepository();
  const service = new ProjectService({ repository });

  const initial = await service.getProjectAppSettings("project-nexi", "account-1");
  assert.equal(initial.manifest.schema, "gernetix.project-app/v1");
  assert.equal(initial.revision, 0);
  assert.deepEqual(initial.values, { cloud_enabled: false, voice: "warm", volume: 3 });

  const saved = await service.updateProjectAppSettings("project-nexi", {
    account_id: "account-1", manifest_version: 1, expected_revision: 0,
    values: { cloud_enabled: true, volume: 5 },
  });
  assert.equal(saved.revision, 1);
  assert.equal(saved.manifest.app_id, "nexi");
  assert.deepEqual(saved.values, { cloud_enabled: true, voice: "warm", volume: 5 });

  const savedAgain = await service.updateProjectAppSettings("project-nexi", {
    account_id: "account-1", manifest_version: 1, expected_revision: 1,
    values: { cloud_enabled: false },
  });
  assert.equal(savedAgain.revision, 2);
  assert.deepEqual(savedAgain.values, { cloud_enabled: false, voice: "warm", volume: 5 });

  await assert.rejects(() => service.updateProjectAppSettings("project-nexi", {
    account_id: "account-1", manifest_version: 1, expected_revision: 0,
    values: { volume: 2 },
  }), (error) => error.code === "project_app_settings_revision_conflict" && error.status === 409);
});

test("stores up to sixteen application device bindings while preserving a legacy primary device", async () => {
  const repository = seededRepository();
  const service = new ProjectService({ repository });
  const saved = await service.updateProjectAppDevices("project-nexi", {
    account_id: "account-1",
    device_ids: ["nexi-kitchen", "nexi-bedroom"],
  });
  assert.deepEqual(saved.assigned_device_ids, ["nexi-kitchen", "nexi-bedroom"]);
  assert.equal(saved.primary_device_id, "nexi-kitchen");
  const project = await service.getProject("project-nexi");
  assert.equal(project.device_id, "nexi-kitchen");
  assert.deepEqual(project.device_ids, ["nexi-kitchen", "nexi-bedroom"]);
  const snapshot = await service.getProjectAppSettings("project-nexi", "account-1");
  assert.deepEqual(snapshot.assigned_device_ids, ["nexi-kitchen", "nexi-bedroom"]);
  await assert.rejects(() => service.updateProjectAppDevices("project-nexi", {
    account_id: "account-2", device_ids: ["foreign-device"],
  }), (error) => error.code === "project_not_found" && error.status === 404);
  await assert.rejects(() => service.updateProjectAppDevices("project-nexi", {
    account_id: "account-1", device_ids: ["duplicate", "duplicate"],
  }), (error) => error.code === "invalid_project_app_devices" && error.status === 400);
});

test("hides projects from foreign accounts and detects stale manifests", async () => {
  const service = new ProjectService({ repository: seededRepository() });
  await assert.rejects(() => service.getProjectAppSettings("project-nexi", "account-2"), (error) => error.code === "project_not_found" && error.status === 404);
  await assert.rejects(() => service.updateProjectAppSettings("project-nexi", {
    account_id: "account-1", manifest_version: 2, expected_revision: 0, values: {},
  }), (error) => error.code === "project_app_manifest_version_conflict" && error.status === 409);
});

test("persists Project-App settings separately from versioned project sources", async () => {
  const runtimeRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-project-app-"));
  try {
    const repository = FileBackedProjectRepository.create(runtimeRoot);
    const seed = seededRepository();
    await repository.saveProject(await seed.findProject("project-nexi"));
    await repository.saveSource(await seed.findSource("project-nexi", "project-app/manifest.json"));
    const service = new ProjectService({ repository });
    await service.updateProjectAppSettings("project-nexi", {
      account_id: "account-1", manifest_version: 1, expected_revision: 0, values: { volume: 4 },
    });

    const reloaded = new ProjectService({ repository: FileBackedProjectRepository.create(runtimeRoot) });
    const settings = await reloaded.getProjectAppSettings("project-nexi", "account-1");
    assert.equal(settings.revision, 1);
    assert.equal(settings.values.volume, 4);
    assert.equal(JSON.parse((await reloaded.getSource("project-nexi", "project-app/manifest.json")).content).manifest_version, 1);
  } finally {
    fs.rmSync(runtimeRoot, { recursive: true, force: true });
  }
});

test("PostgreSQL schema and write use cascade ownership and atomic revision comparison", async () => {
  const pool = new RecordingPool();
  const repository = new PostgresProjectRepository(pool);
  await repository.ensureSchema();
  assert.match(pool.calls[0].text, /CREATE TABLE IF NOT EXISTS project_app_settings/);
  assert.match(pool.calls[0].text, /REFERENCES project_projects\(project_id\) ON DELETE CASCADE/);

  pool.nextResult = { rows: [{ raw_json: { project_id: "project-nexi", account_id: "account-1", revision: 2 } }], rowCount: 1 };
  const result = await repository.compareAndSetProjectAppSettings({
    project_id: "project-nexi", account_id: "account-1", manifest_version: 1, revision: 2,
    values: {}, created_at: "2026-08-04T10:00:00.000Z", updated_at: "2026-08-04T10:01:00.000Z",
  }, 1);
  assert.equal(result.saved, true);
  assert.match(pool.calls[1].text, /UPDATE project_app_settings SET[\s\S]+revision=\$8/);
  assert.match(pool.calls[1].text, /WHERE \$8=0 AND NOT EXISTS/);
  assert.equal(pool.calls[1].values[7], 1);
});

class RecordingPool {
  constructor() { this.calls = []; this.nextResult = null; }
  async query(text, values = []) {
    this.calls.push({ text, values });
    const result = this.nextResult || { rows: [], rowCount: 1 };
    this.nextResult = null;
    return result;
  }
}
