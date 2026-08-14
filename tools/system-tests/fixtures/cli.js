#!/usr/bin/env node
"use strict";

const { loadManifest } = require("./manifest");
const { createSeedClient } = require("./seed-client");
const { readInternalApiAuthConfig } = require("../../../services/shared/internal-api-auth");

const DEFAULT_TARGETS = Object.freeze({
  identity: "http://127.0.0.1:14300",
  project: "http://127.0.0.1:14800",
  device: "http://127.0.0.1:14700",
});

async function main(argv = process.argv.slice(2), env = process.env) {
  const options = parseArgs(argv);
  if (options.plan) {
    const manifest = loadManifest();
    process.stdout.write(`${JSON.stringify({
      fixture_set: manifest.fixture_set,
      environment: manifest.environment,
      accounts: manifest.accounts.length,
      projects: manifest.projects.length,
      devices: manifest.devices.length,
      writes: false,
      write_confirmation_required: true,
      targets: DEFAULT_TARGETS,
    }, null, 2)}\n`);
    return;
  }
  const manifest = loadManifest();
  const client = createSeedClient({
    identityBaseUrl: env.GERNETIX_SYSTEM_TEST_IDENTITY_URL || DEFAULT_TARGETS.identity,
    projectBaseUrl: env.GERNETIX_SYSTEM_TEST_PROJECT_URL || DEFAULT_TARGETS.project,
    deviceBaseUrl: env.GERNETIX_SYSTEM_TEST_DEVICE_URL || DEFAULT_TARGETS.device,
    internalApiAuth: readInternalApiAuthConfig(env, { serviceId: "system-test-seed" }),
    writeConfirmed: options.confirmWrite,
  });
  const password = env[manifest.password_env];
  if (!password) throw new Error(`${manifest.password_env} is required`);
  process.stdout.write(`${JSON.stringify(await client.seed(manifest, password), null, 2)}\n`);
}

function parseArgs(argv) {
  const allowed = new Set(["--plan", "--confirm-write"]);
  for (const argument of argv) {
    if (!allowed.has(argument)) throw new Error(`Unknown fixture argument: ${argument}`);
  }
  if (argv.includes("--plan") && argv.includes("--confirm-write")) {
    throw new Error("--plan and --confirm-write cannot be combined");
  }
  if (!argv.includes("--plan") && !argv.includes("--confirm-write")) {
    throw new Error("Fixture writes require explicit --confirm-write confirmation");
  }
  return Object.freeze({ plan: argv.includes("--plan"), confirmWrite: argv.includes("--confirm-write") });
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`fixture_seed_failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { DEFAULT_TARGETS, main, parseArgs };
