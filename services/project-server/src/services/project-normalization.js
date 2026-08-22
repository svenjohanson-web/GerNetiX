"use strict";

const { ProjectServerError } = require("../errors");
const { normalizeBasissoftwareConfiguration } = require("../../../shared/basissoftware-configuration");
const { normalizeProjectCommunicationSetup } = require("../../../shared/project-communication-setup");

/*
 * Normalisierung der Projektdaten.
 *
 * Herausgeloest aus project-service.js: aus einer eingehenden Struktur wird
 * eine gepruefte, vollstaendige Form. Buildkonfiguration, Softwareeinheiten,
 * Boardkonfiguration, Ansichtsmanifest und die Pfadhilfen dazu.
 *
 * Die Funktionen arbeiten nur mit ihren Parametern und kennen weder Repository
 * noch Sitzung. ProjectService bleibt zustaendig fuer Persistenz, Rechte und
 * Ablauf und fuehrt diese Funktionen ein.
 */

// Von PlatformIO selbst belegte Schluessel; ein Projekt darf sie nicht
// ueberschreiben. Wird nur in normalizePlatformioOptions gebraucht.
const RESERVED_PLATFORMIO_OPTIONS = new Set([
  "platform", "board", "framework", "monitor_speed", "upload_protocol", "upload_speed",
  "board_build.flash_size", "board_upload.flash_size", "board_upload.maximum_size",
  "board_upload.maximum_ram_size", "board_build.partitions", "lib_deps", "build_flags",
]);
function normalizeBuildConfig(input = {}) {
  if (!input || typeof input !== "object") return null;
  const firmwareBasisId = input.firmware_basis_id || "";
  const platform = input.platform || "espressif32";
  return {
    platform,
    framework: input.framework === undefined ? "arduino" : input.framework,
    board: input.board || "esp32dev",
    environment: input.environment || "esp32dev",
    libraries: input.libraries || [],
    monitor_speed: positiveInteger(input.monitor_speed ?? input.monitorSpeed) || 115200,
    upload_speed: positiveInteger(input.upload_speed ?? input.uploadSpeed),
    upload_protocol: safeSingleLine(input.upload_protocol ?? input.uploadProtocol),
    build_flags: safeStringList(input.build_flags),
    maximum_program_size_bytes: positiveInteger(input.maximum_program_size_bytes),
    maximum_ram_size_bytes: positiveInteger(input.maximum_ram_size_bytes),
    partition_file: safeSingleLine(input.partition_file),
    platformio_options: normalizePlatformioOptions(input.platformio_options),
    firmware_basis_id: firmwareBasisId,
    firmware_basis_version: input.firmware_basis_version || "",
    firmware_basis_variant: input.firmware_basis_variant === "comfort" ? "full" : input.firmware_basis_variant || (firmwareBasisId ? "full" : ""),
    firmware_basis_reference: normalizeProtectedSourceReference(input.firmware_basis_reference),
    board_support_source_id: String(input.board_support_source_id || input.board_configuration?.board_support_source_id || "").slice(0, 100),
    board_support_reference: input.board_support_reference && typeof input.board_support_reference === "object"
      ? JSON.parse(JSON.stringify(input.board_support_reference))
      : null,
    partition_profile_id: input.partition_profile_id || "",
    flash_size_mb: positiveInteger(input.flash_size_mb) || (/^espressif(32|8266)$/i.test(platform) ? 4 : 0),
    user_source_path: input.user_source_path || "",
    user_target_path: input.user_target_path || "",
    component_device_allocations: Array.isArray(input.component_device_allocations)
      ? input.component_device_allocations.map((item) => ({ ...item })).filter((item) => item.component_path && item.device_id)
      : [],
    component_features: normalizeComponentFeatures(input.component_features, input.firmware_basis_variant === "comfort" ? "full" : input.firmware_basis_variant || (firmwareBasisId ? "full" : "")),
    basissoftware_configuration: firmwareBasisId ? normalizeBasissoftwareConfiguration(input.basissoftware_configuration) : null,
    component_hardware_features: input.component_hardware_features && typeof input.component_hardware_features === "object"
      ? JSON.parse(JSON.stringify(input.component_hardware_features))
      : {},
    board_configuration: normalizeBoardConfiguration(input.board_configuration),
  };
}

function normalizeProtectedSourceReference(input) {
  if (!input || typeof input !== "object") return null;
  const commitSha = String(input.commit_sha || "").toLowerCase();
  if (!/^[a-f0-9]{40}$/.test(commitSha)) return null;
  return {
    source_id: String(input.source_id || "").slice(0, 100),
    provider: input.provider === "forgejo" ? "forgejo" : "",
    organization: String(input.organization || "").slice(0, 100),
    repository_name: String(input.repository_name || "").slice(0, 100),
    commit_sha: commitSha,
  };
}

function normalizeSoftwareUnits(input, fallbackBuildConfig = null) {
  const rawUnits = Array.isArray(input) ? input : [];
  if (!rawUnits.length) {
    return fallbackBuildConfig ? [{
      software_unit_id: "firmware",
      title: "Firmware",
      software_kind: "embedded_firmware",
      build_system: "platformio",
      source_root: "Komponenten/IoT-Device 1",
      entrypoint: componentRelativeSourcePath(defaultUserSourcePath(fallbackBuildConfig), "", "Komponenten/IoT-Device 1"),
      device_id: "",
      build_config: normalizeSoftwareUnitBuildConfig(fallbackBuildConfig, "", "Komponenten/IoT-Device 1"),
    }] : [];
  }
  const seen = new Set();
  let embeddedIndex = 0;
  return rawUnits.slice(0, 40).map((unit, index) => {
    const candidate = String(unit?.software_unit_id || unit?.id || `software_${index + 1}`)
      .trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80) || `software_${index + 1}`;
    let softwareUnitId = candidate;
    for (let suffix = 2; seen.has(softwareUnitId); suffix += 1) softwareUnitId = `${candidate}_${suffix}`.slice(0, 80);
    seen.add(softwareUnitId);
    const buildSystem = String(unit?.build_system || (unit?.build_config ? "platformio" : "none")).trim().toLowerCase().slice(0, 40);
    const previousSourceRoot = normalizeOptionalSourcePath(unit?.source_root || "").replace(/\/$/, "");
    const embedded = String(unit?.software_kind || "") === "embedded_firmware" || buildSystem === "platformio";
    if (embedded) embeddedIndex += 1;
    const sourceRoot = componentSoftwareRoot(unit, embedded ? embeddedIndex : index + 1, previousSourceRoot);
    return {
      software_unit_id: softwareUnitId,
      title: String(unit?.title || `Software ${index + 1}`).trim().slice(0, 120),
      software_kind: String(unit?.software_kind || "software").trim().toLowerCase().slice(0, 60),
      build_system: buildSystem,
      source_root: sourceRoot,
      entrypoint: componentRelativeSourcePath(unit?.entrypoint || defaultUserSourcePath(unit?.build_config), previousSourceRoot, sourceRoot),
      device_id: String(unit?.device_id || "").trim().slice(0, 180),
      hardware_profile_id: String(unit?.hardware_profile_id || "").trim().slice(0, 180),
      build_config: buildSystem === "platformio" && unit?.build_config
        ? normalizeSoftwareUnitBuildConfig(unit.build_config, previousSourceRoot, sourceRoot)
        : null,
      build_configuration: buildSystem === "platformio" || !unit?.build_configuration
        ? null
        : JSON.parse(JSON.stringify(unit.build_configuration)),
    };
  });
}

function componentSoftwareRoot(unit, index, previousSourceRoot = "") {
  const embedded = String(unit?.software_kind || "") === "embedded_firmware" || String(unit?.build_system || "") === "platformio";
  const existingComponent = String(previousSourceRoot).match(/^(Komponenten\/[^/]+)/)?.[1];
  if (embedded && (!existingComponent || /^Komponenten\/IoT-Device(?:[ -]|$)/i.test(existingComponent))) {
    return `Komponenten/IoT-Device ${index}`;
  }
  if (existingComponent) return existingComponent;
  if (embedded) return `Komponenten/IoT-Device ${index}`;
  const label = String(unit?.title || unit?.software_unit_id || `Software ${index}`)
    .trim().replace(/[^A-Za-z0-9ÄÖÜäöüß._ -]+/g, "-").replace(/\s+/g, " ").slice(0, 100) || `Software ${index}`;
  return `Komponenten/${label}`;
}

function componentRelativeSourcePath(value, previousSourceRoot, componentRoot) {
  let sourcePath = normalizeOptionalSourcePath(value || "");
  for (const prefix of [previousSourceRoot, componentRoot].filter(Boolean)) {
    if (sourcePath.startsWith(`${prefix}/`)) sourcePath = sourcePath.slice(prefix.length + 1);
  }
  sourcePath = sourcePath.replace(/^Komponenten\/[^/]+\//, "");
  return sourcePath;
}

function normalizeSoftwareUnitBuildConfig(input, previousSourceRoot, componentRoot) {
  const buildConfig = normalizeBuildConfig(input);
  if (!buildConfig) return null;
  return {
    ...buildConfig,
    user_source_path: componentRelativeSourcePath(defaultUserSourcePath(buildConfig), previousSourceRoot, componentRoot),
  };
}

function defaultUserSourcePath(buildConfig = {}) {
  return buildConfig.user_source_path || (buildConfig.firmware_basis_id ? "src/user_main.cpp" : "src/main.cpp");
}

function positiveInteger(value) {
  const normalized = Number(value);
  return Number.isInteger(normalized) && normalized > 0 ? normalized : 0;
}

function safeSingleLine(value) {
  const normalized = String(value || "").trim();
  return /[\r\n]/.test(normalized) ? "" : normalized.slice(0, 240);
}

function safeStringList(values) {
  return Array.from(new Set((Array.isArray(values) ? values : [])
    .map(safeSingleLine)
    .filter(Boolean)))
    .slice(0, 100);
}

function normalizePlatformioOptions(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return {};
  return Object.fromEntries(Object.entries(input).slice(0, 30)
    .map(([key, value]) => [String(key).trim(), safeSingleLine(value)])
    .filter(([key, value]) => /^[a-z][a-z0-9_.-]{0,79}$/i.test(key)
      && !RESERVED_PLATFORMIO_OPTIONS.has(key.toLowerCase())
      && value));
}

function normalizeBoardConfiguration(input = null) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  const features = {};
  for (const [featureId, raw] of Object.entries(input.board_features || {}).slice(0, 40)) {
    const id = String(featureId).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
    if (!id || !raw || typeof raw !== "object" || Array.isArray(raw)) continue;
    const pins = Object.fromEntries(Object.entries(raw.pins || {}).slice(0, 40)
      .map(([signal, pin]) => [String(signal).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60), Number(pin)])
      .filter(([signal, pin]) => signal && Number.isInteger(pin) && pin >= -1 && pin <= 255));
    features[id] = {
      enabled: raw.enabled === true,
      hardware: String(raw.hardware || "").slice(0, 100),
      driver: String(raw.driver || "").slice(0, 100),
      connection: String(raw.connection || "").slice(0, 100),
      pins,
      value: String(raw.value || "").slice(0, 100),
    };
  }
  return {
    schema_version: 1,
    source: ["catalog", "account", "project"].includes(input.source) ? input.source : "project",
    name: String(input.name || "").slice(0, 120),
    base_board_profile_id: String(input.base_board_profile_id || "").slice(0, 180),
    account_board_id: String(input.account_board_id || "").slice(0, 180),
    account_board_version: Number.isInteger(Number(input.account_board_version)) ? Number(input.account_board_version) : 0,
    board_support_source_id: String(input.board_support_source_id || "").slice(0, 100),
    board_support_release: input.board_support_release && typeof input.board_support_release === "object"
      ? JSON.parse(JSON.stringify(input.board_support_release))
      : null,
    board_features: features,
    snapshot_at: String(input.snapshot_at || input.saved_at || "").slice(0, 40),
  };
}

function normalizeComponentFeatures(input, basisVariant) {
  const configured = input && typeof input === "object" ? input : {};
  const immutable = basisVariant === "low"
    ? ["wifi", "http", "webserver"]
    : ["wifi", "mqtt", "ota", "http", "webserver"];
  const enabled = new Set(Array.isArray(configured.enabled) ? configured.enabled.map(String) : []);
  immutable.forEach((feature) => enabled.add(feature));
  return {
    enabled: Array.from(enabled),
    immutable,
    webserver: {
      title: String(configured.webserver?.title || "GerNetiX Device").slice(0, 80),
      measurement_chart: Boolean(configured.webserver?.measurement_chart),
      measurement_label: String(configured.webserver?.measurement_label || "Messwert").slice(0, 60),
      measurement_unit: String(configured.webserver?.measurement_unit || "").slice(0, 16),
    },
  };
}

function normalizeViewManifest(input = {}) {
  const manifest = input && typeof input === "object" ? input : {};
  const templateId = String(manifest.template_id || manifest.templateId || "").trim();
  const templateRef = manifest.template_ref || manifest.templateRef || {};
  const architectureDialog = manifest.architecture_dialog || manifest.architectureDialog;
  const homeAutomationConfiguration = manifest.home_automation_configuration || manifest.homeAutomationConfiguration;
  const gameConfiguration = manifest.game_configuration || manifest.gameConfiguration;
  const pwaDashboard = manifest.pwa_dashboard || manifest.pwaDashboard;
  const communicationSetup = manifest.communication_setup || manifest.communicationSetup;
  const productSourceReference = normalizeProtectedSourceReference(manifest.product_source_reference || manifest.productSourceReference);
  return {
    schema_version: Number(manifest.schema_version || manifest.schemaVersion || 1),
    title: manifest.title || "",
    summary: manifest.summary || "",
    ...(templateId ? {
      template_id: templateId,
      template_ref: {
        template_id: String(templateRef.template_id || templateRef.templateId || templateId),
        model_schema_version: Number(templateRef.model_schema_version || templateRef.modelSchemaVersion || 1),
        ...(templateRef.project_id ? { project_id: String(templateRef.project_id) } : {}),
        ...(templateRef.version ? { version: Number(templateRef.version) } : {}),
        ...(templateRef.source_sha256 ? { source_sha256: String(templateRef.source_sha256) } : {}),
        ...(templateRef.commit_sha ? { commit_sha: String(templateRef.commit_sha) } : {}),
      },
    } : {}),
    ...(architectureDialog && typeof architectureDialog === "object" ? { architecture_dialog: architectureDialog } : {}),
    ...(homeAutomationConfiguration && typeof homeAutomationConfiguration === "object"
      ? { home_automation_configuration: homeAutomationConfiguration }
      : {}),
    ...(gameConfiguration && typeof gameConfiguration === "object"
      ? { game_configuration: gameConfiguration }
      : {}),
    ...(pwaDashboard && typeof pwaDashboard === "object"
      ? { pwa_dashboard: normalizePwaDashboard(pwaDashboard) }
      : {}),
    ...(communicationSetup && typeof communicationSetup === "object"
      ? { communication_setup: normalizeProjectCommunicationSetup(communicationSetup) }
      : {}),
    ...(productSourceReference ? { product_source_reference: productSourceReference } : {}),
    primary_source_path: normalizeOptionalSourcePath(manifest.primary_source_path || manifest.primarySourcePath || ""),
    hide_source_editor: Boolean(manifest.hide_source_editor || manifest.hideSourceEditor),
    mode: manifest.mode || "guided_ide",
    entry_mode: manifest.entry_mode || manifest.entryMode || "project_story",
    lesson_focus_id: String(manifest.lesson_focus_id || manifest.lessonFocusId || ""),
    parent_learning_project_id: String(manifest.parent_learning_project_id || manifest.parentLearningProjectId || ""),
    views: Array.isArray(manifest.views) ? manifest.views.map(normalizeProjectView).filter(Boolean) : [],
  };
}

function normalizePwaDashboard(input = {}) {
  const configured = input && typeof input === "object" ? input : {};
  const availableCards = new Set(["current_values", "history", "events", "device_status"]);
  const selected = Array.isArray(configured.visible_cards || configured.visibleCards)
    ? (configured.visible_cards || configured.visibleCards).map(String).filter((id) => availableCards.has(id))
    : Array.from(availableCards);
  return {
    schema_version: 1,
    title: String(configured.title || "Mein Datenlogger").trim().slice(0, 80),
    visible_cards: Array.from(new Set(selected)),
  };
}

function normalizeProjectView(input = {}) {
  if (!input || typeof input !== "object") return null;
  const id = String(input.id || "").trim();
  const type = String(input.type || "").trim();
  if (!id || !type) return null;
  return {
    id,
    type,
    lesson_id: String(input.lesson_id || input.lessonId || ""),
    title: input.title || id,
    summary: input.summary || input.text || "",
    source_path: normalizeOptionalSourcePath(input.source_path || input.sourcePath || ""),
    source_lines: Array.isArray(input.source_lines || input.sourceLines)
      ? (input.source_lines || input.sourceLines).map(Number).filter(Number.isFinite)
      : [],
    editable_lines: Array.isArray(input.editable_lines || input.editableLines)
      ? (input.editable_lines || input.editableLines).map(Number).filter(Number.isFinite)
      : [],
    completion: input.completion && typeof input.completion === "object" ? input.completion : {},
    validation: input.validation && typeof input.validation === "object" ? input.validation : {},
    controls: input.controls && typeof input.controls === "object" ? input.controls : {},
    required_functions: Array.isArray(input.required_functions || input.requiredFunctions)
      ? (input.required_functions || input.requiredFunctions).map(String).filter(Boolean)
      : [],
    media: input.media && typeof input.media === "object" ? input.media : {},
    runtime_preview: input.runtime_preview || input.runtimePreview || null,
    payload: input.payload && typeof input.payload === "object" ? input.payload : {},
  };
}

function normalizeSourcePath(value) {
  const normalized = value.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!normalized || normalized.includes("..")) {
    throw new ProjectServerError("invalid_source_path", "Source-Pfad muss relativ und innerhalb des Projekts liegen.");
  }
  return normalized;
}

function normalizeOptionalSourcePath(value) {
  const raw = String(value || "").trim();
  return raw ? normalizeSourcePath(raw) : "";
}

module.exports = {
  componentRelativeSourcePath,
  componentSoftwareRoot,
  defaultUserSourcePath,
  normalizeBoardConfiguration,
  normalizeBuildConfig,
  normalizeComponentFeatures,
  normalizeOptionalSourcePath,
  normalizePlatformioOptions,
  normalizeProjectView,
  normalizeProtectedSourceReference,
  normalizePwaDashboard,
  normalizeSoftwareUnitBuildConfig,
  normalizeSoftwareUnits,
  normalizeSourcePath,
  normalizeViewManifest,
  positiveInteger,
  safeSingleLine,
  safeStringList,
};
