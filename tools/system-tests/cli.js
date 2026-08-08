#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { loadProfile } = require("./lib/config");
const { buildRunPlan } = require("./lib/run-plan");
const { evaluateRun } = require("./lib/summary");

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  const profile = loadProfile(options.profile || "smoke");
  const output = options.results
    ? evaluateRun(profile, JSON.parse(fs.readFileSync(options.results, "utf8")))
    : buildRunPlan(profile, { identityUrl: options.identityUrl, brokerUrl: options.brokerUrl });
  process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  if (options.results && !output.passed) process.exitCode = 1;
}

function parseArgs(argv) {
  const values = {};
  const allowed = new Set(["profile", "results", "identityUrl", "brokerUrl"]);
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith("--") || value === undefined) throw new Error(`Invalid argument: ${flag || "missing"}`);
    const key = flag.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    if (!allowed.has(key)) throw new Error(`Unknown argument: ${flag}`);
    values[key] = value;
  }
  return values;
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    process.stderr.write(`System-test command failed: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { main, parseArgs };
