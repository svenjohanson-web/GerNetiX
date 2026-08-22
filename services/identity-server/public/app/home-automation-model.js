import { plantUmlLabel } from "@app/development-plantuml.js";

/*
 * Modell der verteilten Hausautomatisierung.
 *
 * Herausgeloest aus development-platform.js: die Auswahlmoeglichkeiten, die
 * Normalisierung einer gespeicherten Konfiguration und die daraus erzeugte
 * Startarchitektur. Alle Funktionen arbeiten nur mit ihren Parametern.
 *
 * Die Bedienung bleibt in der Plattform: Formular aufbauen, Eingaben einsammeln
 * und speichern brauchen deren Zustand und ihre DOM-Helfer.
 */

function homeAutomationRoleOptions() {
  return [
    { id: "sensor_node", label: "Sensor-Node" },
    { id: "actuator_node", label: "Aktor-Node" },
    { id: "combined_node", label: "Sensor- und Aktor-Node" },
    { id: "control_node", label: "Bedien-Node" },
    { id: "gateway", label: "Gateway" },
  ];
}

function homeAutomationTransportOptions() {
  return [
    { id: "undecided", label: "Noch offen" },
    { id: "local", label: "Nur lokal am Device" },
    { id: "wifi_rest", label: "WLAN / REST" },
    { id: "wifi_mqtt", label: "WLAN / MQTT" },
    { id: "zigbee", label: "Zigbee" },
  ];
}

function homeAutomationBoardFeatureOptions() {
  return [
    { id: "integrated_display", label: "Display" },
    { id: "integrated_touchscreen", label: "Touchscreen" },
    { id: "battery_operation", label: "Akkubetrieb" },
    { id: "sd_card", label: "SD-Karte" },
    { id: "audio", label: "Audio" },
    { id: "many_gpio", label: "Viele GPIOs" },
  ];
}

function boundedHomeAutomationCount(value) {
  const number = Number.parseInt(value, 10);
  return Number.isFinite(number) ? Math.min(20, Math.max(0, number)) : 0;
}

function defaultHomeAutomationConfiguration() {
  return {
    schema_version: 1,
    coordinator: "undecided",
    failure_policy: "local_fallback",
    state_model: { commands: true, desired_state: true, actual_state: true, events: true },
    nodes: [
      { name: "Raumklima", role: "sensor_node", transport: "undecided", sensor_count: 2, actuator_count: 0, board_features: {} },
      { name: "Lichtsteuerung", role: "actuator_node", transport: "undecided", sensor_count: 0, actuator_count: 1, board_features: {} },
      { name: "Touchpanel", role: "control_node", transport: "undecided", sensor_count: 0, actuator_count: 0, board_features: { integrated_display: true, integrated_touchscreen: true } },
    ],
  };
}

function normalizeHomeAutomationConfiguration(value = {}) {
  const defaults = defaultHomeAutomationConfiguration();
  const allowedCoordinators = new Set(["undecided", "none", "gernetix_home_server", "home_assistant", "gernetix_with_home_assistant"]);
  const allowedPolicies = new Set(["local_fallback", "safe_state", "central_required", "undecided"]);
  const allowedRoles = new Set(homeAutomationRoleOptions().map((option) => option.id));
  const allowedTransports = new Set(homeAutomationTransportOptions().map((option) => option.id));
  const nodes = Array.isArray(value?.nodes) ? value.nodes.slice(0, 30).map((node, index) => {
    const legacyTouchscreen = boundedHomeAutomationCount(node?.control_count) > 0;
    const boardFeatures = Object.fromEntries(homeAutomationBoardFeatureOptions().map((feature) => [feature.id, node?.board_features?.[feature.id] === true]));
    if (legacyTouchscreen) boardFeatures.integrated_touchscreen = true;
    if (boardFeatures.integrated_touchscreen) boardFeatures.integrated_display = true;
    return {
      name: String(node?.name || `IoT-Device ${index + 1}`).trim().slice(0, 80),
      role: allowedRoles.has(node?.role) ? node.role : "combined_node",
      transport: allowedTransports.has(node?.transport) ? node.transport : "undecided",
      sensor_count: boundedHomeAutomationCount(node?.sensor_count),
      actuator_count: boundedHomeAutomationCount(node?.actuator_count),
      board_features: boardFeatures,
    };
  }) : defaults.nodes;
  return {
    schema_version: 2,
    coordinator: allowedCoordinators.has(value?.coordinator) ? value.coordinator : defaults.coordinator,
    failure_policy: allowedPolicies.has(value?.failure_policy) ? value.failure_policy : defaults.failure_policy,
    state_model: Object.fromEntries(["commands", "desired_state", "actual_state", "events"].map((key) => [key, value?.state_model?.[key] !== false])),
    nodes,
  };
}

function homeAutomationArchitectureDiagram(configuration, title = "Verteilte Hausautomatisierung") {
  const config = normalizeHomeAutomationConfiguration(configuration);
  const coordinatorLabels = {
    undecided: "Zustandskoordination\\nNoch offen",
    none: "Verteilte Zustandssynchronisation",
    gernetix_home_server: "GerNetiX Home Server",
    home_assistant: "Home Assistant",
    gernetix_with_home_assistant: "GerNetiX Home Server\\nmit Home Assistant",
  };
  const roleLabels = Object.fromEntries(homeAutomationRoleOptions().map((option) => [option.id, option.label]));
  const transportLabels = Object.fromEntries(homeAutomationTransportOptions().map((option) => [option.id, option.label]));
  const failureLabels = {
    local_fallback: "Lokal weiterarbeiten",
    safe_state: "Sicheren Zustand einnehmen",
    central_required: "Zentrale Instanz erforderlich",
    undecided: "Noch offen",
  };
  const stateLabels = { commands: "Befehle", desired_state: "Sollzustand", actual_state: "Istzustand", events: "Ereignisse / Messwerte" };
  const activeStates = Object.entries(config.state_model).filter(([, enabled]) => enabled).map(([key]) => stateLabels[key]);
  const lines = [
    "@startuml",
    `title ${plantUmlLabel(title)}`,
    "left to right direction",
    `rectangle "${coordinatorLabels[config.coordinator]}" as coordination`,
    `rectangle "Konfiguration\\nAusfall: ${plantUmlLabel(failureLabels[config.failure_policy])}\\nDaten: ${plantUmlLabel(activeStates.join(", ") || "Keine")}" as configuration`,
    "configuration .. coordination",
  ];
  config.nodes.forEach((node, index) => {
    const id = `device_${index + 1}`;
    const featureLabels = homeAutomationBoardFeatureOptions().filter((feature) => node.board_features[feature.id]).map((feature) => feature.label);
    lines.push(`rectangle "IoT-Device ${index + 1}\\n${plantUmlLabel(node.name)}\\n${plantUmlLabel(roleLabels[node.role])}\\n${plantUmlLabel(transportLabels[node.transport])}\\nBoard: ${plantUmlLabel(featureLabels.join(", ") || "Standard")}" as ${id}`);
    if (config.state_model.events || config.state_model.actual_state) lines.push(`${id} --> coordination : ${plantUmlLabel(transportLabels[node.transport])} / Istzustand`);
    if (config.state_model.commands || config.state_model.desired_state) lines.push(`coordination --> ${id} : Befehl / Sollzustand`);
    for (let sensorIndex = 1; sensorIndex <= node.sensor_count; sensorIndex += 1) {
      lines.push(`rectangle "Sensor ${index + 1}.${sensorIndex}" as sensor_${index + 1}_${sensorIndex}`);
      lines.push(`sensor_${index + 1}_${sensorIndex} --> ${id} : Messwert`);
    }
    for (let actuatorIndex = 1; actuatorIndex <= node.actuator_count; actuatorIndex += 1) {
      lines.push(`rectangle "Aktor ${index + 1}.${actuatorIndex}" as actuator_${index + 1}_${actuatorIndex}`);
      lines.push(`${id} --> actuator_${index + 1}_${actuatorIndex} : schaltet`);
    }
  });
  lines.push("@enduml");
  return {
    type: "plantuml",
    source: lines.join("\n"),
    title: "Konfigurierte Hausautomationsarchitektur",
    summary: "Aus dem statischen Konfigurationsassistenten erzeugte Startarchitektur.",
    derived_from: "project_template",
  };
}

export {
  boundedHomeAutomationCount,
  defaultHomeAutomationConfiguration,
  homeAutomationArchitectureDiagram,
  homeAutomationBoardFeatureOptions,
  homeAutomationRoleOptions,
  homeAutomationTransportOptions,
  normalizeHomeAutomationConfiguration,
};
