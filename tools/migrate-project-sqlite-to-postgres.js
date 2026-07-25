#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");
const { PostgresProjectRepository } = require("../services/project-server/src/repositories/postgres-project-repository");

const TABLES = {
  project_server_projects: "projects",
  project_server_sources: "sources",
  project_server_build_jobs: "buildJobs",
  project_server_artifacts: "artifacts",
  project_server_feedback: "feedback",
  project_server_consents: "consents",
  project_server_resource_policies: "resourcePolicies",
};

const COLLECTIONS = {
  projects: "projects",
  sources: "sources",
  build_jobs: "buildJobs",
  artifacts: "artifacts",
  feedback: "feedback",
  consents: "consents",
  resourcePolicies: "resourcePolicies",
};

function emptyState() {
  return Object.fromEntries(Object.values(TABLES).map((key) => [key, []]));
}

function readLegacyProjectState(sqlitePath) {
  const state = emptyState();
  if (!sqlitePath || !fs.existsSync(sqlitePath)) return state;
  const db = new DatabaseSync(sqlitePath, { readOnly: true });
  try {
    const typedTables = Object.keys(TABLES).filter((table) => tableExists(db, table));
    if (typedTables.length) {
      for (const table of typedTables) {
        state[TABLES[table]] = db.prepare(
          `SELECT raw_json FROM ${table} ORDER BY rowid`,
        ).all().map((row) => JSON.parse(row.raw_json));
      }
      return state;
    }
    if (!tableExists(db, "service_documents")) return state;
    const rows = db.prepare(`
      SELECT collection_name, document_json
      FROM service_documents
      WHERE service_key='project-server'
      ORDER BY collection_name, document_id
    `).all();
    for (const row of rows) {
      const target = COLLECTIONS[row.collection_name];
      if (target) state[target].push(JSON.parse(row.document_json));
    }
    return state;
  } finally {
    db.close();
  }
}

function hasProjectState(state) {
  return [
    state.projects,
    state.sources,
    state.buildJobs,
    state.artifacts,
    state.feedback,
    state.consents,
  ].some((items) => Array.isArray(items) && items.length > 0);
}

function readLegacyProjectStateWithFallback(primaryPath, fallbackPath) {
  const primaryState = readLegacyProjectState(primaryPath);
  if (hasProjectState(primaryState) || !fallbackPath || !fs.existsSync(fallbackPath)) {
    return primaryState;
  }
  return readLegacyProjectState(fallbackPath);
}

function tableExists(db, table) {
  return Boolean(db.prepare(
    "SELECT 1 FROM sqlite_master WHERE type='table' AND name=?",
  ).get(table));
}

async function main() {
  const sqlitePath = process.env.PROJECT_SERVER_SQLITE_PATH
    || "/var/lib/gernetix/projects/gernetix-projects.sqlite";
  const repository = await PostgresProjectRepository.create({
    poolOptions: {
      connectionString: process.env.PROJECT_POSTGRES_URL || undefined,
      host: process.env.PROJECT_POSTGRES_HOST || "project-postgres",
      port: Number(process.env.PROJECT_POSTGRES_PORT || 5432),
      database: process.env.PROJECT_POSTGRES_DATABASE || "gernetix_runtime",
      user: process.env.PROJECT_POSTGRES_USER || "gernetix_runtime",
      password: requiredSecret(process.env.PROJECT_POSTGRES_PASSWORD),
    },
  });
  try {
    const fallbackPath = process.env.PROJECT_LEGACY_SHARED_SQLITE_PATH || "";
    const primaryState = readLegacyProjectState(sqlitePath);
    const usePrimary = hasProjectState(primaryState) || !fallbackPath || !fs.existsSync(fallbackPath);
    const sourcePath = usePrimary ? sqlitePath : fallbackPath;
    const state = usePrimary ? primaryState : readLegacyProjectState(fallbackPath);
    const result = await repository.importLegacyState(state);
    process.stdout.write(`${JSON.stringify({ sqlite_path: sourcePath, ...result })}\n`);
  } finally {
    await repository.close();
  }
}

function requiredSecret(value) {
  if (!String(value || "").trim()) throw new Error("PROJECT_POSTGRES_PASSWORD fehlt.");
  return value;
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Project-Migration fehlgeschlagen: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  COLLECTIONS,
  TABLES,
  hasProjectState,
  readLegacyProjectState,
  readLegacyProjectStateWithFallback,
  requiredSecret,
};
