const { JsonFileStore } = require("./persistence/json-file-store");
const { FileBackedMapRepository } = require("./persistence/file-backed-map-repository");
const { SqliteStateStore, jsonColumn } = require("./persistence/sqlite-state-store");
const {
  PROFILE_DEFINITIONS,
  applyProfileCapabilities,
  normalizeBasissoftwareProfile,
  profileChangeRequiresUsb,
} = require("./basissoftware-profiles");
const elasticComputeContract = require("./elastic-compute-contract");
const { ContentAddressedArtifactStore, normalizeSourceReference } = require("./persistence/content-addressed-artifact-store");

module.exports = {
  JsonFileStore,
  FileBackedMapRepository,
  SqliteStateStore,
  jsonColumn,
  PROFILE_DEFINITIONS,
  applyProfileCapabilities,
  normalizeBasissoftwareProfile,
  profileChangeRequiresUsb,
  ...elasticComputeContract,
  ContentAddressedArtifactStore,
  normalizeSourceReference,
};
