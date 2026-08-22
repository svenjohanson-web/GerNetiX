#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { projectConfigurationSources } = require("../services/project-server/src/modules/project-configuration-projection");
const { normalizeRepositoryPath } = require("../services/project-server/src/repository-store/git-project-repository-store");

const REPORT_SCHEMA_VERSION = "gernetix.forgejo-migration-dry-run/v1";
const MAX_REPOSITORY_FILE_BYTES = 1024 * 1024;
const SQLITE_TABLES = Object.freeze({
  project_server_projects: "projects",
  project_server_sources: "sources",
  project_server_versions: "versions",
});
const SQLITE_COLLECTIONS = Object.freeze({
  projects: "projects",
  sources: "sources",
  versions: "versions",
});
const BINARY_EXTENSIONS = new Set([
  ".a", ".bin", ".bmp", ".class", ".dylib", ".elf", ".gif", ".gz", ".hex",
  ".ico", ".jar", ".jpeg", ".jpg", ".map", ".o", ".pdf", ".png", ".so",
  ".tar", ".uf2", ".webp", ".zip",
]);
const TEXT_MIME_PREFIXES = ["text/"];
const TEXT_APPLICATION_MIMES = new Set([
  "application/json", "application/javascript", "application/toml", "application/xml",
  "application/x-httpd-php", "application/x-sh", "application/x-yaml",
]);
const SECRET_KEY_PATTERN = /(?:^|_)(?:access[_-]?token|api[_-]?key|client[_-]?secret|credential|password|private[_-]?key|secret|token)(?:$|_)/i;

async function readPostgresInventory(pool) {
  const inventory = emptyInventory("postgresql");
  let began = false;
  try {
    await pool.query("BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY");
    began = true;
    inventory.projects = decodePostgresRows(await pool.query(
      "SELECT project_id, raw_json FROM project_projects ORDER BY project_id",
    ), "project_projects", "project_id", inventory.read_errors);
    inventory.sources = decodePostgresRows(await pool.query(
      "SELECT project_id, path, raw_json FROM project_sources ORDER BY project_id, path",
    ), "project_sources", "path", inventory.read_errors);
    inventory.versions = decodePostgresRows(await pool.query(
      "SELECT project_id, version_id, raw_json FROM project_versions ORDER BY project_id, created_at, version_id",
    ), "project_versions", "version_id", inventory.read_errors);
  } catch (error) {
    inventory.read_errors.push(readError("postgres_inventory_unreadable", "postgresql", error.message));
  } finally {
    if (began) {
      try { await pool.query("ROLLBACK"); } catch (error) {
        inventory.read_errors.push(readError("postgres_read_transaction_close_failed", "postgresql", error.message));
      }
    }
  }
  return inventory;
}

function readSqliteInventory(sqlitePath) {
  const inventory = emptyInventory("legacy_sqlite");
  if (!sqlitePath || !fs.existsSync(sqlitePath)) {
    inventory.read_errors.push(readError("sqlite_source_missing", "sqlite", "Die angegebene SQLite-Datei fehlt."));
    return inventory;
  }
  let db;
  try {
    db = new DatabaseSync(sqlitePath, { readOnly: true });
    const typedTables = Object.keys(SQLITE_TABLES).filter((table) => tableExists(db, table));
    if (typedTables.length) {
      for (const table of typedTables) {
        const target = SQLITE_TABLES[table];
        const rows = db.prepare(`SELECT rowid AS source_row, raw_json FROM ${table} ORDER BY rowid`).all();
        inventory[target] = decodeSqliteRows(rows, table, inventory.read_errors);
      }
      for (const requiredTable of ["project_server_projects", "project_server_sources"]) {
        if (!typedTables.includes(requiredTable)) {
          inventory.read_errors.push(readError("sqlite_required_table_missing", requiredTable, "Erforderliche Legacy-Tabelle fehlt."));
        }
      }
      return inventory;
    }
    if (!tableExists(db, "service_documents")) {
      inventory.read_errors.push(readError("sqlite_project_state_missing", "sqlite", "Weder typisierte Projekttabellen noch service_documents wurden gefunden."));
      return inventory;
    }
    const rows = db.prepare(`
      SELECT collection_name, document_id, document_json
      FROM service_documents
      WHERE service_key='project-server'
        AND collection_name IN ('projects', 'sources', 'versions')
      ORDER BY collection_name, document_id
    `).all();
    for (const row of rows) {
      const target = SQLITE_COLLECTIONS[row.collection_name];
      const value = decodeJson(row.document_json, `service_documents:${row.collection_name}:${row.document_id}`, inventory.read_errors);
      if (target && value) inventory[target].push(value);
    }
  } catch (error) {
    inventory.read_errors.push(readError("sqlite_inventory_unreadable", "sqlite", error.message));
  } finally {
    if (db) db.close();
  }
  return inventory;
}

function buildDryRunReport(inventory) {
  const projectsById = new Map();
  const globalIssues = [...(inventory.read_errors || [])].map((entry) => issue("error", entry.code, entry.location, entry.detail));
  for (const project of inventory.projects || []) {
    const projectId = stringValue(project?.project_id);
    if (!projectId) {
      globalIssues.push(issue("error", "project_id_missing", "project_projects", "Projekt ohne project_id kann nicht migriert werden."));
      continue;
    }
    if (projectsById.has(projectId)) {
      globalIssues.push(issue("error", "duplicate_project_id", projectId, "project_id ist im Quellbestand nicht eindeutig."));
      continue;
    }
    projectsById.set(projectId, project);
  }

  const sourcesByProject = groupByProject(inventory.sources || [], "source", globalIssues);
  const versionsByProject = groupByProject(inventory.versions || [], "version", globalIssues);
  for (const projectId of new Set([...sourcesByProject.keys(), ...versionsByProject.keys()])) {
    if (!projectsById.has(projectId)) {
      globalIssues.push(issue("error", "orphan_project_content", projectId, "Quellen oder Versionen referenzieren ein fehlendes Projekt."));
    }
  }

  const projects = [...projectsById.entries()]
    .sort(([left], [right]) => compareText(left, right))
    .map(([projectId, project]) => buildProjectPlan(
      projectId,
      project,
      sourcesByProject.get(projectId) || [],
      versionsByProject.get(projectId) || [],
    ));
  const issues = stableIssues([
    ...globalIssues,
    ...projects.flatMap((project) => project.issues.map((entry) => ({ ...entry, project_id: project.project_id }))),
  ]);
  const errorCount = issues.filter((entry) => entry.severity === "error").length;
  const report = {
    schema_version: REPORT_SCHEMA_VERSION,
    mode: "dry_run_read_only",
    source_kind: inventory.source_kind || "unknown",
    source_fingerprint_sha256: sha256(canonicalJson({
      projects: inventory.projects || [],
      sources: inventory.sources || [],
      versions: inventory.versions || [],
      read_errors: inventory.read_errors || [],
    })),
    summary: {
      status: errorCount ? "blocked" : "ready",
      project_count: projects.length,
      source_file_count: projects.reduce((sum, project) => sum + project.current.source_file_count, 0),
      planned_commit_count: projects.reduce((sum, project) => sum + project.commits.length, 0),
      error_count: errorCount,
      warning_count: issues.filter((entry) => entry.severity === "warning").length,
    },
    write_gate: {
      allowed: errorCount === 0,
      report_sha256_required: true,
      note: "Dieses Werkzeug besitzt keinen Schreibmodus. Ein spaeterer Migrationsschreiber muss einen unveraenderten, fehlerfreien Bericht explizit bestaetigen.",
    },
    projects,
    issues,
  };
  return deepSort(report);
}

function buildProjectPlan(projectId, project, currentSources, versions, includeMigrationPayload = false) {
  const issues = [];
  const currentTree = prepareTree(projectId, "current", project, currentSources, issues);
  const versionMap = new Map();
  for (const version of versions) {
    const versionId = stringValue(version?.version_id);
    if (!versionId) {
      issues.push(issue("error", "version_id_missing", "project_versions", "Version ohne version_id kann nicht zugeordnet werden."));
      continue;
    }
    if (versionMap.has(versionId)) {
      issues.push(issue("error", "duplicate_version_id", versionId, "version_id ist innerhalb des Projekts nicht eindeutig."));
      continue;
    }
    versionMap.set(versionId, version);
  }
  for (const [versionId, version] of versionMap) {
    const parentId = stringValue(version.parent_version_id);
    if (parentId && !versionMap.has(parentId)) {
      issues.push(issue("error", "version_parent_missing", versionId, `Elternversion ${parentId} fehlt.`));
    }
    if (version.snapshot_sha256) {
      const calculatedSnapshotHash = legacySnapshotSha256(
        objectValue(version.project_snapshot || version.project || project),
        arrayValue(version.sources || version.source_snapshot),
      );
      if (String(version.snapshot_sha256).toLowerCase() !== calculatedSnapshotHash) {
        issues.push(issue("error", "version_snapshot_hash_mismatch", versionId, "Gespeicherter und berechneter Versions-SHA-256 stimmen nicht ueberein."));
      }
    }
    if (version.includes_binary === true) {
      const references = normalizeArtifactReferences(version.binary_artifacts);
      if (!references.length) {
        issues.push(issue("error", "binary_artifact_reference_missing", versionId, "Binary-Version besitzt keine Artifact-Store-Referenz."));
      }
      if (references.some((reference) => !/^[a-f0-9]{64}$/.test(reference.sha256) || reference.size_bytes <= 0)) {
        issues.push(issue("error", "binary_artifact_reference_invalid", versionId, "Binary-Artefaktreferenz besitzt keine gueltige Groesse und SHA-256-Pruefsumme."));
      }
    }
  }
  detectVersionCycles(versionMap, issues);

  const commitByVersion = new Map();
  const versionTrees = new Map();
  const buildingVersions = new Set();
  const buildVersionCommit = (versionId) => {
    if (commitByVersion.has(versionId)) return commitByVersion.get(versionId);
    if (buildingVersions.has(versionId)) return "";
    const version = versionMap.get(versionId);
    if (!version) return "";
    buildingVersions.add(versionId);
    const parentId = stringValue(version.parent_version_id);
    const parentOid = parentId && parentId !== versionId ? buildVersionCommit(parentId) : "";
    const snapshot = objectValue(version.project_snapshot || version.project || project);
    const versionSources = arrayValue(version.sources || version.source_snapshot);
    const tree = prepareTree(projectId, `version:${versionId}`, snapshot, versionSources, issues);
    versionTrees.set(versionId, tree);
    const commit = plannedCommit({
      treeOid: tree.tree_oid,
      parentOid,
      creatorId: version.created_by_user_id || project.user_id,
      createdAt: version.created_at || project.created_at,
      message: versionCommitMessage(version),
      issues,
      location: versionId,
    });
    commitByVersion.set(versionId, commit.commit_oid);
    buildingVersions.delete(versionId);
    return commit.commit_oid;
  };
  for (const versionId of [...versionMap.keys()].sort(compareText)) buildVersionCommit(versionId);

  const childIds = new Set([...versionMap.values()].map((version) => stringValue(version.parent_version_id)).filter(Boolean));
  const heads = [...versionMap.keys()].filter((versionId) => !childIds.has(versionId)).sort((left, right) => {
    const byDate = compareText(stringValue(versionMap.get(left)?.created_at), stringValue(versionMap.get(right)?.created_at));
    return byDate || compareText(left, right);
  });
  if (heads.length > 1) {
    issues.push(issue("error", "version_history_has_multiple_heads", projectId, "Mehrere SQL-Versionskoepfe verhindern einen eindeutigen Default-Branch."));
  }
  const currentParentId = heads.at(-1) || "";
  const currentCommit = plannedCommit({
    treeOid: currentTree.tree_oid,
    parentOid: currentParentId ? commitByVersion.get(currentParentId) || "" : "",
    creatorId: project.user_id,
    createdAt: project.updated_at || project.created_at,
    message: "Aktuellen SQL-Projektstand migrieren",
    issues,
    location: "current",
  });

  const commits = [...versionMap.entries()]
    .sort(([, left], [, right]) => compareText(stringValue(left.created_at), stringValue(right.created_at))
      || compareText(stringValue(left.version_id), stringValue(right.version_id)))
    .map(([versionId, version]) => ({
      source_kind: "sql_version",
      source_version_id: versionId,
      source_parent_version_id: stringValue(version.parent_version_id) || null,
      parent_commit_oid: stringValue(version.parent_version_id) ? commitByVersion.get(stringValue(version.parent_version_id)) || null : null,
      tree_oid: versionTrees.get(versionId)?.tree_oid || emptyTreeOid(),
      commit_oid: commitByVersion.get(versionId) || null,
      created_at: normalizedTimestamp(version.created_at),
      creator_ref_sha256: creatorReference(version.created_by_user_id || project.user_id),
      message_sha256: sha256(normalizeCommitMessage(versionCommitMessage(version))),
      includes_binary: version.includes_binary === true,
      binary_artifact_references: normalizeArtifactReferences(version.binary_artifacts),
      file_count: versionTrees.get(versionId)?.repository_file_count || 0,
    }));
  commits.push({
    source_kind: "current_sql_state",
    source_version_id: null,
    source_parent_version_id: currentParentId || null,
    parent_commit_oid: currentParentId ? commitByVersion.get(currentParentId) || null : null,
    tree_oid: currentTree.tree_oid,
    commit_oid: currentCommit.commit_oid,
    created_at: normalizedTimestamp(project.updated_at || project.created_at),
    creator_ref_sha256: creatorReference(project.user_id),
    message_sha256: sha256(normalizeCommitMessage("Aktuellen SQL-Projektstand migrieren")),
    includes_binary: false,
    binary_artifact_references: [],
    file_count: currentTree.repository_file_count,
  });

  const migrationCommits = [];
  if (includeMigrationPayload) {
    const appendVersion = (versionId) => {
      if (!versionId || migrationCommits.some((entry) => entry.source_version_id === versionId)) return;
      const version = versionMap.get(versionId);
      if (!version) return;
      appendVersion(stringValue(version.parent_version_id));
      migrationCommits.push(privateMigrationCommit(
        versionTrees.get(versionId),
        version.created_by_user_id || project.user_id,
        version.created_at || project.created_at,
        versionCommitMessage(version),
        commitByVersion.get(versionId),
        versionId,
      ));
    };
    appendVersion(currentParentId);
    migrationCommits.push(privateMigrationCommit(
      currentTree,
      project.user_id,
      project.updated_at || project.created_at,
      "Aktuellen SQL-Projektstand migrieren",
      currentCommit.commit_oid,
      null,
    ));
  }

  return {
    project_id: projectId,
    source_project_sha256: sha256(canonicalJson(project)),
    current: treeReport(currentTree),
    version_count: versionMap.size,
    version_comparison: {
      source_version_count: versionMap.size,
      planned_version_commit_count: commits.filter((commit) => commit.source_kind === "sql_version").length,
      matches: versionMap.size === commits.filter((commit) => commit.source_kind === "sql_version").length,
    },
    commits,
    target_head_commit_oid: currentCommit.commit_oid,
    ledger_preview: {
      source_sha256: sha256(canonicalJson({ project, sources: currentSources, versions })),
      target_commit_oid: currentCommit.commit_oid,
      file_count: currentTree.repository_file_count,
      status: issues.some((entry) => entry.severity === "error") ? "blocked" : "dry_run_ready",
    },
    ...(includeMigrationPayload ? { migration_commits: migrationCommits } : {}),
    issues: stableIssues(issues),
  };
}

function privateMigrationCommit(tree, creatorId, createdAt, message, expectedCommitOid, sourceVersionId) {
  const creatorHash = creatorReference(creatorId);
  return {
    source_version_id: sourceVersionId,
    files: tree.repositoryFiles.map((file) => ({ path: file.path, content: file.content })),
    author_name: `GerNetiX Migration ${creatorHash.slice(0, 12)}`,
    author_email: `migration+${creatorHash.slice(0, 16)}@invalid.gernetix`,
    git_timestamp: `${gitTimestamp(createdAt).value} +0000`,
    message: normalizeCommitMessage(message).trimEnd(),
    expected_commit_oid: expectedCommitOid,
  };
}

function buildMigrationPayload(inventory) {
  const report = buildDryRunReport(inventory);
  if (!report.write_gate.allowed) {
    const error = new Error("FORGEJO_MIGRATION_REPORT_BLOCKED");
    error.code = "FORGEJO_MIGRATION_REPORT_BLOCKED";
    error.report = report;
    throw error;
  }
  const projectsById = new Map((inventory.projects || []).map((project) => [stringValue(project.project_id), project]));
  const ignoredIssues = [];
  const sourcesByProject = groupByProject(inventory.sources || [], "source", ignoredIssues);
  const versionsByProject = groupByProject(inventory.versions || [], "version", ignoredIssues);
  return {
    source_fingerprint_sha256: report.source_fingerprint_sha256,
    report_sha256: sha256(canonicalJson(report)),
    projects: [...projectsById].sort(([left], [right]) => compareText(left, right)).map(([projectId, project]) => {
      const plan = buildProjectPlan(projectId, project, sourcesByProject.get(projectId) || [], versionsByProject.get(projectId) || [], true);
      return {
        project_id: projectId,
        source_sha256: plan.ledger_preview.source_sha256,
        target_head_commit_oid: plan.target_head_commit_oid,
        source_file_count: plan.current.source_file_count,
        source_version_count: plan.version_count,
        target_commit_count: plan.migration_commits.length,
        commits: plan.migration_commits,
      };
    }),
  };
}

function prepareTree(projectId, scope, project, sourceRows, issues) {
  const sourceFiles = [];
  const seenSourcePaths = new Map();
  for (const source of sourceRows || []) {
    const location = `${scope}:${stringValue(source?.path) || "<missing-path>"}`;
    const normalized = normalizedPath(source?.path, location, issues);
    if (!normalized) continue;
    const content = source?.content;
    if (typeof content !== "string") {
      issues.push(issue("error", "source_content_unreadable", location, "Dateiinhalt ist kein lesbarer UTF-8-String."));
      continue;
    }
    const actualHash = sha256(content);
    if (source.content_sha256 && String(source.content_sha256).toLowerCase() !== actualHash) {
      issues.push(issue("error", "source_hash_mismatch", location, "Gespeicherter und berechneter SHA-256 stimmen nicht ueberein."));
    }
    if (seenSourcePaths.has(normalized)) {
      const existing = seenSourcePaths.get(normalized);
      issues.push(issue(
        "error",
        existing.content === content ? "duplicate_source_path" : "conflicting_source_path",
        location,
        "Ein Quellpfad ist im SQL-Bestand mehrfach vorhanden.",
      ));
      continue;
    }
    if (isJsonSource(source, normalized) && !isValidJson(content)) {
      issues.push(issue("error", "json_source_unreadable", location, "Als JSON klassifizierter Dateiinhalt ist nicht parsebar."));
    }
    const classification = classifyFile(source, content);
    const disposition = classification === "text"
      ? "repository"
      : classification === "secret"
        ? "runtime_secret_required"
        : classification === "binary"
          ? "artifact_store_required"
          : "manual_resolution_required";
    if (classification !== "text") {
      issues.push(issue("error", `${classification}_source_requires_resolution`, location, `Datei ist als ${classification} klassifiziert und darf nicht automatisch nach Git geschrieben werden.`));
    }
    const file = { path: normalized, content, sha256: actualHash, bytes: Buffer.byteLength(content), classification, disposition, origin: "sql_source" };
    sourceFiles.push(file);
    seenSourcePaths.set(normalized, file);
  }
  assertPathSetSafe(sourceFiles.map((file) => file.path), `${projectId}:${scope}`, issues);

  let projected = [];
  try {
    projected = projectConfigurationSources(project || {});
  } catch (error) {
    issues.push(issue("error", "project_projection_failed", scope, error.message));
  }
  const targetFiles = new Map(sourceFiles.filter((file) => file.disposition === "repository").map((file) => [file.path, file]));
  for (const projection of projected) {
    const location = `${scope}:projection:${projection.path}`;
    const normalized = normalizedPath(projection.path, location, issues);
    if (!normalized || typeof projection.content !== "string") continue;
    const projectedFile = {
      path: normalized,
      content: projection.content,
      sha256: sha256(projection.content),
      bytes: Buffer.byteLength(projection.content),
      classification: classifyFile(projection, projection.content),
      disposition: "repository",
      origin: "project_projection",
    };
    if (projectedFile.classification !== "text") {
      projectedFile.disposition = projectedFile.classification === "secret"
        ? "runtime_secret_required"
        : projectedFile.classification === "binary"
          ? "artifact_store_required"
          : "manual_resolution_required";
      issues.push(issue("error", `${projectedFile.classification}_projection_requires_resolution`, location, "Kanonische Projektprojektion enthaelt Inhalt, der nicht automatisch nach Git geschrieben werden darf."));
      continue;
    }
    const existing = targetFiles.get(normalized);
    if (existing && existing.content !== projectedFile.content) {
      issues.push(issue("error", "projection_source_conflict", location, "SQL-Quelldatei und kanonische Projektprojektion liefern verschiedene Inhalte fuer denselben Pfad."));
      continue;
    }
    if (!existing) targetFiles.set(normalized, projectedFile);
  }
  const repositoryFiles = [...targetFiles.values()].sort((left, right) => compareText(left.path, right.path));
  assertPathSetSafe(repositoryFiles.map((file) => file.path), `${projectId}:${scope}:target`, issues);
  const sourceRepositoryFiles = sourceFiles.filter((file) => file.disposition === "repository").sort((left, right) => compareText(left.path, right.path));
  const sourceComparison = compareSourceFiles(sourceRepositoryFiles, repositoryFiles);
  return {
    sourceFiles: sourceFiles.sort((left, right) => compareText(left.path, right.path)),
    repositoryFiles,
    sourceComparison,
    source_file_count: sourceFiles.length,
    repository_file_count: repositoryFiles.length,
    tree_oid: gitTreeOid(repositoryFiles),
  };
}

function treeReport(tree) {
  const classifications = { text: 0, secret: 0, binary: 0, oversized: 0 };
  for (const file of tree.sourceFiles) classifications[file.classification] += 1;
  const projectManifest = tree.repositoryFiles.find((file) => file.path === "gernetix/project.json");
  return {
    source_file_count: tree.source_file_count,
    repository_file_count: tree.repository_file_count,
    tree_oid: tree.tree_oid,
    source_path_set_sha256: sha256(canonicalJson(tree.sourceFiles.map((file) => file.path))),
    repository_path_set_sha256: sha256(canonicalJson(tree.repositoryFiles.map((file) => file.path))),
    repository_file_set_sha256: sha256(canonicalJson(tree.repositoryFiles.map(publicFile))),
    project_manifest: {
      path: "gernetix/project.json",
      present: Boolean(projectManifest),
      sha256: projectManifest?.sha256 || null,
      origin: projectManifest?.origin || null,
    },
    source_comparison: tree.sourceComparison,
    classifications,
    files: tree.sourceFiles.map(publicFile),
    projected_files: tree.repositoryFiles.filter((file) => file.origin === "project_projection").map(publicFile),
  };
}

function compareSourceFiles(sourceFiles, repositoryFiles) {
  const targetByPath = new Map(repositoryFiles.map((file) => [file.path, file]));
  const mismatched = sourceFiles.filter((file) => targetByPath.get(file.path)?.sha256 !== file.sha256).map((file) => file.path);
  const missing = sourceFiles.filter((file) => !targetByPath.has(file.path)).map((file) => file.path);
  return {
    eligible_source_path_count: sourceFiles.length,
    eligible_paths_preserved: missing.length === 0,
    eligible_contents_preserved: missing.length === 0 && mismatched.length === 0,
    missing_path_sha256: sha256(canonicalJson(missing)),
    mismatched_path_sha256: sha256(canonicalJson(mismatched)),
  };
}

function classifyFile(source, content) {
  const bytes = Buffer.byteLength(content);
  if (bytes > MAX_REPOSITORY_FILE_BYTES) return "oversized";
  const sourcePath = stringValue(source.path);
  const extension = path.posix.extname(sourcePath).toLowerCase();
  const mime = stringValue(source.content_type).split(";")[0].trim().toLowerCase();
  if (BINARY_EXTENSIONS.has(extension) || content.includes("\0") || (mime && !isTextMime(mime))) return "binary";
  if (secretPath(sourcePath) || contentContainsSecret(content, mime, extension)) return "secret";
  return "text";
}

function contentContainsSecret(content, mime, extension) {
  if (/-----BEGIN [A-Z0-9 ]*PRIVATE KEY-----/.test(content)) return true;
  if (["application/json", ".json"].includes(mime) || extension === ".json") {
    try { return objectContainsSecret(JSON.parse(content)); } catch { return false; }
  }
  if (/^(?:export\s+)?[A-Z0-9_]*(?:PASSWORD|PRIVATE_KEY|SECRET|TOKEN|API_KEY)[A-Z0-9_]*\s*=\s*(?!\s*$|<runtime-secret>)/mi.test(content)) return true;
  if (/(?:password|private[_-]?key|secret|token|api[_-]?key)\s*[:=]\s*["'](?!<runtime-secret>)[^"']+["']/i.test(content)) return true;
  return [".yaml", ".yml", ".toml"].includes(extension)
    && /(?:password|private[_-]?key|secret|token|api[_-]?key)\s*[:=]\s*(?!<runtime-secret>\s*$)\S+/mi.test(content);
}

function isJsonSource(source, sourcePath) {
  const mime = stringValue(source?.content_type).split(";")[0].trim().toLowerCase();
  return mime === "application/json" || path.posix.extname(sourcePath).toLowerCase() === ".json";
}

function isValidJson(content) {
  try { JSON.parse(content); return true; } catch { return false; }
}

function objectContainsSecret(value) {
  if (Array.isArray(value)) return value.some(objectContainsSecret);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, entry]) => (
    (SECRET_KEY_PATTERN.test(key) && entry !== "" && entry !== null && entry !== false && entry !== "<runtime-secret>")
    || objectContainsSecret(entry)
  ));
}

function secretPath(sourcePath) {
  const lower = sourcePath.toLowerCase();
  return lower.split("/").some((part) => (
    part === ".env" || part.startsWith(".env.") || part === "credentials.json"
    || part === "secrets.json" || part === "id_rsa" || part === "id_ed25519"
    || part.endsWith(".pem") || part.endsWith(".key") || part.endsWith(".p12")
  ));
}

function isTextMime(mime) {
  return TEXT_MIME_PREFIXES.some((prefix) => mime.startsWith(prefix)) || TEXT_APPLICATION_MIMES.has(mime);
}

function plannedCommit({ treeOid, parentOid, creatorId, createdAt, message, issues, location }) {
  const timestamp = gitTimestamp(createdAt);
  if (!timestamp.valid) issues.push(issue("warning", "commit_timestamp_missing", location, "Fehlender oder unlesbarer Zeitstempel wird deterministisch auf Unix-Epoche gesetzt."));
  const creatorHash = creatorReference(creatorId);
  const identity = `GerNetiX Migration ${creatorHash.slice(0, 12)} <migration+${creatorHash.slice(0, 16)}@invalid.gernetix>`;
  const body = [
    `tree ${treeOid}`,
    ...(parentOid ? [`parent ${parentOid}`] : []),
    `author ${identity} ${timestamp.value} +0000`,
    `committer ${identity} ${timestamp.value} +0000`,
    "",
    normalizeCommitMessage(message),
  ].join("\n");
  return { commit_oid: gitObjectOid("commit", Buffer.from(body, "utf8")) };
}

function gitTreeOid(files) {
  const root = { files: new Map(), trees: new Map() };
  for (const file of files) {
    const parts = file.path.split("/");
    let node = root;
    for (const part of parts.slice(0, -1)) {
      if (!node.trees.has(part)) node.trees.set(part, { files: new Map(), trees: new Map() });
      node = node.trees.get(part);
    }
    node.files.set(parts.at(-1), gitObjectOid("blob", Buffer.from(file.content, "utf8")));
  }
  return treeNodeOid(root);
}

function treeNodeOid(node) {
  const entries = [
    ...[...node.files].map(([name, oid]) => ({ name, sortName: name, mode: "100644", oid })),
    ...[...node.trees].map(([name, child]) => ({ name, sortName: `${name}/`, mode: "40000", oid: treeNodeOid(child) })),
  ].sort((left, right) => Buffer.compare(Buffer.from(left.sortName), Buffer.from(right.sortName)));
  const content = Buffer.concat(entries.map((entry) => Buffer.concat([
    Buffer.from(`${entry.mode} ${entry.name}\0`, "utf8"),
    Buffer.from(entry.oid, "hex"),
  ])));
  return gitObjectOid("tree", content);
}

function gitObjectOid(type, content) {
  return crypto.createHash("sha1").update(Buffer.from(`${type} ${content.length}\0`, "utf8")).update(content).digest("hex");
}

function emptyTreeOid() {
  return gitObjectOid("tree", Buffer.alloc(0));
}

function normalizedPath(value, location, issues) {
  try {
    const original = stringValue(value);
    const normalized = normalizeRepositoryPath(value).normalize("NFC");
    if (original !== normalized) {
      issues.push(issue("error", "path_requires_rewrite", location, "Quellpfad ist nicht bereits kanonisch und darf nicht still umgeschrieben werden."));
    }
    return normalized;
  } catch (error) {
    issues.push(issue("error", "invalid_repository_path", location, error.message));
    return "";
  }
}

function assertPathSetSafe(paths, location, issues) {
  const normalized = new Map();
  const pathSet = new Set(paths);
  for (const sourcePath of paths) {
    const key = sourcePath.normalize("NFC");
    if (normalized.has(key) && normalized.get(key) !== sourcePath) {
      issues.push(issue("error", "unicode_path_collision", location, "Mehrere Pfade kollidieren nach Unicode-Normalisierung."));
    }
    normalized.set(key, sourcePath);
    const parts = sourcePath.split("/");
    for (let index = 1; index < parts.length; index += 1) {
      if (pathSet.has(parts.slice(0, index).join("/"))) {
        issues.push(issue("error", "file_directory_path_conflict", location, "Ein Pfad ist zugleich Datei und Elternverzeichnis."));
      }
    }
  }
}

function detectVersionCycles(versionMap, issues) {
  const visiting = new Set();
  const visited = new Set();
  const visit = (versionId) => {
    if (visiting.has(versionId)) {
      issues.push(issue("error", "version_parent_cycle", versionId, "Die SQL-Versionshistorie enthaelt einen Elternzyklus."));
      return;
    }
    if (visited.has(versionId)) return;
    visiting.add(versionId);
    const parentId = stringValue(versionMap.get(versionId)?.parent_version_id);
    if (parentId && versionMap.has(parentId)) visit(parentId);
    visiting.delete(versionId);
    visited.add(versionId);
  };
  for (const versionId of versionMap.keys()) visit(versionId);
}

function normalizeArtifactReferences(value) {
  return arrayValue(value).map((artifact) => ({
    artifact_id: stringValue(artifact?.artifact_id),
    file_name_sha256: sha256(stringValue(artifact?.file_name)),
    sha256: stringValue(artifact?.sha256).toLowerCase(),
    size_bytes: Number(artifact?.size_bytes || 0),
  })).sort((left, right) => compareText(left.artifact_id, right.artifact_id));
}

function versionCommitMessage(version) {
  const base = String(version?.message || "Projektstand gespeichert").replace(/\r\n?/g, "\n").trimEnd()
    || "Projektstand gespeichert";
  const references = normalizeArtifactReferences(version?.binary_artifacts);
  if (!references.length) return base;
  return `${base}\n\n${references.map((reference) => (
    `GerNetiX-Artifact: ${reference.artifact_id} sha256=${reference.sha256} bytes=${reference.size_bytes} name-sha256=${reference.file_name_sha256}`
  )).join("\n")}`;
}

function legacySnapshotSha256(projectSnapshot, sources) {
  const project = objectValue(projectSnapshot);
  const canonical = {
    project: withoutVolatileSnapshotMetadata({
      title: project.title,
      description: project.description,
      learning_project_id: project.learning_project_id,
      hardware_profile_id: project.hardware_profile_id,
      device_id: project.device_id,
      build_config: project.build_config,
      software_units: project.software_units,
      active_software_unit_id: project.active_software_unit_id,
      view_manifest: project.view_manifest,
      status: project.status,
    }),
    sources: [...arrayValue(sources)]
      .sort((left, right) => compareText(left?.path, right?.path))
      .map(({ path: sourcePath, content, content_type, role }) => ({ path: sourcePath, content, content_type, role })),
  };
  return sha256(JSON.stringify(canonical));
}

function withoutVolatileSnapshotMetadata(value) {
  if (Array.isArray(value)) return value.map(withoutVolatileSnapshotMetadata);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => !["snapshot_at", "saved_at", "updated_at", "runtime_model_version"].includes(key))
    .sort(([left], [right]) => compareText(left, right))
    .map(([key, entry]) => [key, withoutVolatileSnapshotMetadata(entry)]));
}

function groupByProject(values, kind, issues) {
  const result = new Map();
  for (const value of values) {
    const projectId = stringValue(value?.project_id);
    if (!projectId) {
      issues.push(issue("error", `${kind}_project_id_missing`, kind, `${kind} ohne project_id kann nicht zugeordnet werden.`));
      continue;
    }
    if (!result.has(projectId)) result.set(projectId, []);
    result.get(projectId).push(value);
  }
  return result;
}

function decodePostgresRows(result, table, identityKey, errors) {
  return arrayValue(result?.rows).map((row, index) => decodeJson(
    row.raw_json,
    `${table}:${stringValue(row[identityKey]) || index}`,
    errors,
  )).filter(Boolean);
}

function decodeSqliteRows(rows, table, errors) {
  return rows.map((row) => decodeJson(row.raw_json, `${table}:row:${row.source_row}`, errors)).filter(Boolean);
}

function decodeJson(value, location, errors) {
  if (value && typeof value === "object") return value;
  try {
    const parsed = JSON.parse(String(value));
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("JSON-Wurzel ist kein Objekt.");
    return parsed;
  } catch (error) {
    errors.push(readError("legacy_json_unreadable", location, error.message));
    return null;
  }
}

function tableExists(db, table) {
  return Boolean(db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table));
}

function emptyInventory(sourceKind) {
  return { source_kind: sourceKind, projects: [], sources: [], versions: [], read_errors: [] };
}

function readError(code, location, detail) {
  return { code, location, detail: safeDetail(detail) };
}

function issue(severity, code, location, detail) {
  return { severity, code, location: stringValue(location), detail: safeDetail(detail) };
}

function stableIssues(values) {
  return values.sort((left, right) => compareText(left.project_id, right.project_id)
    || compareText(left.severity, right.severity)
    || compareText(left.code, right.code)
    || compareText(left.location, right.location)
    || compareText(left.detail, right.detail));
}

function safeDetail(value) {
  return String(value || "").replace(/[\r\n]+/g, " ").slice(0, 300);
}

function publicFile(file) {
  return {
    path: file.path,
    sha256: file.sha256,
    bytes: file.bytes,
    classification: file.classification,
    disposition: file.disposition,
    origin: file.origin,
  };
}

function creatorReference(value) {
  return sha256(stringValue(value) || "unknown-creator");
}

function gitTimestamp(value) {
  const milliseconds = Date.parse(stringValue(value));
  return Number.isFinite(milliseconds)
    ? { valid: true, value: Math.floor(milliseconds / 1000) }
    : { valid: false, value: 0 };
}

function normalizedTimestamp(value) {
  const milliseconds = Date.parse(stringValue(value));
  return Number.isFinite(milliseconds) ? new Date(milliseconds).toISOString() : "1970-01-01T00:00:00.000Z";
}

function normalizeCommitMessage(value) {
  const normalized = String(value || "Projektstand gespeichert").replace(/\r\n?/g, "\n").trimEnd();
  return `${normalized || "Projektstand gespeichert"}\n`;
}

function canonicalJson(value) {
  return JSON.stringify(deepSort(value));
}

function deepSort(value) {
  if (Array.isArray(value)) return value.map(deepSort);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort(compareText).map((key) => [key, deepSort(value[key])]));
}

function sha256(value) {
  return crypto.createHash("sha256").update(String(value), "utf8").digest("hex");
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function arrayValue(value) {
  return Array.isArray(value) ? value : [];
}

function stringValue(value) {
  return value === null || value === undefined ? "" : String(value);
}

function compareText(left, right) {
  return stringValue(left).localeCompare(stringValue(right), "en");
}

function parseArguments(argv) {
  const options = { sqlite: "", postgres: false, output: "", assertReady: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--sqlite") options.sqlite = argv[++index] || "";
    else if (argument === "--postgres") options.postgres = true;
    else if (argument === "--output") options.output = argv[++index] || "";
    else if (argument === "--assert-ready") options.assertReady = true;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error(`Unbekanntes Argument: ${argument}`);
  }
  if (!options.help && Boolean(options.sqlite) === Boolean(options.postgres)) {
    throw new Error("Genau eine Quelle muss mit --sqlite <datei> oder --postgres gewaehlt werden.");
  }
  return options;
}

async function main(argv = process.argv.slice(2), environment = process.env) {
  const options = parseArguments(argv);
  if (options.help) {
    process.stdout.write([
      "Usage:",
      "  forgejo-migration-dry-run.js --sqlite <datei> [--output <bericht.json>] [--assert-ready]",
      "  forgejo-migration-dry-run.js --postgres [--output <bericht.json>] [--assert-ready]",
      "",
      "PostgreSQL nutzt PROJECT_POSTGRES_URL oder PROJECT_POSTGRES_HOST/PORT/DATABASE/USER/PASSWORD.",
      "Das Werkzeug liest ausschliesslich und besitzt keinen Apply-Modus.",
      "",
    ].join("\n"));
    return 0;
  }
  let inventory;
  let pool;
  if (options.sqlite) {
    inventory = readSqliteInventory(options.sqlite);
  } else {
    const { Pool } = require("pg");
    pool = new Pool(postgresOptions(environment));
    try { inventory = await readPostgresInventory(pool); } finally { await pool.end(); }
  }
  const report = buildDryRunReport(inventory);
  const serialized = `${canonicalJson(report)}\n`;
  if (options.output) fs.writeFileSync(options.output, serialized, { encoding: "utf8", flag: "wx", mode: 0o600 });
  else process.stdout.write(serialized);
  return options.assertReady && !report.write_gate.allowed ? 2 : 0;
}

function postgresOptions(environment) {
  if (environment.PROJECT_POSTGRES_URL) return { connectionString: environment.PROJECT_POSTGRES_URL };
  if (!stringValue(environment.PROJECT_POSTGRES_PASSWORD).trim()) throw new Error("PROJECT_POSTGRES_PASSWORD fehlt.");
  return {
    host: environment.PROJECT_POSTGRES_HOST || "127.0.0.1",
    port: Number(environment.PROJECT_POSTGRES_PORT || 5432),
    database: environment.PROJECT_POSTGRES_DATABASE || "gernetix_runtime",
    user: environment.PROJECT_POSTGRES_USER || "gernetix_runtime",
    password: environment.PROJECT_POSTGRES_PASSWORD,
  };
}

if (require.main === module) {
  main().then((exitCode) => { process.exitCode = exitCode; }).catch((error) => {
    process.stderr.write(`Forgejo-Migrations-Dry-run fehlgeschlagen: ${safeDetail(error.message)}\n`);
    process.exitCode = 1;
  });
}

module.exports = {
  REPORT_SCHEMA_VERSION,
  buildDryRunReport,
  buildMigrationPayload,
  canonicalJson,
  classifyFile,
  gitObjectOid,
  gitTreeOid,
  main,
  parseArguments,
  postgresOptions,
  readPostgresInventory,
  readSqliteInventory,
};
