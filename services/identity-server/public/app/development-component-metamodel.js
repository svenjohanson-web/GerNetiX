const DevelopmentComponentMetamodel = (() => {
  const componentTypes = Object.freeze({
    actor: { label: "Externer Akteur", allocation: "none" },
    iot_device: { label: "IoT-Device", allocation: "board" },
    processor: { label: "Prozessor", allocation: "board_configuration", user_configurable: false },
    hardware_ic: { label: "Hardware-IC", allocation: "board_configuration", user_configurable: false },
    sensor: { label: "Sensor", allocation: "iot_device" },
    actuator: { label: "Aktor", allocation: "iot_device" },
    smartphone_app: { label: "Smartphone-App / PWA", allocation: "none" },
    browser_app: { label: "Browser-App", allocation: "none" },
    desktop_app: { label: "Desktop-App", allocation: "none" },
    server_api: { label: "Server / API", allocation: "none" },
    // Diese Bausteine werden nur von GerNetiX-Vorlagen bereitgestellt. Sie sind
    // sichtbare fachliche Grenzen, aber keine vom Kunden anzulegenden Services.
    telemetry_api: { label: "Telemetrie-API", allocation: "managed_service", user_configurable: false },
    project_storage: { label: "Projekt-Speicher", allocation: "managed_service", user_configurable: false },
    notification_service: { label: "Benachrichtigungsdienst", allocation: "managed_service", user_configurable: false },
    project_runtime_data: { label: "Projekt-Runtime-Daten", allocation: "managed_service", user_configurable: false },
    event_worker: { label: "Ereignis-Worker", allocation: "managed_service" },
    event_dispatcher: { label: "Ereignis-Dispatcher", allocation: "managed_service" },
  });

  const relationshipRules = Object.freeze([
    rule("uses_local_interface", "actor", "iot_device", "bedient lokal"),
    rule("observes_actuator", "actor", "actuator", "betrachtet / beobachtet"),
    rule("uses_mobile_app", "actor", "smartphone_app", "nutzt"),
    rule("uses_browser_app", "actor", "browser_app", "nutzt"),
    rule("uses_desktop_app", "actor", "desktop_app", "nutzt"),
    rule("uses_service", "actor", "server_api", "nutzt"),
    rule("interacts_with_sensor", "actor", "sensor", "wirkt auf / bedient"),
    rule("supplies_processor_input", "sensor", "processor", "liefert Eingangsdaten"),
    rule("transfers_between_processors", "processor", "processor", "uebertraegt Daten"),
    rule("controls_hardware_ic", "processor", "hardware_ic", "steuert"),
    rule("feeds_hardware_ic", "sensor", "hardware_ic", "liefert Signal an"),
    rule("hardware_ic_to_processor", "hardware_ic", "processor", "liefert Daten an"),
    rule("hardware_ic_chain", "hardware_ic", "hardware_ic", "steuert"),
    rule("drives_actuator", "hardware_ic", "actuator", "treibt an"),
    rule("presents_to_user", "actuator", "actor", "wirkt auf"),
    rule("measures_for", "sensor", "iot_device", "liefert Messwerte an", "0..*", "1"),
    rule("controls", "iot_device", "actuator", "steuert", "0..*", "1"),
    rule("synchronizes", "iot_device", "iot_device", "synchronisiert mit"),
    rule("sends_telemetry", "iot_device", "server_api", "sendet Telemetrie an"),
    rule("sends_telemetry", "iot_device", "telemetry_api", "sendet Telemetrie an"),
    rule("persists_project_data", "telemetry_api", "project_storage", "speichert projektbezogen"),
    rule("triggers_notification", "telemetry_api", "notification_service", "loest optional Benachrichtigung aus"),
    rule("uses_project_storage_mobile", "smartphone_app", "project_storage", "liest und konfiguriert Projektdaten"),
    rule("subscribes_project_push", "smartphone_app", "notification_service", "abonniert optional Projekt-Push"),
    rule("pushes_to_project_mobile", "notification_service", "smartphone_app", "sendet optional Projekt-Push an"),
    rule("persists_runtime_event", "telemetry_api", "project_runtime_data", "speichert Ereignis in Runtime-Daten"),
    rule("triggers_event_worker", "iot_device", "event_worker", "loest Ereignisverarbeitung aus"),
    rule("triggers_event_worker", "project_runtime_data", "event_worker", "loest Ereignisverarbeitung aus"),
    rule("hands_off_follow_up_event", "event_worker", "event_dispatcher", "gibt freigegebenes Folgeereignis weiter"),
    rule("writes_runtime_result", "event_worker", "project_runtime_data", "schreibt Zustand oder Folgeereignis"),
    rule("triggers_dispatcher", "project_runtime_data", "event_dispatcher", "stellt freigegebenes Folgeereignis bereit"),
    rule("dispatches_mqtt_action", "event_dispatcher", "iot_device", "stellt MQTT-Aktion zu"),
    rule("dispatches_project_push", "event_dispatcher", "notification_service", "loest optional Projekt-Push aus"),
    rule("uses_api_mobile", "smartphone_app", "server_api", "nutzt API"),
    rule("uses_api_browser", "browser_app", "server_api", "nutzt API"),
    rule("uses_api_desktop", "desktop_app", "server_api", "nutzt API"),
    rule("pushes_to_mobile", "server_api", "smartphone_app", "sendet Push an"),
    rule("commands_device", "server_api", "iot_device", "sendet Befehle an"),
  ]);

  function rule(id, sourceType, targetType, label, sourceCardinality = "0..*", targetCardinality = "0..*") {
    return Object.freeze({ id, source_type: sourceType, target_type: targetType, label, source_cardinality: sourceCardinality, target_cardinality: targetCardinality });
  }

  function typeLabel(type) {
    return componentTypes[type]?.label || "Unbekannte Komponente";
  }

  function rulesBetween(sourceType, targetType) {
    return relationshipRules.filter((item) => item.source_type === sourceType && item.target_type === targetType);
  }

  function optionsForNewComponent(type, existingComponents) {
    const options = (existingComponents || []).flatMap((component) => {
      const outgoing = rulesBetween(type, component.abstract_type)
        .map((item) => ({ rule: item, target: component, direction: "outgoing" }));
      const incoming = rulesBetween(component.abstract_type, type)
        .map((item) => ({ rule: item, target: component, direction: "incoming" }));
      return [...outgoing, ...incoming];
    });
    const seen = new Set();
    return options.filter((option) => {
      const key = `${option.rule.id}|${option.target.component_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function validatesRelation(sourceType, targetType) {
    return rulesBetween(sourceType, targetType).length > 0;
  }

  function componentTypeForPlantUml(label, plantUmlType, componentId = "") {
    const text = String(label || "").toLowerCase();
    if (String(plantUmlType).toLowerCase() === "actor") return "actor";
    const alias = String(componentId || "").toLowerCase();
    if (alias === "processor" || alias.endsWith("_processor")) return "processor";
    if (alias === "hardware_ic" || alias.endsWith("_ic")) return "hardware_ic";
    const explicitType = ["iot_device", "sensor", "actuator", "smartphone_app", "browser_app", "desktop_app", "server_api"]
      .find((type) => alias === type || alias.startsWith(`${type}_`));
    if (explicitType) return explicitType;
    if (/telemetrie.api/.test(text)) return "telemetry_api";
    if (/projekt.speicher/.test(text)) return "project_storage";
    if (/projekt.runtime.daten/.test(text)) return "project_runtime_data";
    if (/ereignis.worker/.test(text)) return "event_worker";
    if (/ereignis.dispatcher/.test(text)) return "event_dispatcher";
    if (/projekt.push.versand|benachrichtigungsdienst/.test(text)) return "notification_service";
    if (/iot.?device|iot.?zielger(?:ae|ä)t|esp32|esp8266|arduino|raspberry|processor.?board|datenlogger/.test(text)) return "iot_device";
    if (/sensor|kamera|camera|mikrofon|microphone|touch|fuehler|fuhler|temperatur|feuchte|helligkeit|wasserstand|ntc|ptc|pt1000/.test(text)) return "sensor";
    if (/aktor|display|bildschirm|anzeige|lautsprecher|speaker|motor|relais|ventil|servo|summer|buzzer|led/.test(text)) return "actuator";
    if (/pwa|iphone|smartphone|mobile app/.test(text)) return "smartphone_app";
    if (/browser|dashboard/.test(text)) return "browser_app";
    if (/desktop|windows app|mac(?:os)? app|linux app/.test(text)) return "desktop_app";
    if (/server|api|vps|koordination|webserver/.test(text)) return "server_api";
    return "structural";
  }

  function controlUnitForRelation(sourceType, targetType) {
    if (sourceType === "sensor" && targetType === "iot_device") return "target";
    if (sourceType === "iot_device" && targetType === "actuator") return "source";
    return "";
  }

  return Object.freeze({
    componentTypes,
    relationshipRules,
    typeLabel,
    rulesBetween,
    optionsForNewComponent,
    validatesRelation,
    componentTypeForPlantUml,
    controlUnitForRelation,
  });
})();

globalThis.DevelopmentComponentMetamodel = DevelopmentComponentMetamodel;
if (typeof module !== "undefined") module.exports = DevelopmentComponentMetamodel;
