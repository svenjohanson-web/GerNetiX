"use strict";

const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");
const { PostgresPlatformDownloadRepository } = require("../services/identity-server/src/repositories/postgres-platform-download-repository");
const { PostgresAccountAssetRepository } = require("../services/identity-server/src/repositories/postgres-account-asset-repository");
const { PostgresPublicDemoRepository } = require("../services/public-demo-server/src/repositories/postgres-public-demo-repository");
const { PostgresAdminAccessRepository } = require("../services/admin-access-server/src/postgres-admin-access-repository");
const { PostgresArtifactStore } = require("../services/build-deploy-server/src/modules/postgres-artifact-store");
const { PostgresOtaAcknowledgementStore } = require("../services/build-deploy-server/src/modules/ota-security");
const { PostgresStateStore } = require("../services/shared/persistence/postgres-state-store");

async function migrateRuntimeSqliteToPostgres(options = {}) {
  const downloads = await PostgresPlatformDownloadRepository.create({ poolOptions: options.poolOptions });
  const pool = downloads.pool;
  await new PostgresAccountAssetRepository(pool).migrate();
  await new PostgresPublicDemoRepository(pool).migrate();
  await new PostgresAdminAccessRepository(pool).migrate();
  await new PostgresArtifactStore(pool).migrate();
  await PostgresOtaAcknowledgementStore.create(pool);
  await new PostgresStateStore(pool, "runtime-migration-bootstrap", {}).initialize();
  const counts = {};
  try {
    counts.identity = await importIdentityAuxiliary(pool, options.identitySqlitePath);
    counts.downloads = await copySqliteTable(pool, options.platformDownloadSqlitePath, "identity_platform_download_releases",
      ["download_id","version","platform","architecture","label","detail","file_name","content_type","content_blob","size_bytes","sha256","visibility","status","created_at","published_at"]);
    counts.assets = await copySqliteTable(pool, options.accountAssetSqlitePath, "identity_account_assets",
      ["asset_id","account_id","asset_type","display_name","content_type","content_blob","size_bytes","sha256","metadata_json","visibility","status","created_at","updated_at","deleted_at"],
      { metadata_json: parseJson });
    counts.adminAccessUsers = await copySqliteTable(pool, options.adminAccessSqlitePath, "admin_access_users",
      ["admin_id","username","password_hash","password_salt","role","enabled","created_at","last_login_at"], { enabled: Boolean });
    counts.adminAccessSessions = await copySqliteTable(pool, options.adminAccessSqlitePath, "admin_access_sessions",
      ["session_id","admin_id","token_hash","expires_at","created_at","revoked_at"]);
    counts.adminAccessAudit = await copySqliteTable(pool, options.adminAccessSqlitePath, "admin_access_audit_events",
      ["audit_id","occurred_at","admin_id","event_type","detail"]);
    counts.publicDemoCatalog = await copySqliteTable(pool, options.publicDemoSqlitePath, "public_demo_catalog",
      ["demo_id","title","description","board_hardware_item_id","category","games_json","status","usb_flash_only","ota_supported","created_at","updated_at","published_at"],
      { games_json: parseJson, usb_flash_only: Boolean, ota_supported: Boolean });
    counts.publicDemoReleases = await copySqliteTable(pool, options.publicDemoSqlitePath, "public_demo_releases",
      ["demo_id","version","firmware_file_name","firmware_blob","firmware_size_bytes","firmware_sha256","source_build_sha256","created_at"]);
    counts.publicDemoAssets = await copySqliteTable(pool, options.publicDemoSqlitePath, "public_demo_release_assets",
      ["demo_id","version","asset_id","file_name","flash_offset","content_blob","size_bytes","sha256"]);
    counts.buildArtifacts = await copySqliteTable(pool, options.buildSqlitePath, "build_artifacts",
      ["job_id","artifact_name","content_type","content_blob","size_bytes","sha256","esp_image_sha256","created_at"]);
    counts.otaAcknowledgements = await copySqliteTable(pool, options.buildSqlitePath, "build_deploy_ota_acknowledgements",
      ["deploy_id","device_id","status","published_at","acknowledged_at","detail_json"], { detail_json: parseJson });
    if (options.llmConfigPath && fs.existsSync(options.llmConfigPath)) {
      const store = new PostgresStateStore(pool, "llm-routing-config", { config: null }, { encryptionKey: options.encryptionKey });
      await store.initialize();
      if (!store.load().config) await store.save({ config: JSON.parse(fs.readFileSync(options.llmConfigPath, "utf8")) });
      counts.llmConfig = 1;
    } else counts.llmConfig = 0;
    return counts;
  } finally {
    await pool.end();
  }
}

async function importIdentityAuxiliary(pool, sqlitePath) {
  if (!sqlitePath || !fs.existsSync(sqlitePath)) return 0;
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    if (!tableExists(db, "service_documents")) return 0;
    let count = 0;
    for (const [serviceKey, namespace, defaults] of [
      ["identity-web-push", "identity-web-push", { subscriptions: [] }],
      ["identity-email-config", "identity-email-config", { config: null }],
    ]) {
      const state = readServiceState(db, serviceKey, defaults);
      const result = await pool.query(`
        INSERT INTO runtime_state_documents(namespace,state_json,updated_at) VALUES ($1,$2,NOW())
        ON CONFLICT(namespace) DO NOTHING
      `, [namespace, state]);
      count += result.rowCount;
    }
    return count;
  } finally { db.close(); }
}

async function copySqliteTable(pool, sqlitePath, table, columns, transforms = {}) {
  if (!sqlitePath || !fs.existsSync(sqlitePath)) return 0;
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    if (!tableExists(db, table)) return 0;
    const rows = db.prepare(`SELECT ${columns.join(",")} FROM ${table}`).all();
    let count = 0;
    for (const row of rows) {
      const values = columns.map((column) => transforms[column] ? transforms[column](row[column]) : row[column]);
      const result = await pool.query(`
        INSERT INTO ${table} (${columns.join(",")})
        VALUES (${columns.map((_, index) => `$${index + 1}`).join(",")})
        ON CONFLICT DO NOTHING
      `, values);
      count += result.rowCount;
    }
    return count;
  } finally { db.close(); }
}

function readServiceState(db, serviceKey, defaults) {
  const state = structuredClone(defaults);
  const rows = db.prepare("SELECT collection_name,document_json FROM service_documents WHERE service_key=? ORDER BY document_id").all(serviceKey);
  for (const [key, fallback] of Object.entries(defaults)) {
    const documents = rows.filter((row) => row.collection_name === key).map((row) => parseJson(row.document_json));
    if (documents.length) state[key] = Array.isArray(fallback) ? documents : documents[0].value;
  }
  return state;
}
function tableExists(db, table){return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table));}
function parseJson(value){return typeof value==="string"?JSON.parse(value):value;}

if (require.main === module) {
  migrateRuntimeSqliteToPostgres({
    poolOptions: {
      host: process.env.RUNTIME_POSTGRES_HOST || "runtime-postgres",
      port: Number(process.env.RUNTIME_POSTGRES_PORT || 5432),
      database: process.env.RUNTIME_POSTGRES_DATABASE || "gernetix_runtime",
      user: process.env.RUNTIME_POSTGRES_USER || "gernetix_runtime",
      password: process.env.RUNTIME_POSTGRES_PASSWORD || "",
    },
    identitySqlitePath: process.env.IDENTITY_SQLITE_PATH,
    platformDownloadSqlitePath: process.env.PLATFORM_DOWNLOAD_SQLITE_PATH,
    accountAssetSqlitePath: process.env.ACCOUNT_ASSET_SQLITE_PATH,
    adminAccessSqlitePath: process.env.ADMIN_ACCESS_SQLITE_PATH,
    publicDemoSqlitePath: process.env.PUBLIC_DEMO_SQLITE_PATH,
    buildSqlitePath: process.env.BUILD_ARTIFACT_SQLITE_PATH,
    llmConfigPath: process.env.LLM_CONFIG_PATH,
    encryptionKey: process.env.RUNTIME_STATE_ENCRYPTION_KEY || "",
  }).then((counts) => console.log(JSON.stringify({ migrated: counts }))).catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}

module.exports = { copySqliteTable, migrateRuntimeSqliteToPostgres, readServiceState };
