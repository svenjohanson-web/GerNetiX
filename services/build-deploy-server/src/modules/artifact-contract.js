"use strict";

const ARTIFACT_CLASSES = new Set(["deployable", "symbols", "diagnostic"]);
const BUILD_PROFILES = Object.freeze(["standard", "debug"]);
const DEFAULT_ARTIFACT_POLICIES = Object.freeze({
  "bootloader.bin": Object.freeze({ artifactClass: "deployable", retentionDays: 90, compress: false }),
  "partitions.bin": Object.freeze({ artifactClass: "deployable", retentionDays: 90, compress: false }),
  "boot_app0.bin": Object.freeze({ artifactClass: "deployable", retentionDays: 90, compress: false }),
  "firmware.bin": Object.freeze({ artifactClass: "deployable", retentionDays: 90, compress: false }),
  "firmware.hex": Object.freeze({ artifactClass: "deployable", retentionDays: 90, compress: false }),
  "firmware.elf": Object.freeze({ artifactClass: "symbols", retentionDays: 30, compress: true }),
  "firmware.map": Object.freeze({ artifactClass: "diagnostic", retentionDays: 14, compress: true }),
  "build.log": Object.freeze({ artifactClass: "diagnostic", retentionDays: 14, compress: true }),
});

function createArtifactPolicySource(overrides = {}) {
  if (!overrides || typeof overrides !== "object" || Array.isArray(overrides)) {
    throw new TypeError("Artefakt-Policy muss ein Objekt sein.");
  }
  for (const name of Object.keys(overrides)) {
    if (!Object.hasOwn(DEFAULT_ARTIFACT_POLICIES, name)) {
      throw new TypeError(`Unbekanntes Artefakt in Policy: ${name}`);
    }
    const override = overrides[name];
    if (!override || typeof override !== "object" || Array.isArray(override)) {
      throw new TypeError(`Ungueltige Policy fuer ${name}.`);
    }
    for (const key of Object.keys(override)) {
      if (!["retentionDays", "compress"].includes(key)) throw new TypeError(`Nicht konfigurierbare Policy-Eigenschaft fuer ${name}: ${key}`);
    }
  }
  const policies = Object.fromEntries(Object.entries(DEFAULT_ARTIFACT_POLICIES).map(([name, defaults]) => {
    const policy = Object.freeze({ ...defaults, ...(overrides[name] || {}) });
    validateArtifactPolicy(name, policy);
    return [name, policy];
  }));
  Object.freeze(policies);
  return Object.freeze({
    policies,
    get(name) { return policies[name] || null; },
    isAllowed(name) { return Boolean(policies[name]); },
    allowsForProfile(name, profile) {
      const normalizedProfile = normalizeBuildProfile(profile);
      const policy = policies[name];
      return Boolean(policy && (normalizedProfile === "debug" || policy.artifactClass === "deployable"));
    },
    filterArtifacts(artifacts, profile) {
      return Object.fromEntries(Object.entries(artifacts || {})
        .filter(([name, filePath]) => filePath && this.allowsForProfile(name, profile)));
    },
  });
}

function validateArtifactPolicy(name, policy) {
  if (!ARTIFACT_CLASSES.has(policy.artifactClass)) throw new TypeError(`Ungueltige Artefaktklasse fuer ${name}.`);
  if (!Number.isSafeInteger(policy.retentionDays) || policy.retentionDays < 1 || policy.retentionDays > 3650) {
    throw new TypeError(`Ungueltige Aufbewahrungsdauer fuer ${name}.`);
  }
  if (typeof policy.compress !== "boolean") throw new TypeError(`Ungueltige Kompressionsregel fuer ${name}.`);
}

function normalizeBuildProfile(value, fallback = "standard") {
  const profile = String(value || fallback).trim().toLowerCase();
  if (!BUILD_PROFILES.includes(profile)) {
    const error = new TypeError("Buildprofil muss standard oder debug sein.");
    error.code = "invalid_build_profile";
    throw error;
  }
  return profile;
}

const DEFAULT_ARTIFACT_POLICY_SOURCE = createArtifactPolicySource();
const ARTIFACT_POLICIES = DEFAULT_ARTIFACT_POLICY_SOURCE.policies;

function artifactPolicy(name) { return DEFAULT_ARTIFACT_POLICY_SOURCE.get(name); }
function isAllowedArtifactName(name) { return DEFAULT_ARTIFACT_POLICY_SOURCE.isAllowed(name); }
function sanitizeJobId(value) { return String(value || "").replace(/[^a-zA-Z0-9_.-]/g, "_"); }
function contentType(name) { return name === "build.log" ? "text/plain; charset=utf-8" : "application/octet-stream"; }

module.exports = {
  ARTIFACT_POLICIES,
  BUILD_PROFILES,
  DEFAULT_ARTIFACT_POLICIES,
  DEFAULT_ARTIFACT_POLICY_SOURCE,
  artifactPolicy,
  contentType,
  createArtifactPolicySource,
  isAllowedArtifactName,
  normalizeBuildProfile,
  sanitizeJobId,
};
