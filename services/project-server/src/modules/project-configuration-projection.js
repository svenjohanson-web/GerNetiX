const { renderBoardConfigurationHeader } = require("./esp32-basissoftware-package");

const PROJECT_CONFIGURATION_ROLE = "project_configuration";
const GENERATED_CONFIGURATION_ROLE = "generated_configuration_header";
const VOLATILE_KEYS = new Set([
  "allocated_at",
  "created_at",
  "generated_at",
  "saved_at",
  "snapshot_at",
  "updated_at",
]);
const SECRET_KEYS = new Set([
  "access_point_password",
  "password",
  "private_key",
  "secret",
  "token",
]);

function projectConfigurationSources(project = {}) {
  const sources = [];
  const manifest = objectValue(project.view_manifest);
  const softwareUnits = Array.isArray(project.software_units) ? project.software_units : [];
  const architecture = manifestView(manifest, "architecture-diagram");
  const hardware = manifestView(manifest, "hardware-configuration");

  sources.push(jsonSource("gernetix/project.json", {
    schema_version: 1,
    project_id: project.project_id || "",
    title: project.title || "",
    description: project.description || "",
    hardware_profile_id: project.hardware_profile_id || "",
    active_software_unit_id: project.active_software_unit_id || "",
    template_ref: manifest.template_ref || null,
  }));

  if (architecture?.payload?.source) {
    sources.push(textSource(
      "gernetix/architecture/project.puml",
      ensureTrailingNewline(architecture.payload.source),
      "text/plain",
    ));
  }

  if (hardware?.payload && typeof hardware.payload === "object") {
    const components = Array.isArray(hardware.payload.components) ? hardware.payload.components : [];
    sources.push(jsonSource("gernetix/hardware/allocation.json", {
      ...withoutKeys(hardware.payload, ["components"]),
      components: components.map(hardwareAllocationComponent),
    }));
    for (const component of components) {
      if (component?.abstract_type !== "iot_device" || !component.board_configuration) continue;
      const componentId = safePathSegment(component.component_id || component.label || "board");
      sources.push(jsonSource(`gernetix/hardware/boards/${componentId}.json`, component.board_configuration));
    }
  }

  addManifestConfiguration(sources, manifest, "architecture_dialog", "gernetix/configuration/architecture-dialog.json");
  addManifestConfiguration(sources, manifest, "communication_setup", "gernetix/configuration/communication.json");
  addManifestConfiguration(sources, manifest, "home_automation_configuration", "gernetix/configuration/home-automation.json");
  addManifestConfiguration(sources, manifest, "game_configuration", "gernetix/configuration/game.json");
  addManifestConfiguration(sources, manifest, "pwa_dashboard", "gernetix/configuration/pwa-dashboard.json");
  addManifestConfiguration(sources, manifest, "data_logger", "gernetix/configuration/data-logger.json");
  addManifestConfiguration(sources, manifest, "event_configuration", "gernetix/configuration/events.json");

  for (const unit of [...softwareUnits].sort((left, right) => String(left.software_unit_id).localeCompare(String(right.software_unit_id)))) {
    const unitId = safePathSegment(unit.software_unit_id || unit.title || "software");
    const buildConfig = objectValue(unit.build_config);
    const sourceRoot = String(unit.source_root || "").replace(/\/$/, "");
    sources.push(jsonSource(`gernetix/software-units/${unitId}.json`, {
      schema_version: 1,
      software_unit_id: unit.software_unit_id || "",
      title: unit.title || "",
      software_kind: unit.software_kind || "",
      build_system: unit.build_system || "none",
      source_root: sourceRoot,
      entrypoint: unit.entrypoint || "",
      hardware_profile_id: unit.hardware_profile_id || "",
      build: withoutKeys(buildConfig, [
        "basissoftware_configuration",
        "board_configuration",
        "component_device_allocations",
        "component_features",
        "component_hardware_features",
      ]),
    }));

    if (buildConfig.firmware_basis_id) {
      sources.push(jsonSource(
        `gernetix/configuration/basissoftware/${unitId}.json`,
        buildConfig.basissoftware_configuration || {},
      ));
    }
    if (buildConfig.component_features) {
      sources.push(jsonSource(
        `gernetix/configuration/software-features/${unitId}.json`,
        buildConfig.component_features,
      ));
    }
    for (const [componentId, configuration] of Object.entries(objectValue(buildConfig.component_hardware_features))) {
      sources.push(jsonSource(
        `gernetix/configuration/board-peripherals/${safePathSegment(componentId)}.json`,
        configuration,
      ));
    }
    if (sourceRoot && buildConfig.board_configuration) {
      sources.push({
        path: `${sourceRoot}/include/gernetix_board_configuration.h`,
        role: GENERATED_CONFIGURATION_ROLE,
        content_type: "text/x-c++hdr",
        content: renderBoardConfigurationHeader(buildConfig.board_configuration),
      });
    }
  }

  return uniqueSources(sources).sort((left, right) => left.path.localeCompare(right.path));
}

function hardwareAllocationComponent(component = {}) {
  const result = withoutKeys(component, [
    "board_configuration",
    "inventory_device_id",
    "inventory_device_label",
  ]);
  if (component.abstract_type === "iot_device" && component.board_configuration) {
    result.board_configuration_path = `gernetix/hardware/boards/${safePathSegment(component.component_id || component.label || "board")}.json`;
  }
  return result;
}

function addManifestConfiguration(sources, manifest, key, path) {
  if (!manifest[key] || typeof manifest[key] !== "object") return;
  sources.push(jsonSource(path, manifest[key]));
}

function manifestView(manifest, id) {
  return (Array.isArray(manifest.views) ? manifest.views : []).find((view) => view?.id === id) || null;
}

function jsonSource(path, value) {
  return {
    path,
    role: PROJECT_CONFIGURATION_ROLE,
    content_type: "application/json",
    content: `${JSON.stringify(stableValue(value), null, 2)}\n`,
  };
}

function textSource(path, content, contentType) {
  return { path, role: PROJECT_CONFIGURATION_ROLE, content_type: contentType, content };
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value)
    .filter((key) => !VOLATILE_KEYS.has(key))
    .sort()
    .map((key) => [key, SECRET_KEYS.has(key) && value[key] ? "<runtime-secret>" : stableValue(value[key])]));
}

function withoutKeys(value, keys) {
  const omitted = new Set(keys);
  return Object.fromEntries(Object.entries(objectValue(value)).filter(([key]) => !omitted.has(key)));
}

function uniqueSources(sources) {
  const byPath = new Map();
  for (const source of sources) byPath.set(source.path, source);
  return [...byPath.values()];
}

function safePathSegment(value) {
  return String(value || "item")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100) || "item";
}

function ensureTrailingNewline(value) {
  return `${String(value || "").replace(/\s+$/, "")}\n`;
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

module.exports = {
  GENERATED_CONFIGURATION_ROLE,
  PROJECT_CONFIGURATION_ROLE,
  projectConfigurationSources,
  stableValue,
};
