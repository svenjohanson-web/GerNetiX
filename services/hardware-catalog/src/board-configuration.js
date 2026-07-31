"use strict";

function synchronizeBoardFeaturePins(input) {
  const board = clone(input);
  const assigned = board?.pin_profile?.assigned_pins;
  const features = board?.default_instance_configuration?.board_features;
  if (!assigned || typeof assigned !== "object" || !features || typeof features !== "object") return board;

  for (const [featureId, feature] of Object.entries(features)) {
    if (!feature || typeof feature !== "object" || Array.isArray(feature)) continue;
    const connectionGroup = feature.connection ? `${featureId}_${feature.connection}` : "";
    const candidates = Object.entries(assigned).filter(([group, pins]) => (
      group === featureId || group === connectionGroup || group.startsWith(`${featureId}_`)
    ) && pins && typeof pins === "object" && !Array.isArray(pins));
    const exact = candidates.find(([group]) => group === connectionGroup)
      || candidates.find(([group]) => group === featureId)
      || (candidates.length === 1 ? candidates[0] : null);
    if (!exact) continue;
    feature.pins = normalizePins(exact[1]);
    feature.pin_assignment_group = exact[0];
  }
  return board;
}

function normalizePins(input) {
  return Object.fromEntries(Object.entries(input || {})
    .map(([signal, pin]) => [String(signal), Number(pin)])
    .filter(([, pin]) => Number.isInteger(pin)));
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

module.exports = { synchronizeBoardFeaturePins };
