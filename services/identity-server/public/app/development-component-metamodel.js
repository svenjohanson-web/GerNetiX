const DevelopmentComponentMetamodel = (() => {
  const componentTypes = Object.freeze({
    actor: { label: "Nutzer", allocation: "none" },
    iot_device: { label: "IoT-Device", allocation: "board" },
    sensor: { label: "Sensor", allocation: "iot_device" },
    actuator: { label: "Aktor", allocation: "iot_device" },
    smartphone_app: { label: "Smartphone-App / PWA", allocation: "none" },
    browser_app: { label: "Browser-App", allocation: "none" },
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
    rule("uses_mobile_app", "actor", "smartphone_app", "nutzt"),
    rule("uses_browser_app", "actor", "browser_app", "nutzt"),
    rule("uses_service", "actor", "server_api", "nutzt"),
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
    return (existingComponents || []).flatMap((component) => {
      const outgoing = rulesBetween(type, component.abstract_type)
        .map((item) => ({ rule: item, target: component, direction: "outgoing" }));
      const incoming = rulesBetween(component.abstract_type, type)
        .map((item) => ({ rule: item, target: component, direction: "incoming" }));
      return [...outgoing, ...incoming];
    });
  }

  function validatesRelation(sourceType, targetType) {
    return rulesBetween(sourceType, targetType).length > 0;
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
    controlUnitForRelation,
  });
})();

globalThis.DevelopmentComponentMetamodel = DevelopmentComponentMetamodel;
if (typeof module !== "undefined") module.exports = DevelopmentComponentMetamodel;
