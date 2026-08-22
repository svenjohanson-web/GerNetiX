#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");

const FORBIDDEN_KEYS = new Set(["sources", "source_snapshot", "project_snapshot"]);

function parseArgs(argv) {
  const options = { mode: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--plan" || argument === "--apply") {
      if (options.mode) throw new Error("Genau einer der Modi --plan oder --apply ist erlaubt.");
      options.mode = argument.slice(2);
      continue;
    }
    if (["--confirm-fingerprint", "--backup-reference", "--backup-sha256"].includes(argument)) {
      const value = argv[index + 1];
      if (!value) throw new Error(`${argument} benoetigt einen Wert.`);
      options[argument.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase())] = value;
      index += 1;
      continue;
    }
    throw new Error(`Unbekanntes Argument: ${argument}`);
  }
  if (!options.mode) throw new Error("Der Modus --plan oder --apply fehlt.");
  if (options.mode === "apply" && !/^[a-f0-9]{64}$/.test(options.confirmFingerprint || "")) {
    throw new Error("--confirm-fingerprint muss der 64-stellige SHA-256 des aktuellen Plans sein.");
  }
  return options;
}

function hasForbiddenContent(value) {
  if (Array.isArray(value)) return value.some(hasForbiddenContent);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, entry]) => FORBIDDEN_KEYS.has(key) || hasForbiddenContent(entry));
}

function sanitizeProjectContent(value) {
  if (Array.isArray(value)) return value.map(sanitizeProjectContent);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !FORBIDDEN_KEYS.has(key))
    .map(([key, entry]) => [key, sanitizeProjectContent(entry)]));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

async function tableExists(client, tableName) {
  const result = await client.query("SELECT to_regclass($1) IS NOT NULL AS present", [`public.${tableName}`]);
  return result.rows[0].present === true;
}

async function collectInventory(client) {
  const sourcesTablePresent = await tableExists(client, "project_sources");
  const sources = sourcesTablePresent
    ? (await client.query("SELECT project_id, path, raw_json FROM project_sources ORDER BY project_id, path")).rows
    : [];
  const projects = (await client.query(`
    SELECT project_id, repository_provider, repository_state, repository_id, head_sha, raw_json
    FROM project_projects ORDER BY project_id
  `)).rows;
  const versions = (await client.query(
    "SELECT version_id, project_id, raw_json FROM project_versions ORDER BY version_id",
  )).rows;
  const buildJobs = (await client.query(
    "SELECT build_job_id, project_id, raw_json FROM project_build_jobs ORDER BY build_job_id",
  )).rows;
  const projectContent = projects.filter((row) => hasForbiddenContent(row.raw_json));
  const versionContent = versions.filter((row) => hasForbiddenContent(row.raw_json));
  const buildJobContent = buildJobs.filter((row) => hasForbiddenContent(row.raw_json));
  const affectedProjectIds = new Set([
    ...sources.map((row) => row.project_id),
    ...projectContent.map((row) => row.project_id),
    ...versionContent.map((row) => row.project_id),
    ...buildJobContent.map((row) => row.project_id),
  ]);
  const projectById = new Map(projects.map((row) => [row.project_id, row]));
  const unboundProjects = [...affectedProjectIds].filter((projectId) => {
    const project = projectById.get(projectId);
    return !project
      || project.repository_provider !== "forgejo"
      || project.repository_state !== "active"
      || !project.repository_id
      || !project.head_sha;
  });
  const fingerprintRecords = [
    ...sources.map((row) => ["source", row.project_id, row.path, sha256(stableStringify(row.raw_json))]),
    ...projectContent.map((row) => ["project", row.project_id, sha256(stableStringify(row.raw_json))]),
    ...versionContent.map((row) => ["version", row.project_id, row.version_id, sha256(stableStringify(row.raw_json))]),
    ...buildJobContent.map((row) => ["build", row.project_id, row.build_job_id, sha256(stableStringify(row.raw_json))]),
  ];
  const fingerprint = sha256(stableStringify({ sourcesTablePresent, fingerprintRecords }));
  return {
    sourcesTablePresent,
    sources,
    projectContent,
    versionContent,
    buildJobContent,
    unboundProjects,
    fingerprint,
    summary: {
      source_table_present: sourcesTablePresent,
      source_rows: sources.length,
      source_projects: new Set(sources.map((row) => row.project_id)).size,
      project_documents_with_content: projectContent.length,
      version_documents_with_content: versionContent.length,
      build_job_documents_with_content: buildJobContent.length,
      affected_projects: affectedProjectIds.size,
      unbound_affected_projects: unboundProjects.length,
      fingerprint,
      apply_allowed: unboundProjects.length === 0,
    },
  };
}

function assertBackupEvidence(options, inventory) {
  const destructiveRows = inventory.sources.length
    + inventory.projectContent.length
    + inventory.versionContent.length
    + inventory.buildJobContent.length;
  if (!destructiveRows) return;
  if (!/^[A-Za-z0-9][A-Za-z0-9._:/-]{5,255}$/.test(options.backupReference || "")) {
    throw new Error("Ein konkreter --backup-reference fuer den geprueften PostgreSQL-Sicherungspunkt fehlt.");
  }
  if (!/^[a-f0-9]{64}$/.test(options.backupSha256 || "")) {
    throw new Error("--backup-sha256 muss die 64-stellige Pruefsumme des Sicherungspunkts sein.");
  }
}

async function applyRetirement(pool, options) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(714011)");
    await client.query("LOCK TABLE project_projects, project_versions, project_build_jobs IN ACCESS EXCLUSIVE MODE");
    if (await tableExists(client, "project_sources")) {
      await client.query("LOCK TABLE project_sources IN ACCESS EXCLUSIVE MODE");
    }
    const inventory = await collectInventory(client);
    if (inventory.fingerprint !== options.confirmFingerprint) throw new Error("PROJECT_SQL_RETIREMENT_PLAN_CHANGED");
    if (inventory.unboundProjects.length) throw new Error("PROJECT_SQL_RETIREMENT_UNBOUND_PROJECTS");
    assertBackupEvidence(options, inventory);

    for (const row of inventory.projectContent) {
      await client.query("UPDATE project_projects SET raw_json=$2 WHERE project_id=$1", [
        row.project_id, sanitizeProjectContent(row.raw_json),
      ]);
    }
    for (const row of inventory.versionContent) {
      await client.query("UPDATE project_versions SET raw_json=$2 WHERE version_id=$1", [
        row.version_id, sanitizeProjectContent(row.raw_json),
      ]);
    }
    for (const row of inventory.buildJobContent) {
      await client.query("UPDATE project_build_jobs SET raw_json=$2 WHERE build_job_id=$1", [
        row.build_job_id, sanitizeProjectContent(row.raw_json),
      ]);
    }
    if (inventory.sourcesTablePresent) await client.query("DROP TABLE project_sources");
    await client.query("DROP FUNCTION IF EXISTS gernetix_reject_project_source_write()");
    await client.query("COMMIT");
    return {
      applied: true,
      removed_source_rows: inventory.sources.length,
      sanitized_project_documents: inventory.projectContent.length,
      sanitized_version_documents: inventory.versionContent.length,
      sanitized_build_job_documents: inventory.buildJobContent.length,
      source_table_present: false,
      fingerprint: inventory.fingerprint,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function run(argv = process.argv.slice(2), environment = process.env) {
  const options = parseArgs(argv);
  const { Pool } = require("pg");
  const pool = new Pool({
    connectionString: environment.PROJECT_POSTGRES_URL || undefined,
    host: environment.PROJECT_POSTGRES_HOST || "127.0.0.1",
    port: Number(environment.PROJECT_POSTGRES_PORT || 5432),
    database: environment.PROJECT_POSTGRES_DATABASE || "gernetix_runtime",
    user: environment.PROJECT_POSTGRES_USER || "gernetix_runtime",
    password: environment.PROJECT_POSTGRES_PASSWORD || "",
    ssl: false,
  });
  try {
    if (options.mode === "plan") return (await collectInventory(pool)).summary;
    return await applyRetirement(pool, options);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  run().then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`)).catch((error) => {
    process.stderr.write(`FG-11-Abbruch: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  applyRetirement,
  collectInventory,
  hasForbiddenContent,
  parseArgs,
  sanitizeProjectContent,
  stableStringify,
};
