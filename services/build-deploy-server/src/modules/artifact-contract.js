"use strict";

const ARTIFACT_POLICIES = Object.freeze({
  "bootloader.bin": { artifactClass: "deployable", retentionDays: 90, compress: false },
  "partitions.bin": { artifactClass: "deployable", retentionDays: 90, compress: false },
  "boot_app0.bin": { artifactClass: "deployable", retentionDays: 90, compress: false },
  "firmware.bin": { artifactClass: "deployable", retentionDays: 90, compress: false },
  "firmware.elf": { artifactClass: "symbols", retentionDays: 30, compress: true },
  "firmware.hex": { artifactClass: "diagnostic", retentionDays: 14, compress: true },
  "firmware.map": { artifactClass: "diagnostic", retentionDays: 14, compress: true },
  "build.log": { artifactClass: "diagnostic", retentionDays: 14, compress: true },
});

function artifactPolicy(name) {
  return ARTIFACT_POLICIES[name] || null;
}

function isAllowedArtifactName(name) {
  return Boolean(artifactPolicy(name));
}

function sanitizeJobId(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function contentType(name) {
  return name === "build.log" ? "text/plain; charset=utf-8" : "application/octet-stream";
}

module.exports = { ARTIFACT_POLICIES, artifactPolicy, contentType, isAllowedArtifactName, sanitizeJobId };
