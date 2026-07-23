"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const MAX_ACCOUNT_ASSET_BYTES = 16 * 1024 * 1024;
const MAX_ACCOUNT_ASSET_METADATA_BYTES = 64 * 1024;
const ACCOUNT_ASSET_TYPES = new Set(["qr_code", "image", "image_style", "export"]);

class SqliteAccountAssetRepository {
  constructor(sqlitePath) {
    if (sqlitePath !== ":memory:") fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
    this.db = new DatabaseSync(sqlitePath);
    this.db.exec("PRAGMA busy_timeout = 5000;");
    this.db.exec("PRAGMA journal_mode = WAL;");
    this.migrate();
  }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS identity_account_assets (
        asset_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        asset_type TEXT NOT NULL,
        display_name TEXT NOT NULL,
        content_type TEXT NOT NULL,
        content_blob BLOB,
        size_bytes INTEGER NOT NULL,
        sha256 TEXT,
        metadata_json TEXT NOT NULL,
        visibility TEXT NOT NULL CHECK (visibility = 'owner_only'),
        status TEXT NOT NULL CHECK (status IN ('active', 'deleted')),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_identity_account_assets_owner
        ON identity_account_assets(account_id, status, updated_at DESC);
    `);
  }

  create(accountId, input = {}) {
    const owner = required(accountId, "account_id");
    const assetType = required(input.asset_type, "asset_type");
    if (!ACCOUNT_ASSET_TYPES.has(assetType)) {
      throw assetError("invalid_account_asset_type", "asset_type muss qr_code, image, image_style oder export sein.");
    }
    if (input.visibility && input.visibility !== "owner_only") {
      throw assetError("invalid_account_asset_visibility", "Account-Assets sind immer owner_only.");
    }
    const content = normalizeContent(input);
    if (content.length > MAX_ACCOUNT_ASSET_BYTES) {
      throw assetError("account_asset_too_large", "Account-Asset ist größer als 16 MiB.");
    }
    const now = new Date().toISOString();
    const displayName = required(input.display_name, "display_name");
    const contentType = required(input.content_type || defaultContentType(assetType), "content_type");
    if (displayName.length > 200 || contentType.length > 255) {
      throw assetError("invalid_account_asset_field_length", "display_name oder content_type ist zu lang.");
    }
    const metadata = normalizeMetadata(input.metadata);
    const metadataJson = JSON.stringify(metadata);
    if (Buffer.byteLength(metadataJson, "utf8") > MAX_ACCOUNT_ASSET_METADATA_BYTES) {
      throw assetError("account_asset_metadata_too_large", "Account-Asset-Metadaten sind größer als 64 KiB.");
    }
    const asset = {
      asset_id: `account_asset_${crypto.randomUUID()}`,
      account_id: owner,
      asset_type: assetType,
      display_name: displayName,
      content_type: contentType,
      content_blob: content.length ? content : null,
      size_bytes: content.length,
      sha256: content.length ? crypto.createHash("sha256").update(content).digest("hex") : null,
      metadata_json: metadataJson,
      visibility: "owner_only",
      status: "active",
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    this.db.prepare(`
      INSERT INTO identity_account_assets (
        asset_id, account_id, asset_type, display_name, content_type, content_blob,
        size_bytes, sha256, metadata_json, visibility, status, created_at, updated_at, deleted_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      asset.asset_id,
      asset.account_id,
      asset.asset_type,
      asset.display_name,
      asset.content_type,
      asset.content_blob,
      asset.size_bytes,
      asset.sha256,
      asset.metadata_json,
      asset.visibility,
      asset.status,
      asset.created_at,
      asset.updated_at,
      asset.deleted_at,
    );
    return present(asset);
  }

  list(accountId) {
    return this.db.prepare(`
      SELECT asset_id, account_id, asset_type, display_name, content_type, size_bytes,
             sha256, metadata_json, visibility, status, created_at, updated_at, deleted_at
      FROM identity_account_assets
      WHERE account_id = ? AND status = 'active'
      ORDER BY updated_at DESC, asset_id
    `).all(required(accountId, "account_id")).map(present);
  }

  get(accountId, assetId) {
    const row = this.db.prepare(`
      SELECT asset_id, account_id, asset_type, display_name, content_type, content_blob,
             size_bytes, sha256, metadata_json, visibility, status, created_at, updated_at, deleted_at
      FROM identity_account_assets
      WHERE account_id = ? AND asset_id = ? AND status = 'active'
    `).get(required(accountId, "account_id"), required(assetId, "asset_id"));
    if (!row) throw assetError("account_asset_not_found", "Account-Asset wurde nicht gefunden.", 404);
    return { ...present(row), content_blob: row.content_blob ? Buffer.from(row.content_blob) : Buffer.alloc(0) };
  }

  delete(accountId, assetId) {
    const now = new Date().toISOString();
    const result = this.db.prepare(`
      UPDATE identity_account_assets
      SET status = 'deleted', content_blob = NULL, size_bytes = 0, sha256 = NULL,
          updated_at = ?, deleted_at = ?
      WHERE account_id = ? AND asset_id = ? AND status = 'active'
    `).run(now, now, required(accountId, "account_id"), required(assetId, "asset_id"));
    if (!result.changes) throw assetError("account_asset_not_found", "Account-Asset wurde nicht gefunden.", 404);
    return { asset_id: assetId, status: "deleted", deleted_at: now };
  }

  close() {
    this.db.close();
  }
}

function normalizeContent(input) {
  if (Buffer.isBuffer(input.content)) return input.content;
  if (!input.content_base64) return Buffer.alloc(0);
  const normalized = String(input.content_base64).replace(/\s+/g, "");
  if (
    normalized.length % 4 !== 0
    || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized)
  ) {
    throw assetError("invalid_account_asset_content", "content_base64 ist ungültig.");
  }
  const content = Buffer.from(normalized, "base64");
  if (content.toString("base64") !== normalized) {
    throw assetError("invalid_account_asset_content", "content_base64 ist ungültig.");
  }
  return content;
}

function normalizeMetadata(value) {
  if (value === undefined || value === null) return {};
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw assetError("invalid_account_asset_metadata", "metadata muss ein JSON-Objekt sein.");
  }
  return value;
}

function present(row) {
  return {
    asset_id: row.asset_id,
    account_id: row.account_id,
    asset_type: row.asset_type,
    display_name: row.display_name,
    content_type: row.content_type,
    size_bytes: row.size_bytes,
    sha256: row.sha256,
    metadata: typeof row.metadata_json === "string" ? JSON.parse(row.metadata_json) : row.metadata_json,
    visibility: row.visibility,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
    deleted_at: row.deleted_at,
  };
}

function defaultContentType(assetType) {
  return assetType === "image_style" ? "application/json" : "application/octet-stream";
}

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw assetError("required_account_asset_field", `${field} muss angegeben werden.`);
  return normalized;
}

function assetError(code, message, status = 400) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

module.exports = {
  ACCOUNT_ASSET_TYPES,
  MAX_ACCOUNT_ASSET_BYTES,
  MAX_ACCOUNT_ASSET_METADATA_BYTES,
  SqliteAccountAssetRepository,
};
