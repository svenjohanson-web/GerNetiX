#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { createConfig, createDefaultPublicDemoService } = require("../services/public-demo-server/src");

const root = path.resolve(__dirname, "..");
const build = path.join(root, "basissoftware", "esp32", ".pio", "build", "waveshare-esp32-s3-audio-voice-lab");

main().catch((error) => {
  process.stderr.write(`Nexi-Release konnte nicht veröffentlicht werden: ${error.message}\n`);
  process.exitCode = 1;
});

async function main() {
  const config = createConfig();
  const sourceCommit = process.env.NEXI_SOURCE_COMMIT || git("rev-parse", "HEAD");
  const version = process.env.NEXI_RELEASE_VERSION || `0.1.0-${sourceCommit.slice(0, 12)}`;
  if (!/^[0-9a-f]{40}$/.test(sourceCommit)) throw new Error("NEXI_SOURCE_COMMIT muss ein vollständiger Git-Commit sein.");
  if (!process.env.NEXI_SOURCE_COMMIT && git("status", "--porcelain", "--untracked-files=no")) {
    throw new Error("Der Nexi-Build darf nur aus einem sauberen, committed Arbeitsstand veröffentlicht werden.");
  }

  const release = {
    demo_id: "nexi-basic-waveshare-s3",
    title: "Nexi Basic",
    description: "Fertig konfigurierte und gebaute Stimmenstudio-Firmware für das Waveshare ESP32-S3 AI Smart Speaker Development Board.",
    board_hardware_item_id: "hardware.processor_board.waveshare_esp32_s3_ai_smart_speaker",
    category: "audio",
    games: [],
    version,
    firmware_file_name: "firmware.bin",
    source_commit_sha: sourceCommit,
    flash_assets: [
      asset("bootloader", "bootloader.bin", 0x0),
      asset("partitions", "partitions.bin", 0x8000),
      asset("otadata", "ota_data_initial.bin", 0xf000),
      asset("firmware", "firmware.bin", 0x20000),
    ],
  };
  release.firmware_sha256 = sha256(Buffer.from(release.flash_assets.find((item) => item.asset_id === "firmware").base64, "base64"));

  const service = await createDefaultPublicDemoService(config);
  try {
    let result;
    try {
      result = await service.publishDemo(release);
    } catch (error) {
      if (error.code !== "release_already_exists") throw error;
      const existing = await service.getFirmware(release.demo_id, release.version);
      if (existing.firmware_sha256 !== release.firmware_sha256) {
        throw new Error(`Die unveränderliche Version ${release.version} existiert bereits mit einer anderen Firmware.`);
      }
      result = await service.getPublicDemo(release.demo_id);
    }
    process.stdout.write(`${JSON.stringify({ demo_id: release.demo_id, version, source_commit: sourceCommit, firmware_sha256: release.firmware_sha256, published_at: result.published_at }, null, 2)}\n`);
  } finally {
    await service.repository.close();
  }
}

function asset(asset_id, fileName, flash_offset) {
  const content = fs.readFileSync(path.join(build, fileName));
  return { asset_id, flash_offset, base64: content.toString("base64") };
}

function sha256(content) { return crypto.createHash("sha256").update(content).digest("hex"); }
function git(...args) { return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim(); }
