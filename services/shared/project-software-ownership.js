const PASSIVE_HARDWARE_TYPES = new Set(["sensor", "actuator", "actor", "structural"]);

function architectureHardwareComponents(value) {
  if (Array.isArray(value?.components)) return value.components;
  const views = Array.isArray(value?.views) ? value.views : [];
  const hardwareView = views.find((view) => view?.type === "hardware_configuration");
  return Array.isArray(hardwareView?.payload?.components) ? hardwareView.payload.components : [];
}

function softwareArchitectureComponents(components, hardwareConfiguration) {
  const hardwareById = new Map(architectureHardwareComponents(hardwareConfiguration)
    .map((component) => [String(component?.component_id || ""), component]));
  return (Array.isArray(components) ? components : []).filter((component) => {
    const hardwareType = String(hardwareById.get(String(component?.component_id || ""))?.abstract_type || "").toLowerCase();
    return !PASSIVE_HARDWARE_TYPES.has(hardwareType);
  });
}

function filterSoftwareUnitsForArchitecture(units, hardwareConfigurationOrManifest) {
  const components = architectureHardwareComponents(hardwareConfigurationOrManifest);
  if (!components.length) return Array.isArray(units) ? units : [];
  const devices = components.filter((component) => String(component?.abstract_type || "").toLowerCase() === "iot_device");
  const passiveComponents = components.filter((component) => PASSIVE_HARDWARE_TYPES.has(String(component?.abstract_type || "").toLowerCase()));

  return (Array.isArray(units) ? units : []).filter((unit) => {
    const embedded = String(unit?.software_kind || "").toLowerCase() === "embedded_firmware"
      || String(unit?.build_system || "").toLowerCase() === "platformio";
    if (embedded) return devices.some((component) => softwareUnitMatchesComponent(unit, component));
    return !passiveComponents.some((component) => softwareUnitMatchesComponent(unit, component));
  });
}

function softwareUnitMatchesComponent(unit, component) {
  const componentId = String(component?.component_id || "").trim();
  const expectedUnitId = normalizeSoftwareUnitId(`software_${componentId}`);
  const unitId = normalizeSoftwareUnitId(unit?.software_unit_id || unit?.id || "");
  if (componentId && unitId === expectedUnitId) return true;

  const sourceRoot = normalizeRoot(unit?.source_root);
  const componentRoot = normalizeRoot(component?.component_path);
  if (sourceRoot && componentRoot && sourceRoot === componentRoot) return true;

  const title = String(unit?.title || "").trim().toLowerCase();
  const label = String(component?.label || "").trim().toLowerCase();
  return Boolean(title && label && title === label);
}

function normalizeSoftwareUnitId(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
}

function normalizeRoot(value) {
  return String(value || "").trim().replace(/\/$/, "");
}

module.exports = {
  filterSoftwareUnitsForArchitecture,
  softwareArchitectureComponents,
};
