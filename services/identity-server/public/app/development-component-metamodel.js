const DevelopmentComponentMetamodel = (() => {
  const componentTypes = Object.freeze({
    actor: { label: "Nutzer", allocation: "none" },
    iot_device: { label: "IoT-Device", allocation: "board" },
    sensor: { label: "Sensor", allocation: "iot_device" },
    actuator: { label: "Aktor", allocation: "iot_device" },
    smartphone_app: { label: "Smartphone-App / PWA", allocation: "none" },
    browser_app: { label: "Browser-App", allocation: "none" },
    server_api: { label: "Server / API", allocation: "none" },
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
