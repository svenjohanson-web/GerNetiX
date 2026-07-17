const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { PublicDemoError } = require("../errors");

class SqlitePublicDemoRepository {
  constructor(sqlitePath) {
    fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
    this.db = new DatabaseSync(sqlitePath);
    this.db.exec("PRAGMA busy_timeout = 5000;");
    this.db.exec("PRAGMA foreign_keys = ON;");
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.migrate();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS public_demo_catalog (
        demo_id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        board_hardware_item_id TEXT NOT NULL,
        category TEXT NOT NULL,
        games_json TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft', 'published', 'revoked')),
        usb_flash_only INTEGER NOT NULL CHECK (usb_flash_only = 1),
        ota_supported INTEGER NOT NULL CHECK (ota_supported = 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        published_at TEXT
      );

      CREATE TABLE IF NOT EXISTS public_demo_releases (
        demo_id TEXT NOT NULL,
        version TEXT NOT NULL,
        firmware_file_name TEXT NOT NULL,
        firmware_blob BLOB NOT NULL,
        firmware_size_bytes INTEGER NOT NULL,
        firmware_sha256 TEXT NOT NULL,
        source_build_sha256 TEXT,
        created_at TEXT NOT NULL,
        PRIMARY KEY (demo_id, version),
        FOREIGN KEY (demo_id) REFERENCES public_demo_catalog(demo_id) ON DELETE RESTRICT
      );

      CREATE INDEX IF NOT EXISTS idx_public_demo_catalog_status
        ON public_demo_catalog(status, published_at DESC, demo_id);

      CREATE TABLE IF NOT EXISTS public_demo_release_assets (
        demo_id TEXT NOT NULL,
        version TEXT NOT NULL,
        asset_id TEXT NOT NULL CHECK (asset_id IN ('bootloader', 'partitions', 'firmware')),
        file_name TEXT NOT NULL,
        flash_offset INTEGER NOT NULL,
        content_blob BLOB NOT NULL,
        size_bytes INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        PRIMARY KEY (demo_id, version, asset_id),
        FOREIGN KEY (demo_id, version) REFERENCES public_demo_releases(demo_id, version) ON DELETE RESTRICT
      );
    `);
  }

  publish(input) {
    const demo = normalizeDemo(input);
    const assets = normalizeAssets(input);
    if (input.firmware_sha256 && input.firmware_sha256 !== assets.firmware.sha256) {
      throw new PublicDemoError("firmware_checksum_mismatch", "Die angegebene Firmware-Prüfsumme stimmt nicht mit dem Release überein.");
    }

    const now = new Date().toISOString();
    this.db.exec("BEGIN IMMEDIATE");
    try {
      this.db.prepare(`
        INSERT INTO public_demo_catalog (
          demo_id, title, description, board_hardware_item_id, category, games_json,
          status, usb_flash_only, ota_supported, created_at, updated_at, published_at
        ) VALUES (?, ?, ?, ?, ?, ?, 'published', 1, 0, ?, ?, ?)
        ON CONFLICT(demo_id) DO UPDATE SET
          title = excluded.title,
          description = excluded.description,
          board_hardware_item_id = excluded.board_hardware_item_id,
          category = excluded.category,
          games_json = excluded.games_json,
          status = 'published',
          usb_flash_only = 1,
          ota_supported = 0,
          updated_at = excluded.updated_at,
          published_at = excluded.published_at
      `).run(demo.demo_id, demo.title, demo.description, demo.board_hardware_item_id, demo.category,
        JSON.stringify(demo.games), now, now, now);
      this.db.prepare(`
        INSERT INTO public_demo_releases (
          demo_id, version, firmware_file_name, firmware_blob, firmware_size_bytes,
          firmware_sha256, source_build_sha256, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(demo.demo_id, demo.version, assets.firmware.file_name, assets.firmware.content, assets.firmware.size_bytes,
        assets.firmware.sha256, optionalString(input.source_build_sha256), now);
      const assetStatement = this.db.prepare(`INSERT INTO public_demo_release_assets
        (demo_id, version, asset_id, file_name, flash_offset, content_blob, size_bytes, sha256)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
      for (const asset of Object.values(assets)) {
        assetStatement.run(demo.demo_id, demo.version, asset.asset_id, asset.file_name, asset.flash_offset,
          asset.content, asset.size_bytes, asset.sha256);
      }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      if (String(error.message).includes("UNIQUE constraint failed: public_demo_releases")) {
        throw new PublicDemoError("release_already_exists", "Diese Demo-Version ist bereits veröffentlicht und darf nicht überschrieben werden.", 409);
      }
      throw error;
    }
    return this.getPublicDemo(demo.demo_id);
  }

  listPublicDemos() {
    return this.db.prepare(`
      SELECT demo_id, title, description, board_hardware_item_id, category, games_json, published_at
      FROM public_demo_catalog
      WHERE status = 'published'
      ORDER BY published_at DESC, demo_id ASC
    `).all().map((row) => publicCatalogRow(row));
  }

  getPublicDemo(demoId) {
    const row = this.db.prepare(`
      SELECT demo_id, title, description, board_hardware_item_id, category, games_json, published_at
      FROM public_demo_catalog
      WHERE demo_id = ? AND status = 'published'
    `).get(demoId);
    if (!row) throw new PublicDemoError("demo_not_found", "Die öffentliche Demo wurde nicht gefunden.", 404);
    const releases = this.db.prepare(`
      SELECT version, firmware_file_name, firmware_size_bytes, firmware_sha256, created_at
      FROM public_demo_releases WHERE demo_id = ? ORDER BY created_at DESC, version DESC
    `).all(demoId).map((release) => ({
      ...release,
      firmware_download_url: `/api/public/demos/${encodeURIComponent(demoId)}/releases/${encodeURIComponent(release.version)}/firmware`,
    }));
    return { ...publicCatalogRow(row), releases };
  }

  getFirmware(demoId, version) {
    return this.getAsset(demoId, version, "firmware");
  }

  getFlashManifest(demoId, version) {
    this.getPublicDemo(demoId);
    const assets = this.db.prepare(`SELECT asset_id, file_name, flash_offset, size_bytes, sha256
      FROM public_demo_release_assets WHERE demo_id = ? AND version = ? ORDER BY flash_offset`).all(demoId, version);
    if (assets.length !== 3) throw new PublicDemoError("release_not_found", "Der vollständige Flash-Release wurde nicht gefunden.", 404);
    return { demo_id: demoId, version, chip: "esp32s3", flash_mode: "dio", flash_freq: "80m", flash_size: "16MB",
      assets: assets.map((asset) => ({ ...asset, download_url: `/api/public/demos/${encodeURIComponent(demoId)}/releases/${encodeURIComponent(version)}/assets/${asset.asset_id}` })) };
  }

  getAsset(demoId, version, assetId) {
    const row = this.db.prepare(`
      SELECT a.file_name AS firmware_file_name, a.content_blob AS firmware_blob, a.size_bytes AS firmware_size_bytes, a.sha256 AS firmware_sha256
      FROM public_demo_release_assets a
      JOIN public_demo_catalog c ON c.demo_id = a.demo_id
      WHERE a.demo_id = ? AND a.version = ? AND a.asset_id = ? AND c.status = 'published'
    `).get(demoId, version, assetId);
    if (!row) throw new PublicDemoError("release_not_found", "Der öffentliche Demo-Release wurde nicht gefunden.", 404);
    return row;
  }

  close() {
    this.db.close();
  }
}

function normalizeDemo(input) {
  const fields = ["demo_id", "title", "description", "board_hardware_item_id", "category", "version", "firmware_file_name"];
  const demo = Object.fromEntries(fields.map((field) => [field, requiredString(input[field], field)]));
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(demo.demo_id)) {
    throw new PublicDemoError("invalid_demo_id", "demo_id darf nur Kleinbuchstaben, Ziffern und Bindestriche enthalten.");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(demo.version)) {
    throw new PublicDemoError("invalid_release_version", "version enthält ungültige Zeichen.");
  }
  if (demo.firmware_file_name !== "firmware.bin") {
    throw new PublicDemoError("invalid_firmware_file", "Öffentliche Demo-Releases dürfen nur firmware.bin enthalten.");
  }
  demo.games = Array.isArray(input.games)
    ? input.games.map((game) => requiredString(game, "games[]"))
    : [];
  return demo;
}

function normalizeAssets(input) {
  const definitions = {
    bootloader: { file_name: "bootloader.bin", flash_offset: 0x0 },
    partitions: { file_name: "partitions.bin", flash_offset: 0x8000 },
    firmware: { file_name: "firmware.bin", flash_offset: 0x10000 },
  };
  return Object.fromEntries(Object.entries(definitions).map(([asset_id, definition]) => {
    const content = Buffer.from(input[`${asset_id}_base64`] || "", "base64");
    if (!content.length || content.length > 16 * 1024 * 1024) throw new PublicDemoError("flash_asset_invalid", `${asset_id} fehlt oder ist zu groß.`);
    const sha256 = crypto.createHash("sha256").update(content).digest("hex");
    return [asset_id, { asset_id, ...definition, content, size_bytes: content.length, sha256 }];
  }));
}

function requiredString(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new PublicDemoError("required_field_missing", `${field} muss angegeben werden.`);
  return normalized;
}

function optionalString(value) {
  const normalized = String(value || "").trim();
  return normalized || null;
}

function publicCatalogRow(row) {
  return {
    demo_id: row.demo_id,
    title: row.title,
    description: row.description,
    board_hardware_item_id: row.board_hardware_item_id,
    category: row.category,
    games: JSON.parse(row.games_json),
    usb_flash_only: true,
    ota_supported: false,
    published_at: row.published_at,
  };
}

module.exports = { SqlitePublicDemoRepository };
