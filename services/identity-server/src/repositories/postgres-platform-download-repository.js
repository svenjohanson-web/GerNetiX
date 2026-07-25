"use strict";

const crypto = require("node:crypto");
const { MAX_DOWNLOAD_BYTES } = require("./sqlite-platform-download-repository");

class PostgresPlatformDownloadRepository {
  static async create(options = {}) {
    const { Pool } = require("pg");
    const repository = new PostgresPlatformDownloadRepository(options.pool || new Pool(options.poolOptions));
    await repository.migrate();
    return repository;
  }

  constructor(pool) {
    this.pool = pool;
  }

  async migrate() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS identity_platform_download_releases (
        download_id TEXT NOT NULL,
        version TEXT NOT NULL,
        platform TEXT NOT NULL,
        architecture TEXT NOT NULL,
        label TEXT NOT NULL,
        detail TEXT NOT NULL,
        file_name TEXT NOT NULL,
        content_type TEXT NOT NULL,
        content_blob BYTEA NOT NULL,
        size_bytes BIGINT NOT NULL,
        sha256 TEXT NOT NULL,
        visibility TEXT NOT NULL CHECK (visibility IN ('public', 'authenticated', 'entitled', 'internal')),
        status TEXT NOT NULL CHECK (status IN ('published', 'revoked')),
        created_at TIMESTAMPTZ NOT NULL,
        published_at TIMESTAMPTZ NOT NULL,
        PRIMARY KEY (download_id, version, platform, architecture)
      );
      CREATE INDEX IF NOT EXISTS idx_identity_platform_download_releases_current
        ON identity_platform_download_releases(download_id, platform, architecture, status, published_at DESC);
    `);
  }

  async publish(input) {
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
      await this.pool.query(`
        INSERT INTO identity_platform_download_releases (
          download_id, version, platform, architecture, label, detail, file_name,
          content_type, content_blob, size_bytes, sha256, visibility, status, created_at, published_at
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,'published',$13,$13)
      `, [
        release.download_id, release.version, release.platform, release.architecture,
        release.label, release.detail, release.file_name, release.content_type,
        content, content.length, sha256, release.visibility, now,
      ]);
    } catch (error) {
      if (error.code === "23505") {
        throw platformDownloadError("download_release_already_exists", "Diese Download-Version ist bereits veröffentlicht und darf nicht überschrieben werden.");
      }
      throw error;
    }
    return this.getRelease(release.download_id, release.version, release.platform, release.architecture);
  }

  async listCurrent(downloadId, options = {}) {
    const visibility = normalizeVisibilityFilter(options.visibility);
    const result = await this.pool.query(`
      SELECT DISTINCT ON (platform, architecture)
        download_id, version, platform, architecture, label, detail, file_name,
        content_type, size_bytes::bigint AS size_bytes, sha256, visibility,
        published_at::text AS published_at
      FROM identity_platform_download_releases
      WHERE download_id = $1 AND status = 'published'
        AND ($2 = '' OR visibility = $2)
      ORDER BY platform, architecture, published_at DESC, version DESC
    `, [downloadId, visibility]);
    return result.rows.map(normalizeNumbers);
  }

  async getRelease(downloadId, version, platform, architecture, options = {}) {
    const result = await this.pool.query(`
      SELECT download_id, version, platform, architecture, label, detail, file_name,
             content_type, size_bytes::bigint AS size_bytes, sha256, visibility,
             published_at::text AS published_at
      FROM identity_platform_download_releases
      WHERE download_id=$1 AND version=$2 AND platform=$3 AND architecture=$4
        AND status='published' AND ($5 = '' OR visibility = $5)
    `, [downloadId, version, platform, architecture, normalizeVisibilityFilter(options.visibility)]);
    if (!result.rows[0]) throw platformDownloadError("download_release_not_found", "Der Download-Release wurde nicht gefunden.");
    return normalizeNumbers(result.rows[0]);
  }

  async getContent(downloadId, version, platform, architecture, options = {}) {
    const result = await this.pool.query(`
      SELECT file_name, content_type, content_blob, size_bytes::bigint AS size_bytes, sha256, visibility
      FROM identity_platform_download_releases
      WHERE download_id=$1 AND version=$2 AND platform=$3 AND architecture=$4
        AND status='published' AND ($5 = '' OR visibility = $5)
    `, [downloadId, version, platform, architecture, normalizeVisibilityFilter(options.visibility)]);
    if (!result.rows[0]) throw platformDownloadError("download_release_not_found", "Der Download-Release wurde nicht gefunden.");
    return { ...normalizeNumbers(result.rows[0]), content_blob: Buffer.from(result.rows[0].content_blob) };
  }

  async close() {
    await this.pool.end();
  }
}

function normalizeRelease(input) {
  const fields = ["download_id", "version", "platform", "architecture", "label", "detail", "file_name", "content_type"];
  const release = Object.fromEntries(fields.map((field) => [field, requiredString(input[field], field)]));
  release.visibility = normalizeVisibility(input.visibility || "authenticated");
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(release.download_id)) throw platformDownloadError("invalid_download_id", "download_id ist ungültig.");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(release.version)) throw platformDownloadError("invalid_download_version", "version ist ungültig.");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(release.file_name)) throw platformDownloadError("invalid_download_file_name", "file_name ist ungültig.");
  return release;
}

function normalizeVisibility(value) {
  const visibility = String(value || "").trim();
  if (!["public", "authenticated", "entitled", "internal"].includes(visibility)) {
    throw platformDownloadError("invalid_download_visibility", "visibility ist ungültig.");
  }
  return visibility;
}

function normalizeVisibilityFilter(value) {
  return value === undefined || value === null || value === "" ? "" : normalizeVisibility(value);
}

function requiredString(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw platformDownloadError("required_field_missing", `${field} muss angegeben werden.`);
  return normalized;
}

function normalizeNumbers(row) {
  return { ...row, size_bytes: Number(row.size_bytes) };
}

function platformDownloadError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

module.exports = { PostgresPlatformDownloadRepository };
