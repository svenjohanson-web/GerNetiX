import { escapeAttribute, escapeHtml, projectById } from "@app/app-runtime-utils.js";
import { state } from "@app/platform-state.js";

/*
 * Projektstruktur und Quellbaum der Werkbank.
 *
 * Herausgeloest aus app-ide-controller.js: welche Softwareeinheiten und
 * Hardwarekomponenten ein Projekt hat, welche Quellen daraus im Projektbrowser
 * erscheinen und wie der Baum daraus aufgebaut wird.
 *
 * Der Controller behaelt das Laden, Auswaehlen und Speichern; hier steht, was
 * sich aus einem Projekt ableiten laesst.
 */

function activeIdeSoftwareUnit(project = projectById(state.activeProjectId)) {
  const units = project?.softwareUnits || [];
  const selectedId = state.activeSoftwareUnitIds[project?.id] || project?.activeSoftwareUnitId;
  return units.find((unit) => unit.software_unit_id === selectedId) || units[0] || null;
}

function projectSoftwareUnits(project = projectById(state.activeProjectId)) {
  return Array.isArray(project?.softwareUnits) ? project.softwareUnits : [];
}

function projectNeedsHardwareTools(project) {
  const capabilities = projectCapabilityIds(project);
  const softwareUnit = activeIdeSoftwareUnit(project);
  if (softwareUnit) return softwareUnit.build_system === "platformio";
  return Boolean(project?.buildConfig)
    || capabilities.some((capability) => ["flash_firmware", "ota", "ide_flash_usb", "ide_flash_ota", "cloud_flash"].includes(capability));
}

function projectCapabilityIds(project) {
  return (project?.requiredCapabilityIds || [])
    .map((capability) => String(capability).replace(/^system_capability\./, "").replace(/^capability\./, ""))
    .filter(Boolean);
}

function projectBrowserSources(project, sources) {
  const hardwareMappings = projectHardwareComponents(project)
    .filter((component) => component.abstract_type === "iot_device" && component.component_path)
    .map((component) => ({
      sourcePrefix: String(component.component_path).replace(/\/$/, ""),
      treePrefix: `Komponenten/${componentTreeLabel(component)}`,
    }))
    .sort((left, right) => right.sourcePrefix.length - left.sourcePrefix.length);
  const primaryPath = primaryComponentPath(project);
  const mappings = hardwareMappings.length || !projectNeedsHardwareTools(project) || !primaryPath
    ? hardwareMappings
    : [{ sourcePrefix: String(primaryPath).replace(/\/$/, ""), treePrefix: `Komponenten/${String(primaryPath).split("/").at(-1) || "IoT-Device"}` }];
  const primaryMapping = mappings.find((mapping) => mapping.sourcePrefix === String(primaryPath || "").replace(/\/$/, "")) || mappings[0];
  const mappedSources = !mappings.length ? sources : sources.map((source) => {
    const mapping = mappings.find((item) => source.path === item.sourcePrefix || source.path.startsWith(`${item.sourcePrefix}/`));
    if (!mapping) {
      const rootSource = String(source.path || "").match(/^(?:src|source|include)\/(.+)$/i);
      return rootSource && primaryMapping
        ? { ...source, treePath: `${primaryMapping.treePrefix}/${sourceTreeRelativePath(source.path)}` }
        : source;
    }
    let relativePath = source.path.slice(mapping.sourcePrefix.length).replace(/^\//, "");
    relativePath = sourceTreeRelativePath(relativePath);
    if (/^Konfiguration\//.test(relativePath) && !/^Konfiguration\/(Hardware|Software)\//.test(relativePath)) {
      relativePath = relativePath.replace(/^Konfiguration\//, "Konfiguration/Hardware/");
    }
    return { ...source, treePath: [mapping.treePrefix, relativePath].filter(Boolean).join("/") };
  });
  const hiddenGeneratedRoles = new Set([
    "component_data",
    "component_relations",
    "device_board_config",
    "device_measurement_circuit_config",
    "device_sensor_input_config",
    "device_actuator_output_config",
  ]);
  return mappedSources.filter((source) => !hiddenGeneratedRoles.has(source.role)
    && !(source.role === "component_software_config" && mappings.some((mapping) => String(source.treePath || "").startsWith(`${mapping.treePrefix}/`)))
    && !/\/Konfiguration\/Hardware\/(Sensoren\/in|Aktoren\/out)\.md$/i.test(String(source.treePath || source.path || "")));
}

function sourceTreeRelativePath(value) {
  const normalized = String(value || "").replace(/\\/g, "/").replace(/^\/+/, "");
  const sourceRoot = normalized.match(/^(src|source|include)(?:\/(.*))?$/i);
  if (!sourceRoot) return normalized;
  const rootName = sourceRoot[1].toLowerCase();
  const remainder = String(sourceRoot[2] || "").replace(/^\/+/, "");
  const cleanRemainder = remainder.replace(/^(?:src|include)\//i, "");
  if (rootName === "include" || /\.(?:h|hh|hpp|hxx|inc|inl|ipp|tpp|cuh)$/i.test(remainder)) {
    return ["Source", "include", cleanRemainder].filter(Boolean).join("/");
  }
  if (/\.(?:c|cc|cpp|cxx|m|mm|ino|cu)$/i.test(remainder)) {
    return ["Source", "src", cleanRemainder].filter(Boolean).join("/");
  }
  return ["Source", remainder].filter(Boolean).join("/");
}

function projectVirtualTreeEntries(project) {
  const entries = [];
  const hardwareComponents = projectHardwareComponents(project);
  projectSoftwareUnits(project).filter((unit) => /\.(?:c|cc|cpp|cxx|m|mm|ino|cu)$/i.test(
    unit.entrypoint || unit.build_config?.user_source_path || "",
  )).forEach((unit) => {
    const sourceRoot = String(unit.source_root || "").replace(/\/$/, "");
    const component = hardwareComponents.find((item) => String(item.component_path || "").replace(/\/$/, "") === sourceRoot);
    const label = component ? componentTreeLabel(component) : sourceRoot.split("/").at(-1);
    if (!label) return;
    entries.push(
      { path: `Komponenten/${label}/Source/include`, directoryOnly: true },
      { path: `Komponenten/${label}/Source/src`, directoryOnly: true },
    );
  });
  const communicationUnits = projectSoftwareUnits(project)
    .filter((unit) => unit.build_system === "platformio" || unit.software_kind === "embedded_firmware");
  if (communicationUnits.length > 1) entries.push({
    path: "Konfiguration/Kommunikationssetup",
    role: "",
    virtualAction: "communication-setup",
  });
  const configurationDevices = ideDeviceConfigurationComponents(project);
  const primaryPath = primaryComponentPath(project);
  const primaryDevice = configurationDevices.find((component) => component.component_path === primaryPath) || configurationDevices[0];
  if (projectNeedsHardwareTools(project) && primaryDevice) {
    const component = `Komponenten/${componentTreeLabel(primaryDevice)}`;
    entries.push(
      { path: `${component}/Konfiguration/Treiber`, role: "", virtualAction: "driver-management" },
      { path: `${component}/Konfiguration/Weboberfläche`, role: "", virtualAction: "web-interface" },
    );
  }
  configurationDevices.forEach((component) => {
    const label = componentTreeLabel(component);
    if (component.abstract_type === "iot_device") {
      const softwareUnit = softwareUnitForIdeComponent(project, component);
      if (softwareUnit?.build_config?.firmware_basis_id) entries.push({
        path: `Komponenten/${label}/Konfiguration/Basissoftware`,
        role: "",
        virtualAction: "component-features",
        componentId: component.component_id,
        softwareUnitId: softwareUnit.software_unit_id,
      });
      entries.push({
        path: `Komponenten/${label}/Konfiguration/Board`,
        role: "",
        virtualAction: "board-properties",
        componentId: component.component_id,
      });
      entries.push({
        path: `Komponenten/${label}/Konfiguration/Boardexterne Anschlüsse`,
        role: "",
        virtualAction: "device-connections",
        componentId: component.component_id,
      });
      return;
    }
    if (["event_worker", "event_dispatcher"].includes(component.abstract_type)
      || /ereignis-(?:worker|dispatcher)/i.test(String(component.label || ""))) {
      entries.push({
        path: `Komponenten/${label}/Konfiguration/Software/Regel-Konfiguration`,
        role: "",
        virtualAction: "worker-dispatcher-configuration",
        componentType: /dispatcher/i.test(String(component.label || "")) ? "dispatcher" : "worker",
      });
      return;
    }
    const configurationPath = ["sensor", "actuator", "iot_device"].includes(component.abstract_type)
      ? "Konfiguration/Hardware/Eigenschaften"
      : "Konfiguration/Eigenschaften";
    entries.push({
      path: `Komponenten/${label}/${configurationPath}`,
      role: "",
      virtualAction: component.abstract_type === "sensor" ? "sensor-properties" : "hardware-configuration",
      componentId: component.component_id,
    });
  });
  if (isPwaDashboardProject(project)) {
    entries.push({
      path: "Komponenten/Smartphone-App (PWA)/Konfiguration/PWA-Dashboard",
      role: "",
      virtualAction: "pwa-dashboard",
    });
  }
  return entries;
}

function softwareUnitForIdeComponent(project, component) {
  const units = projectSoftwareUnits(project);
  const componentPath = String(component?.component_path || "").replace(/\/$/, "");
  const exact = units.find((unit) => String(unit.source_root || "").replace(/\/$/, "") === componentPath);
  if (exact) return exact;
  const devices = ideDeviceConfigurationComponents(project).filter((item) => item.abstract_type === "iot_device");
  const index = devices.findIndex((item) => item.component_id === component?.component_id);
  return units.filter((unit) => unit.build_system === "platformio")[index] || null;
}

function ideDeviceConfigurationComponents(project) {
  const devices = projectHardwareComponents(project).filter((component) => component.abstract_type === "iot_device");
  if (devices.length || !projectNeedsHardwareTools(project)) return devices;
  const componentPath = primaryComponentPath(project) || "Komponenten/IoT-Device 1";
  return [{
    component_id: "primary-iot-device",
    component_path: componentPath,
    label: String(componentPath).split("/").at(-1) || "IoT-Device",
    abstract_type: "iot_device",
    board_profile_id: project?.buildConfig?.board_configuration?.base_board_profile_id
      || project?.hardwareProfileId
      || project?.hardware_profile_id
      || "",
    board_configuration: project?.buildConfig?.board_configuration || null,
  }];
}

function isPwaDashboardProject(project) {
  return project?.viewManifest?.template_id === "iot_datalogger_web_push_pwa";
}

function componentTreeLabel(component) {
  return String(component?.label || component?.component_id || "Komponente").replace(/[\\/]+/g, "-");
}

function projectHardwareComponents(project) {
  const view = (project?.viewManifest?.views || []).find((item) => item.id === "hardware-configuration");
  const supportedTypes = new Set(["iot_device", "sensor", "actuator", "actor", "structural"]);
  return Array.isArray(view?.payload?.components)
    ? view.payload.components.filter((component) => supportedTypes.has(component.abstract_type))
    : [];
}

function renderSourceTree(node, depth = 0, openFolders = new Set()) {
  const folders = Array.from(node.folders.values()).sort((left, right) => left.name.localeCompare(right.name));
  const files = node.files.sort((left, right) => left.name.localeCompare(right.name));
  const children = [
    ...folders.map((folder) => renderSourceTree(folder, depth + 1, openFolders)),
    ...files.map((file) => `
      <button class="${file.path === (state.ideTreeSelectionPath || state.sourcePath) ? "active" : ""}" type="button" data-ide-tree-path="${escapeAttribute(file.path)}" ${file.virtualAction === "component-features"
          ? `data-component-features="${escapeAttribute(file.softwareUnitId || "")}" data-component-id="${escapeAttribute(file.componentId || "")}"`
          : file.virtualAction === "communication-setup"
            ? "data-communication-setup"
          : file.virtualAction === "driver-management"
            ? "data-driver-management"
          : file.virtualAction === "sensor-properties"
            ? `data-sensor-properties="${escapeAttribute(file.componentId || "")}"`
          : file.virtualAction === "device-connections"
            ? `data-device-connections="${escapeAttribute(file.componentId || "")}"`
          : file.virtualAction === "web-interface"
            ? "data-web-interface"
            : file.virtualAction === "pwa-dashboard"
              ? "data-pwa-dashboard"
            : file.virtualAction === "board-properties"
              ? `data-board-properties="${escapeAttribute(file.componentId || "")}"`
          : file.virtualAction === "hardware-configuration"
              ? "data-hardware-configuration"
            : file.virtualAction === "worker-dispatcher-configuration"
              ? `data-worker-dispatcher-configuration="${escapeAttribute(file.componentType || "worker")}"`
            : `data-source-path="${escapeAttribute(file.path)}"`} style="--depth:${depth + 1}">
        <span>${escapeHtml(file.name)}</span>
      </button>
    `),
  ].join("");
  if (depth === 0) {
    return `
      <div class="ide-tree-root">
        <strong>${escapeHtml(node.name)}</strong>
        ${children}
      </div>
    `;
  }
  const containsActiveSource = treeContainsSource(node, state.ideTreeSelectionPath || state.sourcePath);
  return `
    <details class="ide-tree-folder" data-tree-path="${escapeAttribute(node.path)}" style="--depth:${depth}" ${openFolders.has(node.path) || containsActiveSource ? "open" : ""}>
      <summary>${escapeHtml(node.name)}</summary>
      ${children}
    </details>
  `;
}

function treeContainsSource(node, sourcePath) {
  if (node.files.some((file) => file.path === sourcePath)) return true;
  return Array.from(node.folders.values()).some((folder) => treeContainsSource(folder, sourcePath));
}

function primaryComponentPath(project) {
  return String(project?.buildConfig?.user_source_path || "").match(/^(Komponenten\/[^/]+)\//)?.[1] || "";
}

export {
  activeIdeSoftwareUnit,
  componentTreeLabel,
  ideDeviceConfigurationComponents,
  isPwaDashboardProject,
  primaryComponentPath,
  projectBrowserSources,
  projectCapabilityIds,
  projectHardwareComponents,
  projectNeedsHardwareTools,
  projectSoftwareUnits,
  projectVirtualTreeEntries,
  renderSourceTree,
  softwareUnitForIdeComponent,
  sourceTreeRelativePath,
  treeContainsSource,
};
