"use strict";

const path = require("node:path");
const { loadManifest } = require("../../fixtures/manifest");

const DEFAULT_DEVICE_MAP = path.resolve(__dirname, "..", "..", "fixtures", "manifest.v1.json");

function loadDeviceMap(file = DEFAULT_DEVICE_MAP) {
  if (typeof file !== "string" || !file.trim()) throw new Error("deviceMap must be a non-empty path");
  const manifest = loadManifest(path.resolve(file));
  const mappings = manifest.devices.map((device) => Object.freeze({
    deviceId: device.device_id,
    projectId: device.project_id,
  }));
  return Object.freeze({
    schemaVersion: manifest.schema_version,
    fixtureSet: manifest.fixture_set,
    mappings: Object.freeze(mappings),
  });
}

function applyDeviceMap(config, deviceMap) {
  if (!deviceMap || deviceMap.schemaVersion !== 1 || !Array.isArray(deviceMap.mappings)) {
    throw new Error("A validated version 1 device map is required");
  }
  if (config.deviceCount > deviceMap.mappings.length) {
    throw new Error(`deviceCount ${config.deviceCount} exceeds mapped fixture devices ${deviceMap.mappings.length}`);
  }
  return Object.freeze({
    ...config,
    fixtureSet: deviceMap.fixtureSet,
    deviceMappings: Object.freeze(deviceMap.mappings.slice(0, config.deviceCount)),
  });
}

module.exports = { DEFAULT_DEVICE_MAP, applyDeviceMap, loadDeviceMap };
