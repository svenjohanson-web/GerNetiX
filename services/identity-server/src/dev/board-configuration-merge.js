"use strict";

function mergeBoardFeatures(defaults = {}, selections = {}) {
  const defaultFeatures = plainObject(defaults) ? defaults : {};
  const selectedFeatures = plainObject(selections) ? selections : {};
  const featureIds = new Set([...Object.keys(defaultFeatures), ...Object.keys(selectedFeatures)]);
  return Object.fromEntries([...featureIds].map((featureId) => {
    const baseline = plainObject(defaultFeatures[featureId]) ? defaultFeatures[featureId] : {};
    if (!Object.prototype.hasOwnProperty.call(selectedFeatures, featureId)) {
      return [featureId, clone(baseline)];
    }
    const selected = plainObject(selectedFeatures[featureId]) ? selectedFeatures[featureId] : {};
    return [featureId, {
      ...clone(baseline),
      ...clone(selected),
      pins: Object.prototype.hasOwnProperty.call(selected, "pins")
        ? clone(plainObject(selected.pins) ? selected.pins : {})
        : clone(plainObject(baseline.pins) ? baseline.pins : {}),
    }];
  }));
}

function plainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function clone(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

module.exports = { mergeBoardFeatures };
