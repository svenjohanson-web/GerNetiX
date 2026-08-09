"use strict";

function createProjectHardwareModel({ developmentProjectTemplate, developmentProjectTemplateCatalog, filterSoftwareUnitsForArchitecture, mergeBoardFeatures, requiredField, softwareArchitectureComponents, templateArchitecturePlantUml }) {
function defaultHomeAutomationConfiguration() {
  return normalizeHomeAutomationConfiguration({
    coordinator: "undecided",
    failure_policy: "local_fallback",
    state_model: { commands: true, desired_state: true, actual_state: true, events: true },
    nodes: [
      { node_id: "node_1", name: "Raumklima", role: "sensor_node", transport: "undecided", sensor_count: 2, actuator_count: 0, board_features: {} },
      { node_id: "node_2", name: "Lichtsteuerung", role: "actuator_node", transport: "undecided", sensor_count: 0, actuator_count: 1, board_features: {} },
      { node_id: "node_3", name: "Touchpanel", role: "control_node", transport: "undecided", sensor_count: 0, actuator_count: 0, board_features: { integrated_display: true, integrated_touchscreen: true } },
    ],
  });
}

function normalizeHomeAutomationConfiguration(input) {
  if (!input || typeof input !== "object") return null;
  const coordinator = ["undecided", "none", "gernetix_home_server", "home_assistant", "gernetix_with_home_assistant"]
    .includes(input.coordinator) ? input.coordinator : "undecided";
  const failurePolicy = ["local_fallback", "safe_state", "central_required", "undecided"]
    .includes(input.failure_policy) ? input.failure_policy : "undecided";
  const roles = new Set(["sensor_node", "actuator_node", "combined_node", "control_node", "gateway"]);
  const transports = new Set(["undecided", "local", "wifi_rest", "wifi_mqtt", "zigbee"]);
  const boardFeatureIds = ["integrated_display", "integrated_touchscreen", "battery_operation", "sd_card", "audio", "many_gpio"];
  const nodes = (Array.isArray(input.nodes) ? input.nodes : []).slice(0, 30).map((node, index) => {
    const boardFeatures = Object.fromEntries(boardFeatureIds.map((id) => [id, node.board_features?.[id] === true]));
    if (Number(node.control_count) > 0) boardFeatures.integrated_touchscreen = true;
    if (boardFeatures.integrated_touchscreen) boardFeatures.integrated_display = true;
    return {
      node_id: String(node.node_id || `node_${index + 1}`).replace(/[^A-Za-z0-9_]/g, "_").slice(0, 60),
      name: String(node.name || `IoT-Device ${index + 1}`).trim().slice(0, 120),
      role: roles.has(node.role) ? node.role : "combined_node",
      transport: transports.has(node.transport) ? node.transport : "undecided",
      sensor_count: Math.max(0, Math.min(20, Number(node.sensor_count) || 0)),
      actuator_count: Math.max(0, Math.min(20, Number(node.actuator_count) || 0)),
      board_features: boardFeatures,
    };
  });
  const stateModel = input.state_model && typeof input.state_model === "object" ? input.state_model : {};
  return {
    schema_version: 2,
    coordinator,
    failure_policy: failurePolicy,
    state_model: {
      commands: stateModel.commands !== false,
      desired_state: stateModel.desired_state !== false,
      actual_state: stateModel.actual_state !== false,
      events: stateModel.events !== false,
    },
    nodes,
    updated_at: new Date().toISOString(),
  };
}

function defaultTouchscreenGameConfiguration() {
  return normalizeTouchscreenGameConfiguration({
    pattern_id: "",
    selected_game_ids: ["nibbles", "frogger"],
    board_profile_id: "hardware.processor_board.esp32_s3_es3c28p",
    inventory_device_id: "",
  });
}

function normalizeTouchscreenGameConfiguration(input) {
  if (!input || typeof input !== "object") return null;
  const patterns = new Set(["", "touchscreen_game_loop", "event_driven_scene_loop", "turn_based_state_machine"]);
  const games = new Set(["nibbles", "snake", "frogger", "tic_tac_toe", "pong", "breakout", "memory"]);
  const selectedGameIds = Array.from(new Set(Array.isArray(input.selected_game_ids) ? input.selected_game_ids : []))
    .filter((id) => games.has(id))
    .slice(0, 7);
  return {
    schema_version: 2,
    pattern_id: patterns.has(input.pattern_id) ? input.pattern_id : "",
    selected_game_ids: selectedGameIds,
    board_profile_id: String(input.board_profile_id || "").slice(0, 180),
    board_configuration: normalizeDevelopmentBoardConfiguration(input.board_configuration, input.board_profile_id),
    inventory_device_id: String(input.inventory_device_id || "").slice(0, 180),
    updated_at: new Date().toISOString(),
  };
}

function isTouchscreenGameBoard(board) {
  const capabilities = new Set(Array.isArray(board?.capability_ids) ? board.capability_ids : []);
  return capabilities.has("capability.touchscreen_input") || /touch/i.test(`${board?.title || ""} ${board?.form_factor || ""}`);
}

function touchscreenGameInventoryMatches(boardProfileId, device) {
  const inventoryProfile = String(device?.hardware_profile_id || "");
  return inventoryProfile === boardProfileId
    || (boardProfileId === "hardware.processor_board.generic_esp32_s3_touch_display" && /touch|display/i.test(inventoryProfile));
}

function restoreDevelopmentTemplateReference(manifest, project) {
  if (manifest?.template_id || project?.learning_project_id !== "development_project") return manifest;
  const architectureView = (manifest?.views || []).find((view) => view.id === "architecture-diagram" || view.type === "plantuml");
  const source = normalizeArchitecturePlantUml(stripPlantUmlNotes(architectureView?.payload?.source || ""), "project_template");
  if (!source) return manifest;
  const match = developmentProjectTemplateCatalog()
    .filter((template) => template.id !== "empty")
    .find((template) => normalizeArchitecturePlantUml(
      templateArchitecturePlantUml(developmentProjectTemplate(template.id), project.title),
      "project_template",
    ) === source);
  if (!match) return manifest;
  return {
    ...manifest,
    template_id: match.id,
    template_ref: { template_id: match.id, model_schema_version: match.model_schema_version || 1 },
  };
}

function normalizeArchitectureDiagram(input = {}) {
  const derivedFrom = String(input.derived_from || input.derivedFrom || "architecture_discovery_ai_response").trim();
  const source = normalizeArchitecturePlantUml(stripPlantUmlNotes(input.source || ""), derivedFrom);
  return {
    type: "plantuml",
    title: String(input.title || "Architektur-Skizze").trim(),
    summary: String(input.summary || "Gespeicherte Architektur-Skizze.").trim(),
    source,
    derived_from: derivedFrom,
    generated_at: String(input.generated_at || input.generatedAt || new Date().toISOString()).trim(),
    confidence: Number(input.confidence || 0),
    detected_blocks: Array.isArray(input.detected_blocks || input.detectedBlocks)
      ? (input.detected_blocks || input.detectedBlocks).map(String)
      : [],
  };
}

function stripPlantUmlNotes(source) {
  const lines = String(source || "").split(/\r?\n/);
  const cleaned = [];
  let inNote = false;
  for (const line of lines) {
    if (/^\s*note\b/i.test(line)) {
      inNote = true;
      continue;
    }
    if (inNote) {
      if (/^\s*end\s+note\b/i.test(line)) inNote = false;
      continue;
    }
    cleaned.push(line);
  }
  return cleaned.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

function normalizeArchitecturePlantUml(source, derivedFrom = "") {
  const isTemplate = derivedFrom === "project_template" || /Startarchitektur aus Projekttemplate/i.test(source);
  // Logische Architektur bleibt notationsoffen; konkrete UML-Symbole gehoeren in Realisierungssichten.
  let normalized = String(source || "")
    .replace(/^(\s*)(?:node|component|database|cloud|queue|artifact)\s+("[^"]+")(\s+as\s+[A-Za-z_][A-Za-z0-9_]*)?/gmi, "$1rectangle $2$3");
  if (isTemplate) {
    normalized = normalized
      .replace(/ESP32 Datenlogger/g, "IoT-Device Datenlogger")
      .replace(/ESP32 Device/g, "IoT-Device")
      .replace(/ESP32-Device/g, "IoT-Device")
      .replace(/^\s*Startarchitektur aus Projekttemplate;.*$/gmi, "");
  }
  return numberGenericIotDeviceInstances(normalized).replace(/\n{3,}/g, "\n\n").trim();
}

function numberGenericIotDeviceInstances(source) {
  const text = String(source || "");
  const usedNumbers = new Set(Array.from(text.matchAll(/\bIoT[- ]Device\s+(\d+)\b/gi), (match) => Number(match[1])));
  let nextNumber = 1;
  return text.replace(/(\brectangle\s+")IoT[- ]Device(")/gi, (_match, prefix, suffix) => {
    while (usedNumbers.has(nextNumber)) nextNumber += 1;
    const instanceNumber = nextNumber;
    usedNumbers.add(instanceNumber);
    nextNumber += 1;
    return `${prefix}IoT-Device ${instanceNumber}${suffix}`;
  });
}

function architectureDiagramFromManifest(manifest = {}) {
  const view = (Array.isArray(manifest.views) ? manifest.views : [])
    .find((item) => item.id === "architecture-diagram" || item.type === "plantuml");
  return normalizeArchitectureDiagram({
    title: view?.title,
    summary: view?.summary,
    ...(view?.payload || {}),
  });
}

function hardwareConfigurationFromManifest(manifest = {}) {
  const view = (Array.isArray(manifest?.views) ? manifest.views : [])
    .find((item) => item.id === "hardware-configuration");
  return view?.payload && typeof view.payload === "object" ? view.payload : null;
}

function normalizeHardwareConfiguration(input = {}, project = {}) {
  const raw = input && typeof input === "object" ? input : {};
  const rawComponents = Array.isArray(raw.components) ? raw.components.slice(0, 100) : [];
  const embeddedUnits = platformSoftwareUnits(project).filter((unit) => unit.software_kind === "embedded_firmware");
  const usedEmbeddedUnitIds = new Set();
  let deviceIndex = 0;
  const components = rawComponents.map((component) => {
    const abstractType = ["iot_device", "sensor", "actuator", "actor", "structural"].includes(component.abstract_type)
      ? component.abstract_type
      : "structural";
    const concreteType = String(component.concrete_type || "").trim().slice(0, 80);
    const normalized = {
      component_id: requiredField(component.component_id, "component_id").replace(/[^A-Za-z0-9_]/g, "_").slice(0, 80),
      label: requiredField(component.label, "label").slice(0, 160),
      plantuml_type: String(component.plantuml_type || "component").slice(0, 40),
      abstract_type: abstractType,
      concrete_type: concreteType,
      sensor_category: String(component.sensor_category || "").trim().toLowerCase().slice(0, 80),
      signal_type: String(component.signal_type || "").trim().toLowerCase().slice(0, 80),
      processor_family: String(component.processor_family || "").trim().toLowerCase().slice(0, 80),
      processor_variant: String(component.processor_variant || "").trim().slice(0, 120),
      board_profile_id: String(component.board_profile_id || "").slice(0, 180),
      board_configuration: abstractType === "iot_device" ? normalizeDevelopmentBoardConfiguration(component.board_configuration, component.board_profile_id) : null,
      inventory_device_id: String(component.inventory_device_id || "").slice(0, 180),
      inventory_device_label: String(component.inventory_device_label || "").slice(0, 180),
      target_device_id: String(component.target_device_id || "").replace(/[^A-Za-z0-9_]/g, "_").slice(0, 80),
      pin: String(component.pin || "").slice(0, 80),
      secondary_pin: String(component.secondary_pin || "").slice(0, 80),
      properties: normalizeHardwareProperties(component.properties),
      circuit: hardwareCircuitFor(concreteType, component.properties, abstractType, component.label),
    };
    if (abstractType === "iot_device") {
      const matchingUnit = embeddedUnits.find((unit) => !usedEmbeddedUnitIds.has(unit.software_unit_id)
        && unit.hardware_profile_id && unit.hardware_profile_id === normalized.board_profile_id)
        || embeddedUnits.find((unit) => !usedEmbeddedUnitIds.has(unit.software_unit_id)
          && unit.source_root === component.component_path)
        || embeddedUnits.find((unit) => !usedEmbeddedUnitIds.has(unit.software_unit_id));
      if (matchingUnit) usedEmbeddedUnitIds.add(matchingUnit.software_unit_id);
      normalized.component_path = `Komponenten/IoT-Device ${deviceIndex + 1}`;
      deviceIndex += 1;
    }
    return normalized;
  });
  const devicesById = new Map(components
    .filter((component) => component.abstract_type === "iot_device")
    .map((component) => [component.component_id, component]));
  for (const component of components.filter((item) => ["sensor", "actuator"].includes(item.abstract_type))) {
    const boardFeatureId = boardFeatureIdForHardwareComponent(component, devicesById.get(component.target_device_id));
    component.hardware_scope = boardFeatureId ? "board_integrated" : "board_external";
    component.board_feature_id = boardFeatureId;
  }
  return {
    schema_version: 6,
    components,
    updated_at: new Date().toISOString(),
  };
}

function normalizeDevelopmentBoardConfiguration(input, boardProfileId) {
  if (!boardProfileId || !input || typeof input !== "object") return null;
  const source = ["catalog", "account", "project", "custom", "custom_draft"].includes(input.source) ? input.source : "catalog";
  const boardFeatures = {};
  const rawFeatures = input.board_features && typeof input.board_features === "object" && !Array.isArray(input.board_features)
    ? input.board_features
    : {};
  for (const [featureId, value] of Object.entries(rawFeatures).slice(0, 30)) {
    const normalizedId = String(featureId).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
    if (!normalizedId || !value || typeof value !== "object" || Array.isArray(value)) continue;
    const pins = {};
    if (value.pins && typeof value.pins === "object" && !Array.isArray(value.pins)) {
      for (const [signal, pin] of Object.entries(value.pins).slice(0, 30)) {
        const normalizedSignal = String(signal).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
        if (normalizedSignal && Number.isInteger(pin) && pin >= -1 && pin <= 255) pins[normalizedSignal] = pin;
      }
    }
    boardFeatures[normalizedId] = {
      enabled: value.enabled === true,
      hardware: String(value.hardware || "").slice(0, 100),
      driver: String(value.driver || "").slice(0, 100),
      connection: String(value.connection || "").slice(0, 100),
      pins,
      value: String(value.value || "").slice(0, 100),
    };
  }
  return {
    schema_version: 1,
    source,
    name: source === "catalog" ? "" : String(input.name || "").trim().slice(0, 120),
    base_board_profile_id: String(input.base_board_profile_id || boardProfileId).slice(0, 180),
    board_features: boardFeatures,
    saved_at: ["account", "project", "custom"].includes(source) ? String(input.saved_at || "").slice(0, 40) : "",
    account_board_id: String(input.account_board_id || "").slice(0, 180),
    account_board_version: Number.isInteger(Number(input.account_board_version)) ? Number(input.account_board_version) : 0,
  };
}

function compilerBoardConfiguration(configuration, board = null) {
  if (!configuration && !board) return null;
  const source = configuration?.source === "project" || board?.configuration_scope === "project"
    ? "project"
    : configuration?.account_board_id || board?.account_board_id || board?.configuration_scope === "account"
    ? "account"
    : configuration?.source === "catalog" || board?.configuration_scope === "gernetix"
      ? "catalog"
      : "project";
  return {
    schema_version: 1,
    source,
    name: configuration?.name || board?.title || "",
    base_board_profile_id: configuration?.base_board_profile_id || board?.base_board_profile_id || board?.hardware_item_id || "",
    account_board_id: configuration?.account_board_id || board?.account_board_id || "",
    account_board_version: configuration?.account_board_version || board?.account_board_version || 0,
    board_features: mergeBoardFeatures(
      board?.default_instance_configuration?.board_features,
      configuration?.board_features,
    ),
    snapshot_at: new Date().toISOString(),
  };
}

function normalizeHardwareProperties(input = {}) {
  const result = {};
  if (!input || typeof input !== "object") return result;
  for (const [key, value] of Object.entries(input).slice(0, 30)) {
    const normalizedKey = String(key).replace(/[^A-Za-z0-9_]/g, "_").slice(0, 60);
    if (!normalizedKey) continue;
    result[normalizedKey] = String(value ?? "").slice(0, 300);
  }
  return result;
}

function hardwareCircuitFor(concreteType, properties = {}, abstractType = "", componentLabel = "Komponente") {
  if (concreteType === "pt1000") return { type: "pt1000_measurement", label: "PT1000-Messschaltung", stages: ["PT1000", "Konstantstromquelle / Messbruecke", "Messverstaerker", "ADC"] };
  if (["ntc", "ptc"].includes(concreteType)) return { type: "resistive_divider", label: "Widerstands-Messschaltung", stages: [concreteType.toUpperCase(), "Spannungsteiler", "ADC"] };
  const driver = String(properties?.motor_driver_type || "");
  if (concreteType === "dc_motor") return { type: "motor_driver", label: "DC-Motorsteuerung", stages: ["PWM / Richtung", driver === "low_side_mosfet" ? "MOSFET-Treiber" : "H-Bruecke", "DC-Motor"] };
  if (concreteType === "servo") return { type: "servo_driver", label: "Servo-Steuerung", stages: ["Zeitgeber", "Servo-PWM", "Servo"] };
  if (concreteType === "stepper_motor") return { type: "stepper_driver", label: "Schrittmotor-Steuerung", stages: ["Zeitgeber / RMT", driver === "four_phase" ? "4-Phasen-Treiber" : "STEP/DIR-Treiber", "Schrittmotor"] };
  if (concreteType === "synchronous_motor") return { type: "synchronous_motor_driver", label: "Synchronmotor-Steuerung", stages: [driver === "three_phase_six_step" ? "6-Step-Kommutierung" : "FOC", "Motor-PWM / ADC / Rotorlage", "3-Phasen-Leistungstreiber", "BLDC / PMSM"] };
  if (properties?.connection_mode === "additional_circuit") {
    const label = String(properties?.circuit_label || (abstractType === "actuator" ? "Treiber- / Leistungsschaltung" : "Signalaufbereitung / Schutzschaltung"));
    return abstractType === "actuator"
      ? { type: "actuator_interface_circuit", label, stages: ["Prozessorausgang", label, componentLabel] }
      : { type: "sensor_interface_circuit", label, stages: [componentLabel, label, "Prozessoreingang"] };
  }
  return null;
}

function hardwareConfigurationSources(configuration, title) {
  const devices = configuration.components.filter((component) => component.abstract_type === "iot_device");
  const deviceById = new Map(devices.map((component) => [component.component_id, component]));
  const sources = [{
    path: "Architektur/verdrahtung/hardware.puml",
    role: "hardware_architecture_view",
    content_type: "text/plain",
    content: hardwareWiringPlantUml(configuration, title),
  }];
  for (const device of devices) {
    const folder = device.component_path;
    const sensors = configuration.components.filter((component) => component.abstract_type === "sensor"
      && component.target_device_id === device.component_id && component.hardware_scope !== "board_integrated");
    const actuators = configuration.components.filter((component) => component.abstract_type === "actuator"
      && component.target_device_id === device.component_id && component.hardware_scope !== "board_integrated");
    sources.push({
      path: `${folder}/Konfiguration/Hardware/Board/board.md`,
      role: "device_board_config",
      content_type: "text/markdown",
      content: hardwareBoardMarkdown(device),
    });
    sources.push({
      path: `${folder}/Konfiguration/Hardware/Sensoren/in.md`,
      role: "device_sensor_input_config",
      content_type: "text/markdown",
      content: hardwareIoMarkdown("Sensor/in", device, sensors),
    });
    sources.push({
      path: `${folder}/Konfiguration/Hardware/Aktoren/out.md`,
      role: "device_actuator_output_config",
      content_type: "text/markdown",
      content: hardwareIoMarkdown("Aktor/out", device, actuators),
    });
  }
  for (const component of configuration.components.filter((item) => item.circuit)) {
    const device = deviceById.get(component.target_device_id);
    const folder = device?.component_path || primaryHardwareComponentPath(devices);
    sources.push({
      path: `${folder}/Konfiguration/Hardware/Schaltungen/${slugifyHardwareFolder(component.label)}.md`,
      role: "device_measurement_circuit_config",
      content_type: "text/markdown",
      content: hardwareCircuitMarkdown(component, device),
    });
  }
  return sources;
}

function primaryHardwareComponentPath(devices) {
  return devices[0]?.component_path || "Komponenten/IoT-Device";
}

function hardwareBoardMarkdown(device) {
  const boardConfiguration = device.board_configuration || null;
  const lines = [
    `# Board-Konfiguration: ${device.label}`,
    "",
    `- Prozessorfamilie: ${device.processor_family || "noch nicht gewaehlt"}`,
    `- Prozessor: ${device.processor_variant || "noch nicht gewaehlt"}`,
    `- Board-Profil: ${device.board_profile_id || "noch nicht gewaehlt"}`,
    `- Konfiguration: ${boardConfiguration?.source === "custom" ? `Eigenes Board „${boardConfiguration.name}“` : "Katalogstandard"}`,
    `- Abstrakte Komponente: ${device.component_id}`,
  ];
  for (const [featureId, feature] of Object.entries(boardConfiguration?.board_features || {})) {
    if (!feature.enabled) continue;
    const pins = Object.entries(feature.pins || {}).map(([signal, pin]) => `${signal}=GPIO${pin}`).join(", ");
    lines.push(`- ${featureId}: ${[feature.hardware, feature.driver, feature.connection, feature.value, pins].filter(Boolean).join(" · ")}`);
  }
  lines.push(
    "",
    "Diese Auswahl konkretisiert das abstrakte IoT-Device. Sensoren, Aktoren und Pins bleiben in den zugehoerigen Hardware-Sichten getrennt.",
    "",
  );
  return lines.join("\n");
}

function hardwareIoMarkdown(kind, device, components) {
  const lines = [`# ${kind}-Konfiguration: ${device.label}`, ""];
  if (!components.length) lines.push("- Keine Komponente zugeordnet.");
  for (const component of components) {
    lines.push(`## ${component.label}`);
    if (component.abstract_type === "sensor") lines.push(`- Sensorart: ${component.sensor_category || "offen"}`);
    if (component.abstract_type === "sensor") lines.push(`- Erfassung: ${component.signal_type || "offen"}`);
    lines.push(`- Konkreter Typ: ${component.concrete_type || "offen"}`);
    lines.push(`- Anschlussweg: ${component.properties?.connection_mode === "additional_circuit" ? "ueber zusaetzliche Schaltung" : "direkt am Prozessor / Board"}`);
    const boardFeature = boardFeatureForHardwareComponent(component, device);
    lines.push(boardFeature
      ? `- Pin-Zuordnung: ${formatHardwarePins(boardFeature.pins)} (Boardkonfiguration)`
      : `- Pin: ${component.pin || "offen"}`);
    if (component.secondary_pin) lines.push(`- Zweiter Pin: ${component.secondary_pin}`);
    if (component.circuit) lines.push(`- Vorschaltung: ${component.circuit.label}`);
    for (const [key, value] of Object.entries(component.properties || {})) lines.push(`- ${key}: ${value}`);
    lines.push("");
  }
  return `${lines.join("\n")}\n`;
}

function hardwareCircuitMarkdown(component, device) {
  return [
    `# Schaltung: ${component.label}`,
    "",
    `- Typ: ${component.circuit.label}`,
    `- Signalkette: ${component.circuit.stages.join(" -> ")}`,
    `- Ziel: ${device?.label || component.target_device_id || "IoT-Device"}`,
    `- Ausgang der Schaltung: ${component.pin || "ADC/GPIO noch offen"}`,
    "",
    "Die Vorschaltung ist ein notwendiger Teil der Hardware-Realisierung und keine direkte Sensor-Pin-Verbindung.",
    "",
  ].join("\n");
}

function hardwareWiringPlantUml(configuration, title) {
  const devices = new Map(configuration.components.filter((component) => component.abstract_type === "iot_device").map((component) => [component.component_id, component]));
  const lines = ["@startuml", `title Hardware-Architektur: ${String(title || "Entwicklungsprojekt").replace(/"/g, "'")}`, "left to right direction", "skinparam componentStyle rectangle", ""];
  for (const device of devices.values()) {
    const deviceLabel = plantUmlLabel([
      device.label,
      `Prozessorfamilie: ${device.processor_family || "offen"}`,
      `Prozessor: ${device.processor_variant || "offen"}`,
      `Board: ${device.board_configuration?.source === "custom" ? device.board_configuration.name : device.board_profile_id || "offen"}`,
      ...(device.board_configuration?.source === "custom" ? [`Basisprofil: ${device.board_profile_id}`] : []),
      ...hardwarePropertyLines(device.properties),
    ]);
    lines.push(`node "${deviceLabel}" as hw_${device.component_id}`);
    if (device.inventory_device_id) {
      const inventoryAlias = `inventory_${device.component_id}`;
      lines.push(`node "${plantUmlLabel(["Inventar-Device", device.inventory_device_label || device.inventory_device_id, `ID: ${device.inventory_device_id}`])}" as ${inventoryAlias}`);
      lines.push(`hw_${device.component_id} ..> ${inventoryAlias} : Inventarzuordnung`);
    }
  }
  for (const component of configuration.components.filter((item) => ["sensor", "actuator"].includes(item.abstract_type))) {
    const alias = `hw_${component.component_id}`;
    const detailLines = component.abstract_type === "sensor"
      ? [component.label, `Sensorart: ${component.sensor_category || "offen"}`, `Erfassung: ${component.signal_type || "offen"}`, `Sensor: ${component.concrete_type || "offen"}`]
      : [component.label, `Aktor: ${component.concrete_type || "offen"}`];
    lines.push(`component "${plantUmlLabel([...detailLines, ...hardwarePropertyLines(component.properties)])}" as ${alias}`);
    const boardFeature = boardFeatureForHardwareComponent(component, devices.get(component.target_device_id));
    const pinLabel = [boardFeature ? `Board-Pins: ${formatHardwarePins(boardFeature.pins)}` : component.pin || "Pin offen", component.secondary_pin ? `zweiter Pin: ${component.secondary_pin}` : ""].filter(Boolean).join(" / ");
    if (component.circuit) {
      lines.push(`component "${plantUmlLabel([component.circuit.label, ...component.circuit.stages])}" as ${alias}_circuit`);
      lines.push(`${alias} --> ${alias}_circuit`);
      lines.push(`${alias}_circuit --> hw_${component.target_device_id} : ${plantUmlText(pinLabel)}`);
    } else if (devices.has(component.target_device_id)) {
      lines.push(`${alias} --> hw_${component.target_device_id} : ${plantUmlText(pinLabel)}`);
    }
  }
  lines.push("@enduml");
  return lines.join("\n");
}

function boardFeatureForHardwareComponent(component, device) {
  if (!device) return null;
  const featureId = boardFeatureIdForHardwareComponent(component, device);
  const feature = featureId ? device.board_configuration?.board_features?.[featureId] : null;
  if (!feature?.enabled || !Object.keys(feature.pins || {}).length) return null;
  return feature;
}

function boardFeatureIdForHardwareComponent(component, device) {
  if (!device) return "";
  const features = device.board_configuration?.board_features || {};
  let featureId = "";
  if (component.abstract_type === "sensor" && component.sensor_category === "image") featureId = "camera";
  else if (component.abstract_type === "actuator" && component.concrete_type === "integrated_display") featureId = "display";
  else if (/^integrated_/.test(component.concrete_type || "")) {
    const candidate = String(component.concrete_type).replace(/^integrated_/, "");
    featureId = ({ touchscreen: "touch", touchscreen_controller: "touch", audio: "speaker" })[candidate] || candidate;
  }
  const feature = featureId ? features[featureId] : null;
  if (!feature?.enabled) return "";
  if (featureId === "camera" && component.concrete_type && feature.hardware && component.concrete_type !== "integrated_camera" && component.concrete_type !== feature.hardware) return "";
  return featureId;
}

function formatHardwarePins(pins = {}) {
  return Object.entries(pins).map(([signal, pin]) => `${signal.toUpperCase()}=${pin === -1 ? "nicht verbunden" : `GPIO${pin}`}`).join(", ");
}

function plantUmlLabel(lines) {
  return lines.filter(Boolean).map(plantUmlText).join("\\n");
}

function hardwarePropertyLines(properties = {}) {
  return Object.entries(properties).map(([key, value]) => `${key}: ${value}`);
}

function plantUmlText(value) {
  return String(value || "").replace(/["\\]/g, "'").slice(0, 180);
}

function slugifyHardwareFolder(value) {
  return String(value || "Hardware")
    .normalize("NFKD")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "Hardware";
}

function buildConfigForBoard(boardOrProfileId, existing = null) {
  const boardDefinition = boardOrProfileId && typeof boardOrProfileId === "object" ? boardOrProfileId : null;
  const boardProfileId = String(boardDefinition?.base_board_profile_id || boardDefinition?.hardware_item_id || boardOrProfileId || "");
  const catalogBuild = boardDefinition?.platformio_build;
  const sameCompilerTarget = Boolean(catalogBuild
    && existing?.platform === catalogBuild.platform
    && existing?.board === catalogBuild.board);
  const common = {
    ...(existing || {}),
    libraries: existing?.libraries || [],
    ...(!sameCompilerTarget ? {
      build_flags: [],
      partition_file: "",
      platformio_options: {},
      upload_speed: 0,
      maximum_program_size_bytes: 0,
      maximum_ram_size_bytes: 0,
    } : {}),
  };
  if (/esp32_s3_es3c28p|es3c28p/.test(boardProfileId)
      && existing?.firmware_basis_id === "gernetix-runtime-basissoftware") {
    return {
      ...common,
      platform: "espressif32",
      framework: "espidf",
      board: "4d_systems_esp32s3_gen4_r8n16",
      environment: "es3c28p",
      flash_size_mb: 16,
      libraries: Array.from(new Set([...(catalogBuild?.libraries || []), ...(common.libraries || [])])),
      build_flags: [],
      platformio_options: { "board_build.cmake_extra_args": "-DSDKCONFIG_DEFAULTS=\"sdkconfig.esp32-s3-n16r8\"" },
      firmware_basis_id: "gernetix-runtime-basissoftware",
      firmware_basis_version: existing.firmware_basis_version || "workspace",
      firmware_basis_variant: "full",
      partition_profile_id: "full",
      user_source_path: existing.user_source_path || "src/user_main.cpp",
      user_target_path: "src/user/user_app.cpp",
    };
  }
  if (catalogBuild && typeof catalogBuild === "object" && catalogBuild.platform && catalogBuild.board) {
    const supportedFrameworks = Array.isArray(catalogBuild.supported_frameworks) ? catalogBuild.supported_frameworks : [catalogBuild.framework];
    const keepsFramework = existing?.platform === catalogBuild.platform && supportedFrameworks.includes(existing?.framework);
    const framework = keepsFramework ? existing.framework : catalogBuild.framework;
    const firmwareBasisId = catalogBuild.firmware_basis_id || existing?.firmware_basis_id || "";
    const usesBasissoftware = framework === "espidf" && Boolean(firmwareBasisId);
    const result = {
      ...common,
      ...catalogBuild,
      framework,
      libraries: Array.from(new Set([...(catalogBuild.libraries || []), ...(common.libraries || [])])),
      firmware_basis_id: usesBasissoftware ? firmwareBasisId : "",
      firmware_basis_version: usesBasissoftware ? catalogBuild.firmware_basis_version || existing?.firmware_basis_version || "workspace" : "",
      firmware_basis_variant: usesBasissoftware ? existing?.firmware_basis_variant || catalogBuild.firmware_basis_variant || "full" : "",
      user_source_path: existing?.user_source_path || "Komponenten/IoT-Device 1/src/user_main.cpp",
      user_target_path: usesBasissoftware ? existing?.user_target_path || "src/user/user_app.cpp" : existing?.user_target_path || "src/main.cpp",
    };
    delete result.supported_frameworks;
    return result;
  }
  if (/arduino_nano_r3_atmega328p/.test(boardProfileId)) return { ...common, platform: "atmelavr", framework: "arduino", board: "nanoatmega328", environment: "nanoatmega328", firmware_basis_id: "", firmware_basis_version: "", firmware_basis_variant: "" };
  if (/esp8266|d1_mini/.test(boardProfileId)) return { ...common, platform: "espressif8266", framework: "arduino", board: "d1_mini", environment: "d1_mini", firmware_basis_id: "", firmware_basis_version: "", firmware_basis_variant: "" };
  if (/ai_thinker_esp32_cam/.test(boardProfileId)) return { ...common, platform: "espressif32", framework: "arduino", board: "esp32cam", environment: "esp32cam", firmware_basis_id: "", firmware_basis_version: "", firmware_basis_variant: "", user_source_path: existing?.user_source_path || "src/main.cpp", user_target_path: existing?.user_target_path || "src/main.cpp" };
  if (/esp32_s3_es3c28p|es3c28p/.test(boardProfileId)) return { ...common, platform: "espressif32", framework: "arduino", board: "esp32-s3-devkitc-1", environment: "es3c28p", flash_size_mb: 16, firmware_basis_id: "", firmware_basis_version: "", firmware_basis_variant: "", user_source_path: existing?.user_source_path || "Komponenten/IoT-Device 1/src/user_main.cpp", user_target_path: existing?.user_target_path || "src/main.cpp", libraries: common.libraries.length ? common.libraries : ["lovyan03/LovyanGFX@^1.2.7"] };
  if (/esp32_s3|esp32-s3/.test(boardProfileId)) return { ...common, platform: "espressif32", framework: existing?.framework || "espidf", board: "esp32-s3-devkitc-1", environment: "esp32-s3-devkitc-1", firmware_basis_id: "gernetix-runtime-basissoftware", firmware_basis_version: existing?.firmware_basis_version || "workspace", firmware_basis_variant: existing?.firmware_basis_variant || "comfort", user_source_path: existing?.user_source_path || "Komponenten/IoT-Device 1/src/user_main.cpp", user_target_path: existing?.user_target_path || "src/user/user_app.cpp" };
  if (/esp32|wroom32|nano_esp32/.test(boardProfileId)) return { ...common, platform: "espressif32", framework: existing?.framework || "espidf", board: "esp32dev", environment: "esp32dev", firmware_basis_id: "gernetix-runtime-basissoftware", firmware_basis_version: existing?.firmware_basis_version || "workspace", firmware_basis_variant: existing?.firmware_basis_variant || "comfort", user_source_path: existing?.user_source_path || "Komponenten/IoT-Device 1/src/user_main.cpp", user_target_path: existing?.user_target_path || "src/user/user_app.cpp" };
  return existing;
}

function platformSoftwareUnits(project = {}, fallbackBuildConfig = null) {
  if (Array.isArray(project.software_units) && project.software_units.length) {
    return project.software_units.map((unit) => structuredClone(unit));
  }
  const buildConfig = project.build_config || fallbackBuildConfig;
  return buildConfig ? [{
    software_unit_id: "firmware",
    title: "Firmware",
    software_kind: "embedded_firmware",
    build_system: "platformio",
    source_root: "",
    entrypoint: buildConfig.user_source_path || "",
    device_id: project.device_id || "",
    build_config: structuredClone(buildConfig),
    build_configuration: null,
  }] : [];
}

function platformActiveSoftwareUnitId(project = {}) {
  const units = platformSoftwareUnits(project);
  return units.some((unit) => unit.software_unit_id === project.active_software_unit_id)
    ? project.active_software_unit_id
    : units[0]?.software_unit_id || "";
}

function developmentSoftwareUnits(project = {}, diagram = {}, hardwareConfiguration = null, options = {}) {
  const existingUnits = filterSoftwareUnitsForArchitecture(platformSoftwareUnits(project), hardwareConfiguration);
  const components = softwareArchitectureComponents(
    developmentArchitectureSoftwareComponents(diagram?.source || ""),
    hardwareConfiguration,
  );
  const hardwareComponents = new Map((hardwareConfiguration?.components || []).map((component) => [component.component_id, component]));
  const boards = options.boards || [];
  let embeddedIndex = 0;
  const usedExistingIds = new Set();
  const derivedSoftwareUnitIds = new Set(components.map((component) => `software_${component.component_id}`.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120)));
  const units = components.map((component) => {
    const hardware = hardwareComponents.get(component.component_id) || null;
    const expectedId = `software_${component.component_id}`.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 120);
    let existing = existingUnits.find((unit) => !usedExistingIds.has(unit.software_unit_id)
      && hardware?.board_profile_id && unit.hardware_profile_id === hardware.board_profile_id)
      || existingUnits.find((unit) => !usedExistingIds.has(unit.software_unit_id) && unit.source_root === hardware?.component_path)
      || existingUnits.find((unit) => !usedExistingIds.has(unit.software_unit_id) && unit.software_unit_id === expectedId)
      || existingUnits.find((unit) => unit.title === component.label);
    if (!existing && component.abstract_type === "iot_device" && embeddedIndex === 0) {
      existing = existingUnits.find((unit) => unit.software_kind === "embedded_firmware") || null;
    }
    const softwareUnitId = existing?.software_unit_id || expectedId;
    usedExistingIds.add(softwareUnitId);
    const sourceRoot = hardware?.component_path || existing?.source_root || `Komponenten/${component.label}`;
    if (component.abstract_type === "iot_device") {
      const board = boards.find((item) => [item.hardware_item_id, item.hardware_profile_id, item.id]
        .filter(Boolean).some((id) => String(id) === String(hardware?.board_profile_id || "")));
      const baseBuildConfig = embeddedIndex === 0 && options.primaryBuildConfig
        ? options.primaryBuildConfig
        : buildConfigForBoard(board || hardware?.board_profile_id || "", existing?.build_config || null);
      const resolvedBoardConfiguration = hardware?.board_configuration
        || (board ? compilerBoardConfiguration(null, board) : null);
      const buildConfig = baseBuildConfig && resolvedBoardConfiguration
        ? { ...baseBuildConfig, board_configuration: compilerBoardConfiguration(resolvedBoardConfiguration, board) }
        : baseBuildConfig;
      embeddedIndex += 1;
      return {
        software_unit_id: softwareUnitId,
        title: component.label,
        software_kind: "embedded_firmware",
        build_system: "platformio",
        source_root: sourceRoot,
        entrypoint: buildConfig?.user_source_path || existing?.entrypoint || "src/main.cpp",
        device_id: hardware?.inventory_device_id || existing?.device_id || "",
        build_config: buildConfig || existing?.build_config || null,
        build_configuration: null,
      };
    }
    const kind = {
      mobile_app: "mobile_application",
      smartphone_app: "mobile_application",
      browser_app: "web_application",
      desktop_app: "desktop_application",
      server_api: "server_application",
    }[component.abstract_type] || "application";
    return {
      software_unit_id: softwareUnitId,
      title: component.label,
      software_kind: kind,
      build_system: existing?.build_system || "npm",
      source_root: sourceRoot,
      entrypoint: existing?.entrypoint || "package.json",
      device_id: "",
      build_config: null,
      build_configuration: existing?.build_configuration || {
        install_command: "npm install",
        build_command: "npm run build",
        runner_status: "not_connected",
      },
    };
  });
  existingUnits.forEach((unit) => {
    if (!usedExistingIds.has(unit.software_unit_id) && !derivedSoftwareUnitIds.has(unit.software_unit_id)) units.push(unit);
  });
  return units;
}

function developmentArchitectureSoftwareComponents(source) {
  const result = [];
  String(source || "").split(/\r?\n/).forEach((line) => {
    const match = line.match(/^\s*(?:actor|node|component|rectangle|database|cloud|queue|artifact)\s+"([^"]+)"\s+as\s+([A-Za-z_][A-Za-z0-9_]*)\b/i);
    if (!match) return;
    const label = match[1].replace(/\\n/g, " ").trim();
    const alias = match[2];
    const signature = `${alias} ${label}`.toLowerCase();
    let abstractType = "";
    if (/^iot_device|iot.?device|esp32|esp8266|arduino|raspberry/.test(signature)) abstractType = "iot_device";
    else if (/^mobile_app|mobile app|ios|iphone|ipad|android/.test(signature)) abstractType = "mobile_app";
    else if (/^smartphone_app|smartphone.pwa|\bpwa\b/.test(signature)) abstractType = "smartphone_app";
    else if (/^browser_app|browser|dashboard/.test(signature)) abstractType = "browser_app";
    else if (/^desktop_app|desktop|windows app|mac(?:os)? app|linux app/.test(signature)) abstractType = "desktop_app";
    else if (/^server_api|server|\bapi\b|backend|webserver|\bvps\b/.test(signature)) abstractType = "server_api";
    if (abstractType) result.push({ component_id: alias, label, abstract_type: abstractType });
  });
  return result;
}

function normalizeArchitectureDialog(input = {}, diagram = null) {
  const messages = Array.isArray(input.messages)
    ? input.messages.slice(-12).map((message) => ({
      role: message.role === "user" ? "user" : "assistant",
      content: String(message.content || "").slice(0, 8000),
      ...(message.usage && typeof message.usage === "object" ? { usage: message.usage } : {}),
      ...(message.routing && typeof message.routing === "object" ? { routing: message.routing } : {}),
    })).filter((message) => message.content)
    : [];
  return {
    messages,
    assistantMode: String(input.assistantMode || input.assistant_mode || "architecture_structure"),
    lastRouting: input.lastRouting || input.last_routing || null,
    architectureDiagram: diagram?.source ? normalizeArchitectureDiagram(diagram) : null,
    updated_at: new Date().toISOString(),
  };
}

  return {
    defaultHomeAutomationConfiguration,
    normalizeHomeAutomationConfiguration,
    defaultTouchscreenGameConfiguration,
    normalizeTouchscreenGameConfiguration,
    isTouchscreenGameBoard,
    touchscreenGameInventoryMatches,
    restoreDevelopmentTemplateReference,
    normalizeArchitectureDiagram,
    stripPlantUmlNotes,
    normalizeArchitecturePlantUml,
    numberGenericIotDeviceInstances,
    architectureDiagramFromManifest,
    hardwareConfigurationFromManifest,
    normalizeHardwareConfiguration,
    normalizeDevelopmentBoardConfiguration,
    compilerBoardConfiguration,
    normalizeHardwareProperties,
    hardwareCircuitFor,
    hardwareConfigurationSources,
    primaryHardwareComponentPath,
    hardwareBoardMarkdown,
    hardwareIoMarkdown,
    hardwareCircuitMarkdown,
    hardwareWiringPlantUml,
    boardFeatureForHardwareComponent,
    boardFeatureIdForHardwareComponent,
    formatHardwarePins,
    plantUmlLabel,
    hardwarePropertyLines,
    plantUmlText,
    slugifyHardwareFolder,
    buildConfigForBoard,
    platformSoftwareUnits,
    platformActiveSoftwareUnitId,
    developmentSoftwareUnits,
    developmentArchitectureSoftwareComponents,
    normalizeArchitectureDialog,
  };
}

module.exports = { createProjectHardwareModel };

