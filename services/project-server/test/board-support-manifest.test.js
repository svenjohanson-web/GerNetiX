"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { materializeBoardSupportFiles } = require("../src/repository-store/board-support-manifest");

test("validates and materializes the versioned ES3C28P board-support release", () => {
  const root = path.resolve(__dirname, "../../../hardware/board-support/esp32-s3-es3c28p");
  const files = walk(root).map((filePath) => ({
    path: path.relative(root, filePath).split(path.sep).join("/"),
    content: fs.readFileSync(filePath, "utf8"),
  }));
  const materialized = materializeBoardSupportFiles(files, {
    manifest_path: "gernetix/board-support.json",
    hardware_item_id: "hardware.processor_board.esp32_s3_es3c28p",
    release_version: "1.0.0",
  });
  assert.deepEqual(materialized.files.map((file) => file.path), [
    "boards/es3c28p.json",
    "partitions_full_16mb.csv",
    "include/gernetix_es3c28p_board_support.h",
  ]);
  assert.match(materialized.files.find((file) => file.path === "boards/es3c28p.json").content, /ESP32-S3 ES3C28P/);
});

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(entryPath) : [entryPath];
  });
}
