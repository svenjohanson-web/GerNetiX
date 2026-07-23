"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const MAX_DOWNLOAD_BYTES = 256 * 1024 * 1024;

class SqlitePlatformDownloadRepository {
  constructor(sqlitePath) {
    fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
    this.db = new DatabaseSync(sqlitePath);
    this.db.exec("PRAGMA busy_timeout = 5000;");
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.migrate();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS identity_platform_download_releases (
        download_id TEXT NOT NULL,
        version TEXT NOT NULL,
        platform TEXT NOT NULL,
        architecture TEXT NOT NULL,
        label TEXT NOT NULL,
        detail TEXT NOT NULL,
        file_name TEXT NOT NULL,
        content_type TEXT NOT NULL,
        content_blob BLOB NOT NULL,
        size_bytes INTEGER NOT NULL,
        sha256 TEXT NOT NULL,
        visibility TEXT NOT NULL DEFAULT 'authenticated',
        status TEXT NOT NULL CHECK (status IN ('published', 'revoked')),
        created_at TEXT NOT NULL,
        published_at TEXT NOT NULL,
        PRIMARY KEY (download_id, version, platform, architecture)
      );

      CREATE INDEX IF NOT EXISTS idx_identity_platform_download_releases_current
        ON identity_platform_download_releases(download_id, platform, architecture, status, published_at DESC);
    `);
    const columns = this.db.prepare("PRAGMA table_info(identity_platform_download_releases)").all();
    if (!columns.some((column) => column.name === "visibility")) {
      this.db.exec("ALTER TABLE identity_platform_download_releases ADD COLUMN visibility TEXT NOT NULL DEFAULT 'authenticated';");
    }
    this.db.prepare(`
      UPDATE identity_platform_download_releases
      SET visibility = 'public'
      WHERE download_id = 'flashbox-initial-image'
    `).run();
  }

  publish(input) {
    const release = normalizeRelease(input);
    const content = Buffer.isBuffer(input.content) ? input.content : Buffer.from(input.content || "");
    if (!content.length || content.length > MAX_DOWNLOAD_BYTES) {
      throw platformDownloadError("invalid_download_content", "Das Download-Artefakt fehlt oder ist größer als 256 MiB.");
    }
    const sha256 = crypto.createHash("sha256").update(content).digest("hex");
    if (input.sha256 && String(input.sha256).toLowerCase() !== sha256) {
      throw platformDownloadError("download_checksum_mismatch", "Die angegebene Prüfsumme stimmt nicht mit dem Download-Artefakt überein.");
    }

    const now = new Date().toISOString();
    try {
      this.db.prepare(`
        INSERT INTO identity_platform_download_releases (
          download_id, version, platform, architecture, label, detail, file_name,
          content_type, content_blob, size_bytes, sha256, visibility, status, created_at, published_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'published', ?, ?)
      `).run(
        release.download_id,
        release.version,
        release.platform,
        release.architecture,
        release.label,
        release.detail,
        release.file_name,
        release.content_type,
        content,
        content.length,
        sha256,
        release.visibility,
        now,
        now,
      );
    } catch (error) {
      if (String(error.message).includes("UNIQUE constraint failed")) {
        throw platformDownloadError("download_release_already_exists", "Diese Download-Version ist bereits veröffentlicht und darf nicht überschrieben werden.");
      }
      throw error;
    }
    return this.getRelease(release.download_id, release.version, release.platform, release.architecture);
  }

  listCurrent(downloadId, options = {}) {
    const visibility = normalizeVisibilityFilter(options.visibility);
    return this.db.prepare(`
      SELECT download_id, version, platform, architecture, label, detail, file_name,
             content_type, size_bytes, sha256, visibility, published_at
      FROM identity_platform_download_releases AS release
      WHERE download_id = ? AND status = 'published'
        AND (? = '' OR visibility = ?)
        AND rowid = (
          SELECT candidate.rowid
          FROM identity_platform_download_releases AS candidate
          WHERE candidate.download_id = release.download_id
            AND candidate.platform = release.platform
            AND candidate.architecture = release.architecture
            AND candidate.status = 'published'
            AND (? = '' OR candidate.visibility = ?)
          ORDER BY candidate.published_at DESC, candidate.rowid DESC
          LIMIT 1
      )
      ORDER BY platform, architecture
    `).all(downloadId, visibility, visibility, visibility, visibility);
  }

  getRelease(downloadId, version, platform, architecture, options = {}) {
    const visibility = normalizeVisibilityFilter(options.visibility);
    const release = this.db.prepare(`
      SELECT download_id, version, platform, architecture, label, detail, file_name,
             content_type, size_bytes, sha256, visibility, published_at
      FROM identity_platform_download_releases
      WHERE download_id = ? AND version = ? AND platform = ? AND architecture = ? AND status = 'published'
        AND (? = '' OR visibility = ?)
    `).get(downloadId, version, platform, architecture, visibility, visibility);
    if (!release) throw platformDownloadError("download_release_not_found", "Der Download-Release wurde nicht gefunden.");
    return release;
  }

  getContent(downloadId, version, platform, architecture, options = {}) {
    const visibility = normalizeVisibilityFilter(options.visibility);
    const release = this.db.prepare(`
      SELECT file_name, content_type, content_blob, size_bytes, sha256, visibility
      FROM identity_platform_download_releases
      WHERE download_id = ? AND version = ? AND platform = ? AND architecture = ? AND status = 'published'
        AND (? = '' OR visibility = ?)
    `).get(downloadId, version, platform, architecture, visibility, visibility);
    if (!release) throw platformDownloadError("download_release_not_found", "Der Download-Release wurde nicht gefunden.");
    return { ...release, content_blob: Buffer.from(release.content_blob) };
  }

  close() {
    this.db.close();
  }
}

function normalizeRelease(input) {
  const release = Object.fromEntries([
    "download_id",
    "version",
    "platform",
    "architecture",
    "label",
    "detail",
    "file_name",
    "content_type",
  ].map((field) => [field, requiredString(input[field], field)]));
  release.visibility = normalizeVisibility(input.visibility || "authenticated");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(release.download_id)) {
    throw platformDownloadError("invalid_download_id", "download_id darf nur Kleinbuchstaben, Ziffern und Bindestriche enthalten.");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(release.version)) {
    throw platformDownloadError("invalid_download_version", "version enthält ungültige Zeichen.");
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(release.file_name)) {
    throw platformDownloadError("invalid_download_file_name", "file_name enthält ungültige Zeichen.");
  }
  return release;
}

function normalizeVisibility(value) {
  const visibility = String(value || "").trim();
  if (!["public", "authenticated", "entitled", "internal"].includes(visibility)) {
    throw platformDownloadError("invalid_download_visibility", "visibility muss public, authenticated, entitled oder internal sein.");
  }
  return visibility;
}

function normalizeVisibilityFilter(value) {
  if (value === undefined || value === null || value === "") return "";
  return normalizeVisibility(value);
}

function requiredString(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw platformDownloadError("required_field_missing", `${field} muss angegeben werden.`);
  return normalized;
}

function platformDownloadError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

module.exports = { MAX_DOWNLOAD_BYTES, SqlitePlatformDownloadRepository };
