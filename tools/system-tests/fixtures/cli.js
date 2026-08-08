#!/usr/bin/env node
"use strict";

const { loadManifest } = require("./manifest");
const { createSeedClient } = require("./seed-client");

const DEFAULT_TARGETS = Object.freeze({
  identity: "http://127.0.0.1:4300",
  project: "http://127.0.0.1:4800",
  device: "http://127.0.0.1:4700",
});

async function main(argv = process.argv.slice(2), env = process.env) {
  if (argv.includes("--plan")) {
    const manifest = loadManifest();
    process.stdout.write(`${JSON.stringify({
      fixture_set: manifest.fixture_set,
      environment: manifest.environment,
      accounts: manifest.accounts.length,
      projects: manifest.projects.length,
      devices: manifest.devices.length,
      writes: false,
    }, null, 2)}\n`);
    return;
  }
  const manifest = loadManifest();
  const client = createSeedClient({
    identityBaseUrl: env.GERNETIX_SYSTEM_TEST_IDENTITY_URL || DEFAULT_TARGETS.identity,
    projectBaseUrl: env.GERNETIX_SYSTEM_TEST_PROJECT_URL || DEFAULT_TARGETS.project,
    deviceBaseUrl: env.GERNETIX_SYSTEM_TEST_DEVICE_URL || DEFAULT_TARGETS.device,
  });
  const password = env[manifest.password_env];
  if (!password) throw new Error(`${manifest.password_env} is required`);
  process.stdout.write(`${JSON.stringify(await client.seed(manifest, password), null, 2)}\n`);
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`fixture_seed_failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { DEFAULT_TARGETS, main };
