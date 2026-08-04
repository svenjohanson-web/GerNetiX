#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");
const { Pool } = require(path.join(__dirname, "..", "services", "build-deploy-server", "node_modules", "pg"));
const { ContentAddressedArtifactStore } = require(path.join(__dirname, "..", "services", "shared"));

const quarantineUntraceable = process.argv.includes("--quarantine-untraceable-artifacts");
const pool = new Pool({
  host: process.env.RUNTIME_POSTGRES_HOST || process.env.BUILD_POSTGRES_HOST || "127.0.0.1",
  port: Number(process.env.RUNTIME_POSTGRES_PORT || process.env.BUILD_POSTGRES_PORT || 5432),
  database: process.env.RUNTIME_POSTGRES_DATABASE || process.env.BUILD_POSTGRES_DATABASE || "gernetix_runtime",
  user: process.env.RUNTIME_POSTGRES_USER || process.env.BUILD_POSTGRES_USER || "gernetix_runtime",
  password: process.env.RUNTIME_POSTGRES_PASSWORD || process.env.BUILD_POSTGRES_PASSWORD || "",
  ssl: false,
});
const artifactRoot = process.env.ARTIFACT_STORE_DIR || process.env.BUILD_ARTIFACT_DIR || "/var/lib/gernetix/build/artifacts";
const store = new ContentAddressedArtifactStore(artifactRoot);

main().catch((error) => {
  process.stderr.write(`Artifact-Migration fehlgeschlagen: ${error.message}\n`);
  process.exitCode = 1;
}).finally(() => pool.end());

async function main() {
  const report = { migrated_build_artifacts: 0, quarantined_untraceable_artifacts: 0, migrated_public_demo_assets: 0, removed_duplicate_demo_firmware_blobs: 0, migrated_identity_downloads: 0, migrated_identity_account_assets: 0 };
  await ensureReferenceColumns();
  await migrateBuildArtifacts(report);
  await migratePublicDemoAssets(report);
  await migrateIdentityDownloads(report);
  await migrateIdentityAccountAssets(report);
  await dropBinaryColumns();
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
}

async function ensureReferenceColumns() {
  await pool.query(`
    ALTER TABLE IF EXISTS build_artifacts ADD COLUMN IF NOT EXISTS object_key TEXT;
    ALTER TABLE IF EXISTS build_artifacts ADD COLUMN IF NOT EXISTS object_sha256 TEXT;
    ALTER TABLE IF EXISTS build_artifacts ADD COLUMN IF NOT EXISTS source_path TEXT;
    ALTER TABLE IF EXISTS build_artifacts ADD COLUMN IF NOT EXISTS source_version TEXT;
    ALTER TABLE IF EXISTS public_demo_release_assets ADD COLUMN IF NOT EXISTS object_key TEXT;
    ALTER TABLE IF EXISTS public_demo_release_assets ADD COLUMN IF NOT EXISTS object_sha256 TEXT;
    ALTER TABLE IF EXISTS public_demo_releases ADD COLUMN IF NOT EXISTS source_path TEXT;
    ALTER TABLE IF EXISTS public_demo_releases ADD COLUMN IF NOT EXISTS source_version TEXT;
    ALTER TABLE IF EXISTS identity_platform_download_releases ADD COLUMN IF NOT EXISTS object_key TEXT;
    ALTER TABLE IF EXISTS identity_platform_download_releases ADD COLUMN IF NOT EXISTS object_sha256 TEXT;
    ALTER TABLE IF EXISTS identity_platform_download_releases ADD COLUMN IF NOT EXISTS source_path TEXT;
    ALTER TABLE IF EXISTS identity_platform_download_releases ADD COLUMN IF NOT EXISTS source_version TEXT;
    ALTER TABLE IF EXISTS identity_account_assets ADD COLUMN IF NOT EXISTS object_key TEXT;
    ALTER TABLE IF EXISTS identity_account_assets ADD COLUMN IF NOT EXISTS object_sha256 TEXT;
    ALTER TABLE IF EXISTS identity_account_assets ADD COLUMN IF NOT EXISTS source_path TEXT;
    ALTER TABLE IF EXISTS identity_account_assets ADD COLUMN IF NOT EXISTS source_version TEXT;
  `);
}

async function migrateBuildArtifacts(report) {
  if (!await columnExists("build_artifacts", "content_blob")) return;
  const items = (await pool.query(`
    SELECT b.job_id,b.artifact_name,b.content_blob,b.sha256,b.storage_encoding,
      COALESCE(j.raw_json#>>'{build_config,user_source_path}',j.raw_json#>>'{software_unit,entrypoint}','') AS source_path,
      COALESCE(j.commit_sha,j.raw_json->>'commit_sha',j.raw_json->>'package_sha256',j.raw_json->>'snapshot_sha256','') AS source_version
    FROM build_artifacts b
    LEFT JOIN project_build_jobs j ON j.raw_json->>'build_deploy_job_id'=b.job_id
    WHERE b.content_blob IS NOT NULL
    ORDER BY b.job_id,b.artifact_name
  `)).rows;
  const unresolved = items.filter((item) => !validSource(item));
  const removable = unresolved.filter((item) => /^(?:artifact-batch-benchmark-|mac-arm64-smoke-|mac-basissoftware-esp32dev-|build_job_)/.test(item.job_id));
  const blocked = unresolved.filter((item) => !removable.includes(item));
  if (blocked.length) throw new Error(`${blocked.length} Build-Artefakte besitzen keine belastbare Quellreferenz.`);
  if (removable.length && !quarantineUntraceable) {
    throw new Error(`${removable.length} nicht rückverfolgbare Test-Artefakte gefunden; erneut mit --quarantine-untraceable-artifacts ausführen.`);
  }
  for (const item of removable) {
    await quarantineLegacyArtifact(item);
    await pool.query("DELETE FROM build_artifacts WHERE job_id=$1 AND artifact_name=$2", [item.job_id, item.artifact_name]);
    report.quarantined_untraceable_artifacts += 1;
  }
  for (const item of items.filter(validSource)) {
    const content = Buffer.from(item.content_blob);
    const object = await store.put(content, item);
    await pool.query(`UPDATE build_artifacts SET object_key=$1,object_sha256=$2,source_path=$3,source_version=$4,content_blob=NULL
      WHERE job_id=$5 AND artifact_name=$6`, [object.object_key, object.sha256, object.source_path, object.source_version, item.job_id, item.artifact_name]);
    report.migrated_build_artifacts += 1;
  }
}

async function quarantineLegacyArtifact(item) {
  const content = Buffer.from(item.content_blob);
  const storedSha256 = sha256(content);
  const objectDir = path.join(artifactRoot, "legacy-quarantine", "objects", storedSha256.slice(0, 2));
  const objectPath = path.join(objectDir, storedSha256);
  await fs.mkdir(objectDir, { recursive: true, mode: 0o700 });
  try { await fs.writeFile(objectPath, content, { flag: "wx", mode: 0o600 }); }
  catch (error) { if (error.code !== "EEXIST") throw error; }
  const persisted = await fs.readFile(objectPath);
  if (sha256(persisted) !== storedSha256) throw new Error(`Quarantäneobjekt für ${item.job_id}/${item.artifact_name} ist beschädigt.`);
  const manifestDir = path.join(artifactRoot, "legacy-quarantine", "manifests");
  await fs.mkdir(manifestDir, { recursive: true, mode: 0o700 });
  const manifestId = sha256(Buffer.from(`${item.job_id}\0${item.artifact_name}`));
  await fs.writeFile(path.join(manifestDir, `${manifestId}.json`), JSON.stringify({
    schema_version: 1,
    status: "quarantined_missing_source_reference",
    original_job_id: item.job_id,
    original_artifact_name: item.artifact_name,
    logical_sha256: item.sha256,
    storage_encoding: item.storage_encoding,
    stored_sha256: storedSha256,
    stored_size_bytes: content.length,
  }, null, 2), { mode: 0o600 });
}

async function migratePublicDemoAssets(report) {
  if (await columnExists("public_demo_release_assets", "content_blob")) {
    const items = (await pool.query(`SELECT a.demo_id,a.version,a.asset_id,a.content_blob,a.sha256,
      COALESCE(r.source_path,'basissoftware/esp32') AS source_path,
      COALESCE(r.source_version,r.source_commit_sha,r.source_build_sha256,'') AS source_version
      FROM public_demo_release_assets a JOIN public_demo_releases r USING(demo_id,version) WHERE a.content_blob IS NOT NULL`)).rows;
    for (const item of items) {
      if (!validSource(item)) throw new Error(`Public-Demo ${item.demo_id}/${item.version} hat keine Quellreferenz.`);
      const content = Buffer.from(item.content_blob);
      if (sha256(content) !== item.sha256) throw new Error(`Public-Demo-Asset ${item.demo_id}/${item.version}/${item.asset_id} ist beschädigt.`);
      const object = await store.put(content, item);
      await pool.query(`UPDATE public_demo_release_assets SET object_key=$1,object_sha256=$2,content_blob=NULL
        WHERE demo_id=$3 AND version=$4 AND asset_id=$5`, [object.object_key, object.sha256, item.demo_id, item.version, item.asset_id]);
      await pool.query(`UPDATE public_demo_releases SET source_path=$1,source_version=$2 WHERE demo_id=$3 AND version=$4`,
        [object.source_path, object.source_version, item.demo_id, item.version]);
      report.migrated_public_demo_assets += 1;
    }
  }
  if (await columnExists("public_demo_releases", "firmware_blob")) {
    const rows = (await pool.query("SELECT demo_id,version,firmware_blob,firmware_sha256 FROM public_demo_releases WHERE firmware_blob IS NOT NULL")).rows;
    for (const row of rows) {
      if (sha256(Buffer.from(row.firmware_blob)) !== row.firmware_sha256) throw new Error(`Doppeltes Firmware-BLOB ${row.demo_id}/${row.version} ist beschädigt.`);
    }
    const result = await pool.query("UPDATE public_demo_releases SET firmware_blob=NULL WHERE firmware_blob IS NOT NULL");
    report.removed_duplicate_demo_firmware_blobs = Number(result.rowCount || 0);
  }
}

async function migrateIdentityDownloads(report) {
  if (!await columnExists("identity_platform_download_releases", "content_blob")) return;
  const items = (await pool.query("SELECT ctid::text AS row_id,content_blob,sha256,source_path,source_version FROM identity_platform_download_releases WHERE content_blob IS NOT NULL")).rows;
  for (const item of items) {
    if (!validSource(item)) throw new Error("Ein Plattform-Download besitzt keine Quellreferenz.");
    const content = Buffer.from(item.content_blob);
    if (sha256(content) !== item.sha256) throw new Error("Ein Plattform-Download ist beschädigt.");
    const object = await store.put(content, item);
    await pool.query("UPDATE identity_platform_download_releases SET object_key=$1,object_sha256=$2,content_blob=NULL WHERE ctid=$3::tid", [object.object_key, object.sha256, item.row_id]);
    report.migrated_identity_downloads += 1;
  }
}

async function migrateIdentityAccountAssets(report) {
  if (!await columnExists("identity_account_assets", "content_blob")) return;
  const items = (await pool.query("SELECT asset_id,content_blob,sha256,source_path,source_version FROM identity_account_assets WHERE content_blob IS NOT NULL")).rows;
  for (const item of items) {
    if (!validSource(item)) throw new Error(`Account-Asset ${item.asset_id} besitzt keine Quellreferenz.`);
    const content = Buffer.from(item.content_blob);
    if (sha256(content) !== item.sha256) throw new Error(`Account-Asset ${item.asset_id} ist beschädigt.`);
    const object = await store.put(content, item);
    await pool.query("UPDATE identity_account_assets SET object_key=$1,object_sha256=$2,content_blob=NULL WHERE asset_id=$3", [object.object_key, object.sha256, item.asset_id]);
    report.migrated_identity_account_assets += 1;
  }
}

async function dropBinaryColumns() {
  const remaining = await pool.query(`SELECT
    ${await populatedExpression("build_artifacts", "content_blob")}+
    ${await populatedExpression("public_demo_releases", "firmware_blob")}+
    ${await populatedExpression("public_demo_release_assets", "content_blob")}+
    ${await populatedExpression("identity_platform_download_releases", "content_blob")}+
    ${await populatedExpression("identity_account_assets", "content_blob")} AS count`);
  if (Number(remaining.rows[0].count) !== 0) throw new Error("PostgreSQL enthält nach der Migration noch Binärdaten.");
  await pool.query(`
    ALTER TABLE IF EXISTS build_artifacts DROP COLUMN IF EXISTS content_blob;
    ALTER TABLE IF EXISTS public_demo_releases DROP COLUMN IF EXISTS firmware_blob;
    ALTER TABLE IF EXISTS public_demo_release_assets DROP COLUMN IF EXISTS content_blob;
    ALTER TABLE IF EXISTS identity_platform_download_releases DROP COLUMN IF EXISTS content_blob;
    ALTER TABLE IF EXISTS identity_account_assets DROP COLUMN IF EXISTS content_blob;
    ALTER TABLE IF EXISTS build_artifacts ALTER COLUMN object_key SET NOT NULL;
    ALTER TABLE IF EXISTS build_artifacts ALTER COLUMN object_sha256 SET NOT NULL;
    ALTER TABLE IF EXISTS build_artifacts ALTER COLUMN source_path SET NOT NULL;
    ALTER TABLE IF EXISTS build_artifacts ALTER COLUMN source_version SET NOT NULL;
    ALTER TABLE IF EXISTS public_demo_release_assets ALTER COLUMN object_key SET NOT NULL;
    ALTER TABLE IF EXISTS public_demo_release_assets ALTER COLUMN object_sha256 SET NOT NULL;
    ALTER TABLE IF EXISTS public_demo_releases ALTER COLUMN source_path SET NOT NULL;
    ALTER TABLE IF EXISTS public_demo_releases ALTER COLUMN source_version SET NOT NULL;
    ALTER TABLE IF EXISTS identity_platform_download_releases ALTER COLUMN object_key SET NOT NULL;
    ALTER TABLE IF EXISTS identity_platform_download_releases ALTER COLUMN object_sha256 SET NOT NULL;
    ALTER TABLE IF EXISTS identity_platform_download_releases ALTER COLUMN source_path SET NOT NULL;
    ALTER TABLE IF EXISTS identity_platform_download_releases ALTER COLUMN source_version SET NOT NULL;
  `);
}

async function populatedExpression(table, column) {
  return await columnExists(table, column) ? `(SELECT COUNT(*) FROM ${table} WHERE ${column} IS NOT NULL)` : "0";
}
async function columnExists(table, column) {
  return Boolean((await pool.query("SELECT 1 FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 AND column_name=$2", [table, column])).rowCount);
}
function validSource(item) { return String(item.source_path || "").trim() && /^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(String(item.source_version || "")); }
function sha256(content) { return crypto.createHash("sha256").update(content).digest("hex"); }
