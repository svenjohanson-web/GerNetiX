#!/usr/bin/env node
"use strict";

const path = require("node:path");
const { Pool } = require(path.join(__dirname, "..", "services", "build-deploy-server", "node_modules", "pg"));

const pool = new Pool({
  host: process.env.RUNTIME_POSTGRES_HOST || process.env.BUILD_POSTGRES_HOST || process.env.IDENTITY_POSTGRES_HOST || "127.0.0.1",
  port: Number(process.env.RUNTIME_POSTGRES_PORT || process.env.BUILD_POSTGRES_PORT || process.env.IDENTITY_POSTGRES_PORT || 5432),
  database: process.env.RUNTIME_POSTGRES_DATABASE || process.env.BUILD_POSTGRES_DATABASE || process.env.IDENTITY_POSTGRES_DATABASE || "gernetix_runtime",
  user: process.env.RUNTIME_POSTGRES_USER || process.env.BUILD_POSTGRES_USER || process.env.IDENTITY_POSTGRES_USER || "gernetix_runtime",
  password: process.env.RUNTIME_POSTGRES_PASSWORD || process.env.BUILD_POSTGRES_PASSWORD || process.env.IDENTITY_POSTGRES_PASSWORD || "",
  ssl: false,
});

main().catch((error) => {
  process.stderr.write(`PostgreSQL-Binary-Audit fehlgeschlagen: ${error.message}\n`);
  process.exitCode = 1;
}).finally(() => pool.end());

async function main() {
  const byteaColumns = (await pool.query(`
    SELECT table_schema, table_name, column_name
    FROM information_schema.columns
    WHERE data_type = 'bytea'
      AND table_schema NOT IN ('pg_catalog', 'information_schema')
    ORDER BY table_schema, table_name, ordinal_position
  `)).rows;
  const findings = [];
  for (const column of byteaColumns) {
    const table = `${quote(column.table_schema)}.${quote(column.table_name)}`;
    const field = quote(column.column_name);
    const result = await pool.query(`
      SELECT COUNT(*) FILTER (WHERE ${field} IS NOT NULL)::bigint AS populated_rows,
             COALESCE(SUM(octet_length(${field})) FILTER (WHERE ${field} IS NOT NULL), 0)::bigint AS total_bytes,
             COALESCE(MAX(octet_length(${field})) FILTER (WHERE ${field} IS NOT NULL), 0)::bigint AS largest_value_bytes
      FROM ${table}
    `);
    findings.push({
      ...column,
      populated_rows: Number(result.rows[0].populated_rows),
      total_bytes: Number(result.rows[0].total_bytes),
      largest_value_bytes: Number(result.rows[0].largest_value_bytes),
    });
  }
  const largeObjects = await pool.query("SELECT COUNT(*)::bigint AS count FROM pg_largeobject_metadata");
  const referenceColumns = (await pool.query(`
    SELECT table_schema, table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      AND (table_name ILIKE '%artifact%' OR table_name ILIKE '%release%' OR table_name ILIKE '%build%')
      AND (column_name ~* '(artifact|source|commit|version|path|sha|blob|content)')
    ORDER BY table_schema, table_name, ordinal_position
  `)).rows;
  const buildJobColumns = (await pool.query(`
    SELECT table_schema, table_name, column_name, data_type, is_nullable
    FROM information_schema.columns
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      AND table_name IN ('build_jobs', 'project_build_jobs')
    ORDER BY table_schema, table_name, ordinal_position
  `)).rows;
  const buildSourceCoverage = (await pool.query(`
    SELECT COUNT(DISTINCT artifacts.job_id)::bigint AS artifact_jobs,
           COUNT(DISTINCT jobs.build_job_id)::bigint AS matching_project_jobs,
           COUNT(DISTINCT jobs.build_job_id) FILTER (
             WHERE COALESCE(jobs.commit_sha, jobs.raw_json->>'commit_sha', jobs.raw_json->>'snapshot_sha256', '') <> ''
           )::bigint AS jobs_with_source_version,
           COUNT(DISTINCT jobs.build_job_id) FILTER (
             WHERE COALESCE(jobs.raw_json#>>'{build_config,user_source_path}', jobs.raw_json#>>'{software_unit,entrypoint}', '') <> ''
           )::bigint AS jobs_with_source_path
    FROM build_artifacts AS artifacts
    LEFT JOIN project_build_jobs AS jobs ON jobs.raw_json->>'build_deploy_job_id' = artifacts.job_id
  `)).rows[0];
  const projectBuildJsonKeys = (await pool.query(`
    SELECT key, COUNT(*)::bigint AS row_count
    FROM project_build_jobs, LATERAL jsonb_object_keys(raw_json) AS key
    GROUP BY key ORDER BY key
  `)).rows.map((row) => ({ key: row.key, row_count: Number(row.row_count) }));
  const unmatchedBuildArtifactJobs = (await pool.query(`
    SELECT artifacts.job_id,
           COUNT(*)::bigint AS artifact_count,
           SUM(artifacts.size_bytes)::bigint AS total_bytes,
           MIN(artifacts.created_at)::text AS first_created_at,
           ARRAY_AGG(artifacts.artifact_name ORDER BY artifacts.artifact_name) AS artifact_names
    FROM build_artifacts AS artifacts
    WHERE NOT EXISTS (
      SELECT 1 FROM project_build_jobs AS jobs
      WHERE jobs.raw_json->>'build_deploy_job_id' = artifacts.job_id
    )
    GROUP BY artifacts.job_id
    ORDER BY artifacts.job_id
  `)).rows.map((row) => ({
    ...row,
    artifact_count: Number(row.artifact_count),
    total_bytes: Number(row.total_bytes),
  }));
  const sourceReferenceViolations = (await pool.query(`
    SELECT 'build_artifacts' AS table_name, COUNT(*)::bigint AS violation_count
    FROM build_artifacts
    WHERE object_key IS NULL OR object_sha256 IS NULL OR BTRIM(source_path) = ''
       OR source_version !~* '^(?:[a-f0-9]{40}|[a-f0-9]{64})$'
    UNION ALL
    SELECT 'public_demo_release_assets', COUNT(*)::bigint
    FROM public_demo_release_assets AS assets
    JOIN public_demo_releases AS releases USING (demo_id, version)
    WHERE assets.object_key IS NULL OR assets.object_sha256 IS NULL OR BTRIM(releases.source_path) = ''
       OR releases.source_version !~* '^(?:[a-f0-9]{40}|[a-f0-9]{64})$'
    UNION ALL
    SELECT 'identity_platform_download_releases', COUNT(*)::bigint
    FROM identity_platform_download_releases
    WHERE object_key IS NULL OR object_sha256 IS NULL OR BTRIM(source_path) = ''
       OR source_version !~* '^(?:[a-f0-9]{40}|[a-f0-9]{64})$'
    UNION ALL
    SELECT 'identity_account_assets', COUNT(*)::bigint
    FROM identity_account_assets
    WHERE object_key IS NULL OR object_sha256 IS NULL OR BTRIM(source_path) = ''
       OR source_version !~* '^(?:[a-f0-9]{40}|[a-f0-9]{64})$'
  `)).rows.map((row) => ({ table_name: row.table_name, violation_count: Number(row.violation_count) }));
  const summary = {
    bytea_column_count: findings.length,
    populated_bytea_column_count: findings.filter((item) => item.populated_rows > 0).length,
    populated_bytea_rows: findings.reduce((total, item) => total + item.populated_rows, 0),
    total_bytea_bytes: findings.reduce((total, item) => total + item.total_bytes, 0),
    postgres_large_object_count: Number(largeObjects.rows[0].count),
  };
  process.stdout.write(`${JSON.stringify({
    summary,
    findings,
    reference_columns: referenceColumns,
    build_job_columns: buildJobColumns,
    build_source_coverage: Object.fromEntries(Object.entries(buildSourceCoverage).map(([key, value]) => [key, Number(value)])),
    project_build_json_keys: projectBuildJsonKeys,
    unmatched_build_artifact_jobs: unmatchedBuildArtifactJobs,
    source_reference_violations: sourceReferenceViolations,
  }, null, 2)}\n`);
  if (summary.bytea_column_count > 0 || summary.postgres_large_object_count > 0
    || sourceReferenceViolations.some((item) => item.violation_count > 0)) process.exitCode = 2;
}

function quote(identifier) {
  return `"${String(identifier).replaceAll('"', '""')}"`;
}
