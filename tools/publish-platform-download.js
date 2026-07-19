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
    if (!key?.startsWith("--") || value === undefined) throw new Error(`Ungültiges Argument: ${key || ""}`);
    values[key.slice(2)] = value;
  }
  return values;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const fileArgument = required(args.file, "file");
  const filePath = fileArgument === "-" ? "" : path.resolve(fileArgument);
  const fileName = fileArgument === "-"
    ? required(args["file-name"], "file-name")
    : path.basename(filePath);
  const sqlitePath = path.resolve(args.sqlite || process.env.PLATFORM_DOWNLOAD_SQLITE_PATH || ".runtime/gernetix-platform-downloads.sqlite");
  const repository = new SqlitePlatformDownloadRepository(sqlitePath);
  try {
    const release = repository.publish({
      download_id: required(args.id, "id"),
      version: required(args.version, "version"),
      platform: required(args.platform, "platform"),
      architecture: required(args.architecture, "architecture"),
      label: required(args.label, "label"),
      detail: required(args.detail, "detail"),
      file_name: fileName,
      content_type: required(args["content-type"], "content-type"),
      content: fs.readFileSync(fileArgument === "-" ? 0 : filePath),
    });
    process.stdout.write(`${JSON.stringify(release, null, 2)}\n`);
  } finally {
    repository.close();
  }
}

function required(value, name) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`--${name} muss angegeben werden.`);
  return normalized;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`Download-Release nicht veröffentlicht: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { parseArgs };
