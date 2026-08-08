#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { validateProfile } = require("../lib/config");
const { mergeReports } = require(".");

const FLAGS = Object.freeze(["profile-file", "k6", "devices", "browser", "chaos", "integrity"]);

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!flag?.startsWith("--") || value === undefined) throw new Error("invalid_arguments");
    const name = flag.slice(2);
    if (!FLAGS.includes(name) || Object.hasOwn(values, name)) throw new Error("invalid_arguments");
    values[name] = value;
  }
  for (const name of FLAGS) {
    if (!Object.hasOwn(values, name)) throw new Error(`missing_${name.replaceAll("-", "_")}`);
  }
  return values;
}

function mergeFiles(options, dependencies = {}) {
  const readFile = dependencies.readFile || ((file) => fs.readFileSync(file, "utf8"));
  const generatedAt = dependencies.generatedAt;
  const readJson = (name) => {
    try { return JSON.parse(readFile(options[name])); }
    catch { throw new Error(`invalid_${name.replaceAll("-", "_")}_report`); }
  };
  const profile = validateProfile(readJson("profile-file"));
  return mergeReports(profile, {
    k6: readJson("k6"),
    devices: readJson("devices"),
    browser: options.browser === "skipped" ? null : readJson("browser"),
    chaos: readJson("chaos"),
    integrity: readJson("integrity"),
  }, { generatedAt });
}

function main(argv = process.argv.slice(2), dependencies = {}) {
  const output = mergeFiles(parseArgs(argv), dependencies);
  (dependencies.stdout || process.stdout).write(`${JSON.stringify(output, null, 2)}\n`);
  return output;
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    process.stderr.write(`System-test report merge failed: ${safeReason(error)}\n`);
    process.exitCode = 1;
  }
}

function safeReason(error) {
  const reason = String(error?.message || "invalid_report");
  return /^(?:invalid|missing)_[a-z0-9_]{1,72}$/.test(reason) ? reason : "invalid_report";
}

module.exports = { FLAGS, main, mergeFiles, parseArgs, safeReason };
