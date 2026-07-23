#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { SqlitePlatformDownloadRepository } = require("../services/identity-server/src/repositories/sqlite-platform-download-repository");

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined) throw new Error(`Ungueltiges Argument: ${key || ""}`);
    values[key.slice(2)] = value;
  }
  return values;
}

function required(value, name) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`--${name} muss angegeben werden.`);
  return normalized;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const filePath = path.resolve(required(args.file, "file"));
  const sqlitePath = path.resolve(args.sqlite || process.env.PLATFORM_DOWNLOAD_SQLITE_PATH || ".runtime/gernetix-platform-downloads.sqlite");
  const repository = new SqlitePlatformDownloadRepository(sqlitePath);
  try {
    const release = repository.publish({
      download_id: "flashbox-initial-image",
      version: required(args.version, "version"),
      platform: "esp32",
      architecture: "esp32-s3",
      label: "Flashbox Initialimage",
      detail: "Signiertes, accountneutrales ESP32-S3-Initialimage",
      visibility: "public",
      file_name: path.basename(filePath),
      content_type: "application/octet-stream",
      content: fs.readFileSync(filePath),
    });
    process.stdout.write(`${JSON.stringify(release, null, 2)}\n`);
  } finally {
    repository.close();
  }
}

if (require.main === module) {
  try { main(); } catch (error) {
    process.stderr.write(`Flashbox-Initialimage nicht freigegeben: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { parseArgs };
