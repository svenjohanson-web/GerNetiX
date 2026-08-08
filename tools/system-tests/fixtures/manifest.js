"use strict";

const fs = require("node:fs");
const path = require("node:path");

const IDENTIFIER = /^[a-z0-9][a-z0-9_-]{2,79}$/;

function loadManifest(file = path.join(__dirname, "manifest.v1.json")) {
  return validateManifest(JSON.parse(fs.readFileSync(file, "utf8")));
}

function validateManifest(manifest) {
  requireObject(manifest, "manifest");
  if (manifest.schema_version !== 1) throw new Error("Unsupported fixture manifest schema");
  if (manifest.environment !== "isolated-local") throw new Error("Fixture environment must be isolated-local");
  if (!IDENTIFIER.test(manifest.fixture_set || "")) throw new Error("fixture_set is invalid");
  if (!/^[A-Z][A-Z0-9_]+$/.test(manifest.password_env || "")) throw new Error("password_env is invalid");
  requireArray(manifest.accounts, "accounts");
  requireArray(manifest.projects, "projects");
  requireArray(manifest.devices, "devices");

  const accountIds = uniqueIds(manifest.accounts, "fixture_id", "accounts");
  uniqueValues(manifest.accounts, "username", "accounts");
  uniqueValues(manifest.accounts, "email", "accounts");
  for (const account of manifest.accounts) {
    requireIdentifier(account.fixture_id, "account.fixture_id");
    requireText(account.username, "account.username");
    if (!/^[^@\s]+@[^@\s]+\.invalid$/.test(account.email || "")) {
      throw new Error(`Fixture account email must use .invalid: ${account.fixture_id || "unknown"}`);
    }
    if (!new Set(["de", "en"]).has(account.locale)) throw new Error(`Unsupported fixture locale: ${account.locale}`);
  }

  const projectIds = uniqueIds(manifest.projects, "project_id", "projects");
  const projectOwners = new Map();
  for (const project of manifest.projects) {
    requireIdentifier(project.project_id, "project.project_id");
    requireReference(project.account_fixture_id, accountIds, "project.account_fixture_id");
    requireText(project.title, "project.title");
    requireText(project.hardware_profile_id, "project.hardware_profile_id");
    projectOwners.set(project.project_id, project.account_fixture_id);
  }

  uniqueIds(manifest.devices, "device_id", "devices");
  uniqueValues(manifest.devices, "serial_number", "devices");
  for (const device of manifest.devices) {
    requireIdentifier(device.device_id, "device.device_id");
    requireReference(device.account_fixture_id, accountIds, "device.account_fixture_id");
    requireReference(device.project_id, projectIds, "device.project_id", "project");
    if (projectOwners.get(device.project_id) !== device.account_fixture_id) {
      throw new Error(`Device project ownership mismatch: ${device.device_id}`);
    }
    requireText(device.serial_number, "device.serial_number");
    requireText(device.display_name, "device.display_name");
    requireText(device.hardware_profile_id, "device.hardware_profile_id");
  }

  return deepFreeze(structuredClone(manifest));
}

function uniqueIds(items, field, collection) {
  const values = uniqueValues(items, field, collection);
  for (const value of values) requireIdentifier(value, `${collection}.${field}`);
  return values;
}

function uniqueValues(items, field, collection) {
  const values = new Set();
  for (const item of items) {
    requireObject(item, `${collection} item`);
    const value = item[field];
    requireText(value, `${collection}.${field}`);
    if (values.has(value)) throw new Error(`Duplicate ${collection}.${field}: ${value}`);
    values.add(value);
  }
  return values;
}

function requireReference(value, allowed, field, target = "account") {
  if (!allowed.has(value)) throw new Error(`${field} references unknown ${target}: ${value}`);
}

function requireIdentifier(value, field) {
  if (!IDENTIFIER.test(value || "")) throw new Error(`${field} is invalid`);
}

function requireText(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be non-empty text`);
}

function requireArray(value, field) {
  if (!Array.isArray(value) || value.length === 0) throw new Error(`${field} must be a non-empty array`);
}

function requireObject(value, field) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${field} must be an object`);
}

function deepFreeze(value) {
  Object.freeze(value);
  for (const child of Object.values(value)) {
    if (child && typeof child === "object" && !Object.isFrozen(child)) deepFreeze(child);
  }
  return value;
}

module.exports = { loadManifest, validateManifest };
