const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const PROJECT_TABLES = [
  "project_server_projects", "project_server_sources", "project_server_build_jobs",
  "project_server_artifacts", "project_server_feedback", "project_server_consents",
  "project_server_resource_policies",
];
const TELEMETRY_TABLES = ["telemetry_measurements", "telemetry_events", "telemetry_retention_policies"];

function migrateRuntimeStorage({ sourcePath, projectPath, telemetryPath, dryRun = false }) {
  if (!sourcePath || !projectPath || !telemetryPath) throw new Error("source_project_and_telemetry_paths_required");
  if (!fs.existsSync(sourcePath)) throw new Error(`source_database_not_found:${sourcePath}`);
  const source = new DatabaseSync(sourcePath, { readOnly: true });
  try {
    return {
      project: migrateTables(source, projectPath, PROJECT_TABLES, "project-storage-v1", dryRun),
      telemetry: migrateTables(source, telemetryPath, TELEMETRY_TABLES, "telemetry-storage-v1", dryRun),
    };
  } finally {
    source.close();
  }
}

function migrateTables(source, targetPath, tables, migrationId, dryRun) {
  const existing = tables.filter((table) => tableExists(source, table));
  const counts = Object.fromEntries(existing.map((table) => [table, countRows(source, table)]));
  if (dryRun) return { target_path: targetPath, migrated: false, dry_run: true, tables: counts };
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const target = new DatabaseSync(targetPath);
  try {
    target.exec("PRAGMA foreign_keys = ON; PRAGMA journal_mode = WAL;");
    target.exec("CREATE TABLE IF NOT EXISTS runtime_storage_migrations (migration_id TEXT PRIMARY KEY, source_path TEXT NOT NULL, migrated_at TEXT NOT NULL, tables_json TEXT NOT NULL)");
    if (target.prepare("SELECT 1 FROM runtime_storage_migrations WHERE migration_id = ?").get(migrationId)) {
      return { target_path: targetPath, migrated: false, already_migrated: true, tables: counts };
    }
    if (existing.some((table) => tableExists(target, table) && countRows(target, table) > 0)) throw new Error(`target_storage_not_empty:${targetPath}`);
    target.exec("BEGIN IMMEDIATE");
    try {
      for (const table of existing) copyTable(source, target, table);
      target.prepare("INSERT INTO runtime_storage_migrations (migration_id, source_path, migrated_at, tables_json) VALUES (?, ?, ?, ?)")
        .run(migrationId, sourcePath(source), new Date().toISOString(), JSON.stringify(counts));
      target.exec("COMMIT");
    } catch (error) {
      target.exec("ROLLBACK");
      throw error;
    }
    return { target_path: targetPath, migrated: true, tables: counts };
  } finally {
    target.close();
  }
}

function copyTable(source, target, table) {
  const schema = source.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)?.sql;
  if (!schema) return;
  target.exec(schema);
  const columns = source.prepare(`PRAGMA table_info(${identifier(table)})`).all().map((column) => column.name);
  const placeholders = columns.map(() => "?").join(", ");
  const insert = target.prepare(`INSERT INTO ${identifier(table)} (${columns.map(identifier).join(", ")}) VALUES (${placeholders})`);
  for (const row of source.prepare(`SELECT * FROM ${identifier(table)}`).all()) insert.run(...columns.map((column) => row[column]));
  for (const index of source.prepare("SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = ? AND sql IS NOT NULL").all(table)) target.exec(index.sql);
}

function tableExists(db, table) { return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table)); }
function countRows(db, table) { return db.prepare(`SELECT COUNT(*) AS count FROM ${identifier(table)}`).get().count; }
function identifier(value) { if (!/^[A-Za-z0-9_]+$/.test(value)) throw new Error("invalid_identifier"); return `"${value}"`; }
function sourcePath(db) { return db.prepare("PRAGMA database_list").all().find((item) => item.name === "main")?.file || "unknown"; }

function cli() {
  const args = process.argv.slice(2);
  const option = (name) => args[args.indexOf(name) + 1] || "";
  const result = migrateRuntimeStorage({ sourcePath: option("--source"), projectPath: option("--projects"), telemetryPath: option("--telemetry"), dryRun: args.includes("--dry-run") });
  console.log(JSON.stringify(result, null, 2));
}

if (require.main === module) cli();
module.exports = { PROJECT_TABLES, TELEMETRY_TABLES, migrateRuntimeStorage };
