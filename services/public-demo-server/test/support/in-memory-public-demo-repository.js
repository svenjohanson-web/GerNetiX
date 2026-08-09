"use strict";

const crypto = require("node:crypto");
const { PublicDemoError } = require("../../src/errors");

class InMemoryPublicDemoRepository {
  constructor() {
    this.demos = new Map();
    this.releases = new Map();
  }

  publish(input) {
    const demo = readDemo(input);
    const assets = readAssets(input);
    const key = `${demo.demo_id}:${demo.version}`;
    if (this.releases.has(key)) throw new PublicDemoError("release_already_exists", "Release existiert bereits.", 409);
    if (input.firmware_sha256 && input.firmware_sha256 !== assets.firmware.sha256) {
      throw new PublicDemoError("firmware_checksum_mismatch", "PrÃ¼fsumme stimmt nicht.");
    }
    const now = new Date().toISOString();
    this.demos.set(demo.demo_id, { ...demo, published_at: now });
    this.releases.set(key, { ...demo, ...assets, created_at: now });
    return this.getPublicDemo(demo.demo_id);
  }

  listPublicDemos() { return [...this.demos.values()].map(publicDemo); }

  getPublicDemo(demoId) {
    const demo = this.demos.get(demoId);
    if (!demo) throw new PublicDemoError("demo_not_found", "Demo nicht gefunden.", 404);
    const releases = [...this.releases.values()].filter((release) => release.demo_id === demoId)
      .sort((left, right) => right.created_at.localeCompare(left.created_at) || right.version.localeCompare(left.version))
      .map((release) => ({ version: release.version, firmware_file_name: "firmware.bin", firmware_size_bytes: release.firmware.size_bytes,
        firmware_sha256: release.firmware.sha256, source_commit_sha: release.source_commit_sha || null, created_at: release.created_at,
        firmware_download_url: `/api/public/demos/${encodeURIComponent(demoId)}/releases/${encodeURIComponent(release.version)}/firmware` }));
    return { ...publicDemo(demo), releases };
  }

  getFirmware(demoId, version) { return this.getAsset(demoId, version, "firmware"); }

  getFlashManifest(demoId, version) {
    const release = this.release(demoId, version);
    return { demo_id: demoId, version, source_path: `public-demos/${demoId}`, source_version: release.source_commit_sha || version,
      chip: "esp32s3", flash_mode: "dio", flash_freq: "80m", flash_size: "16MB",
      assets: Object.values(release.assets).sort((left, right) => left.flash_offset - right.flash_offset)
        .map((asset) => ({ asset_id: asset.asset_id, file_name: asset.file_name, flash_offset: asset.flash_offset, size_bytes: asset.size_bytes, sha256: asset.sha256,
          download_url: `/api/public/demos/${encodeURIComponent(demoId)}/releases/${encodeURIComponent(version)}/assets/${asset.asset_id}` })) };
  }

  getAsset(demoId, version, assetId) {
    const asset = this.release(demoId, version).assets[assetId];
    if (!asset) throw new PublicDemoError("release_not_found", "Release nicht gefunden.", 404);
    return { firmware_file_name: asset.file_name, firmware_size_bytes: asset.size_bytes, firmware_sha256: asset.sha256, firmware_blob: asset.content };
  }

  release(demoId, version) {
    const release = this.releases.get(`${demoId}:${version}`);
    if (!release) throw new PublicDemoError("release_not_found", "Release nicht gefunden.", 404);
    return release;
  }

  close() {}
}

function readDemo(input) {
  for (const field of ["demo_id", "title", "description", "board_hardware_item_id", "category", "version", "firmware_file_name"]) {
    if (!String(input[field] || "").trim()) throw new PublicDemoError("required_field_missing", `${field} fehlt.`);
  }
  if (input.firmware_file_name !== "firmware.bin") throw new PublicDemoError("invalid_firmware_file", "UngÃ¼ltige Firmwaredatei.");
  return { demo_id: input.demo_id, title: input.title, description: input.description, board_hardware_item_id: input.board_hardware_item_id,
    category: input.category, version: input.version, source_commit_sha: input.source_commit_sha || null, games: Array.isArray(input.games) ? input.games : [] };
}

function readAssets(input) {
  const definitions = { bootloader: ["bootloader.bin", 0], partitions: ["partitions.bin", 0x8000], otadata: ["ota_data_initial.bin", 0xf000], firmware: ["firmware.bin", 0x10000] };
  const entries = Array.isArray(input.flash_assets) ? input.flash_assets : ["bootloader", "partitions", "firmware"].map((asset_id) => ({ asset_id, base64: input[`${asset_id}_base64`] }));
  const assets = {};
  for (const entry of entries) {
    const definition = definitions[entry.asset_id];
    const content = Buffer.from(entry.base64 || "", "base64");
    if (!definition || assets[entry.asset_id] || !content.length) throw new PublicDemoError("flash_asset_invalid", "UngÃ¼ltiges Flash-Asset.");
    assets[entry.asset_id] = { asset_id: entry.asset_id, file_name: definition[0], flash_offset: entry.flash_offset ?? definition[1], content, size_bytes: content.length,
      sha256: crypto.createHash("sha256").update(content).digest("hex") };
  }
  for (const required of ["bootloader", "partitions", "firmware"]) if (!assets[required]) throw new PublicDemoError("flash_asset_invalid", "Flash-Assets fehlen.");
  return { firmware: assets.firmware, ...assets, assets };
}

function publicDemo(demo) { return { demo_id: demo.demo_id, title: demo.title, description: demo.description, board_hardware_item_id: demo.board_hardware_item_id,
  category: demo.category, games: demo.games, usb_flash_only: true, ota_supported: false, published_at: demo.published_at }; }

module.exports = { InMemoryPublicDemoRepository };
