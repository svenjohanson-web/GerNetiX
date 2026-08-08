#!/usr/bin/env node
"use strict";

const { runSystemTests } = require("./index");

async function main(argv = process.argv.slice(2), environment = process.env) {
  const options = parseArgs(argv);
  const result = await runSystemTests({ ...options, environment });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

function parseArgs(argv) {
  const result = { browser: false };
  const valueFlags = new Map([
    ["--profile", "profile"],
    ["--identity-url", "identityUrl"],
    ["--broker-url", "brokerUrl"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    if (flag === "--browser") {
      result.browser = true;
      continue;
    }
    const key = valueFlags.get(flag);
    const value = argv[index + 1];
    if (!key || value === undefined || value.startsWith("--")) throw new Error(`Invalid argument: ${flag || "missing"}`);
    result[key] = value;
    index += 1;
  }
  return result;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`System-test orchestration failed: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { main, parseArgs };
