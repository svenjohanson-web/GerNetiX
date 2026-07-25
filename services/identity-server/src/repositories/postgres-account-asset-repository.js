"use strict";

const crypto = require("node:crypto");
const {
  ACCOUNT_ASSET_TYPES,
  MAX_ACCOUNT_ASSET_BYTES,
  MAX_ACCOUNT_ASSET_METADATA_BYTES,
} = require("./sqlite-account-asset-repository");

class PostgresAccountAssetRepository {
  static async create(options = {}) {
    const { Pool } = require("pg");
    const repository = new PostgresAccountAssetRepository(options.pool || new Pool(options.poolOptions));
    await repository.migrate();
    return repository;
  }

  constructor(pool) {
    this.pool = pool;
  }

  async migrate() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS identity_account_assets (
        asset_id TEXT PRIMARY KEY,
        account_id TEXT NOT NULL,
        asset_type TEXT NOT NULL,
        display_name TEXT NOT NULL,
        content_type TEXT NOT NULL,
        content_blob BYTEA,
        size_bytes BIGINT NOT NULL,
        sha256 TEXT,
        metadata_json JSONB NOT NULL,
        visibility TEXT NOT NULL CHECK (visibility = 'owner_only'),
        status TEXT NOT NULL CHECK (status IN ('active', 'deleted')),
        created_at TIMESTAMPTZ NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL,
        deleted_at TIMESTAMPTZ
      );
      CREATE INDEX IF NOT EXISTS idx_identity_account_assets_owner
        ON identity_account_assets(account_id, status, updated_at DESC);
    `);
  }

  async create(accountId, input = {}) {
    const owner = required(accountId, "account_id");
    const assetType = required(input.asset_type, "asset_type");
    if (!ACCOUNT_ASSET_TYPES.has(assetType)) throw assetError("invalid_account_asset_type", "asset_type ist ungültig.");
    if (input.visibility && input.visibility !== "owner_only") throw assetError("invalid_account_asset_visibility", "Account-Assets sind immer owner_only.");
    const content = normalizeContent(input);
    if (content.length > MAX_ACCOUNT_ASSET_BYTES) throw assetError("account_asset_too_large", "Account-Asset ist größer als 16 MiB.");
    const displayName = required(input.display_name, "display_name");
    const contentType = required(input.content_type || defaultContentType(assetType), "content_type");
    const metadata = normalizeMetadata(input.metadata);
    if (Buffer.byteLength(JSON.stringify(metadata), "utf8") > MAX_ACCOUNT_ASSET_METADATA_BYTES) {
      throw assetError("account_asset_metadata_too_large", "Account-Asset-Metadaten sind größer als 64 KiB.");
    }
    const now = new Date().toISOString();
    const asset = {
      asset_id: `account_asset_${crypto.randomUUID()}`,
      account_id: owner,
      asset_type: assetType,
      display_name: displayName,
      content_type: contentType,
      content_blob: content.length ? content : null,
      size_bytes: content.length,
      sha256: content.length ? crypto.createHash("sha256").update(content).digest("hex") : null,
      metadata_json: metadata,
      visibility: "owner_only",
      status: "active",
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };
    await this.pool.query(`
      INSERT INTO identity_account_assets (
        asset_id, account_id, asset_type, display_name, content_type, content_blob,
        size_bytes, sha256, metadata_json, visibility, status, created_at, updated_at, deleted_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)
    `, [
      asset.asset_id, asset.account_id, asset.asset_type, asset.display_name, asset.content_type,
      asset.content_blob, asset.size_bytes, asset.sha256, asset.metadata_json, asset.visibility,
      asset.status, asset.created_at, asset.updated_at, asset.deleted_at,
    ]);
    return present(asset);
  }

  async list(accountId) {
    const result = await this.pool.query(`
      SELECT asset_id, account_id, asset_type, display_name, content_type, size_bytes::bigint AS size_bytes,
             sha256, metadata_json, visibility, status, created_at::text AS created_at,
             updated_at::text AS updated_at, deleted_at::text AS deleted_at
      FROM identity_account_assets WHERE account_id=$1 AND status='active'
      ORDER BY updated_at DESC, asset_id
    `, [required(accountId, "account_id")]);
    return result.rows.map(present);
  }

  async get(accountId, assetId) {
    const result = await this.pool.query(`
      SELECT asset_id, account_id, asset_type, display_name, content_type, content_blob,
             size_bytes::bigint AS size_bytes, sha256, metadata_json, visibility, status,
             created_at::text AS created_at, updated_at::text AS updated_at, deleted_at::text AS deleted_at
      FROM identity_account_assets WHERE account_id=$1 AND asset_id=$2 AND status='active'
    `, [required(accountId, "account_id"), required(assetId, "asset_id")]);
    if (!result.rows[0]) throw assetError("account_asset_not_found", "Account-Asset wurde nicht gefunden.", 404);
    return { ...present(result.rows[0]), content_blob: result.rows[0].content_blob ? Buffer.from(result.rows[0].content_blob) : Buffer.alloc(0) };
  }

  async delete(accountId, assetId) {
    const now = new Date().toISOString();
    const result = await this.pool.query(`
      UPDATE identity_account_assets
      SET status='deleted', content_blob=NULL, size_bytes=0, sha256=NULL, updated_at=$1, deleted_at=$1
      WHERE account_id=$2 AND asset_id=$3 AND status='active'
    `, [now, required(accountId, "account_id"), required(assetId, "asset_id")]);
    if (!result.rowCount) throw assetError("account_asset_not_found", "Account-Asset wurde nicht gefunden.", 404);
    return { asset_id: assetId, status: "deleted", deleted_at: now };
  }

  async close() {
    await this.pool.end();
  }
}

function normalizeContent(input) {
  if (Buffer.isBuffer(input.content)) return input.content;
  if (!input.content_base64) return Buffer.alloc(0);
  const normalized = String(input.content_base64).replace(/\s+/g, "");
  if (normalized.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(normalized)) {
    throw assetError("invalid_account_asset_content", "content_base64 ist ungültig.");
  }
  const content = Buffer.from(normalized, "base64");
  if (content.toString("base64") !== normalized) throw assetError("invalid_account_asset_content", "content_base64 ist ungültig.");
  return content;
}

function normalizeMetadata(value) {
  if (value === undefined || value === null) return {};
  if (!value || Array.isArray(value) || typeof value !== "object") throw assetError("invalid_account_asset_metadata", "metadata muss ein JSON-Objekt sein.");
  return value;
}

function present(row) {
  return {
    asset_id: row.asset_id,
    account_id: row.account_id,
    asset_type: row.asset_type,
    display_name: row.display_name,
    content_type: row.content_type,
    size_bytes: Number(row.size_bytes),
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

module.exports = { PostgresAccountAssetRepository };
