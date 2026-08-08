"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { loadManifest, validateManifest } = require("../manifest");

test("versioned fixture manifest is deterministic and contains only synthetic accounts", () => {
  const manifest = loadManifest();
  assert.equal(manifest.schema_version, 1);
  assert.equal(manifest.environment, "isolated-local");
  assert.equal(manifest.accounts.length, 3);
  assert.equal(manifest.projects.length, 4);
  assert.equal(manifest.devices.length, 4);
  assert.ok(manifest.accounts.every((account) => account.email.endsWith(".invalid")));
  assert.equal(JSON.stringify(loadManifest()), JSON.stringify(manifest));
  assert.ok(Object.isFrozen(manifest));
  assert.ok(Object.isFrozen(manifest.accounts));
  assert.deepEqual(manifest.devices.map(({ device_id, project_id }) => [device_id, project_id]), [
    ["systemtest-device-alpha-01", "systemtest-project-alpha-01"],
    ["systemtest-device-alpha-02", "systemtest-project-alpha-02"],
    ["systemtest-device-beta-01", "systemtest-project-beta-01"],
    ["systemtest-device-gamma-01", "systemtest-project-gamma-01"],
  ]);
});

test("manifest rejects dangling and cross-account device project mappings", () => {
  const dangling = structuredClone(loadManifest());
  dangling.devices[0].project_id = "missing-project";
  assert.throws(() => validateManifest(dangling), /references unknown project/);

  const crossAccount = structuredClone(loadManifest());
  crossAccount.devices[0].project_id = "systemtest-project-beta-01";
  assert.throws(() => validateManifest(crossAccount), /project ownership mismatch/);
});

test("manifest rejects duplicate IDs and dangling account references", () => {
  const manifest = structuredClone(loadManifest());
  manifest.projects[1].project_id = manifest.projects[0].project_id;
  assert.throws(() => validateManifest(manifest), /Duplicate projects\.project_id/);

  const dangling = structuredClone(loadManifest());
  dangling.devices[0].account_fixture_id = "account-missing";
  assert.throws(() => validateManifest(dangling), /references unknown account/);
});

test("manifest rejects non-reserved account email domains", () => {
  const manifest = structuredClone(loadManifest());
  manifest.accounts[0].email = "systemtest@example.com";
  assert.throws(() => validateManifest(manifest), /must use \.invalid/);
});
