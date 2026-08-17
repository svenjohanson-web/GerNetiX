"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  applyRetirement,
  collectInventory,
  hasForbiddenContent,
  parseArgs,
  sanitizeProjectContent,
  stableStringify,
} = require("../src/project-sql-retirement");

test("requires an explicit retirement mode and an exact apply fingerprint", () => {
  assert.throws(() => parseArgs([]), /Modus/);
  assert.deepEqual(parseArgs(["--plan"]), { mode: "plan" });
  assert.throws(() => parseArgs(["--plan", "--apply"]), /Genau einer/);
  assert.throws(() => parseArgs(["--apply", "--confirm-fingerprint", "short"]), /64-stellige/);
  assert.equal(parseArgs([
    "--apply", "--confirm-fingerprint", "a".repeat(64),
    "--backup-reference", "runtime-backup-20260817.dump",
    "--backup-sha256", "b".repeat(64),
  ]).mode, "apply");
});

test("detects and removes project content keys recursively without changing metadata", () => {
  const document = {
    build_job_id: "build-1",
    source_snapshot: [{ path: "main.cpp", content: "secret" }],
    nested: {
      project_snapshot: { title: "old" },
      keep: "metadata",
      items: [{ sources: [], commit_sha: "a".repeat(40) }],
    },
  };
  assert.equal(hasForbiddenContent(document), true);
  const sanitized = sanitizeProjectContent(document);
  assert.equal(hasForbiddenContent(sanitized), false);
  assert.deepEqual(sanitized, {
    build_job_id: "build-1",
    nested: { keep: "metadata", items: [{ commit_sha: "a".repeat(40) }] },
  });
});

test("stable serialization ignores object key order for retirement fingerprints", () => {
  assert.equal(stableStringify({ b: 2, a: { d: 4, c: 3 } }), stableStringify({ a: { c: 3, d: 4 }, b: 2 }));
});

test("applies the confirmed plan atomically, scrubs snapshots, and drops the source table", async () => {
  const pool = new RetirementPool();
  const plan = await collectInventory(pool);
  assert.equal(plan.summary.source_rows, 1);
  assert.equal(plan.summary.build_job_documents_with_content, 1);
  assert.equal(plan.summary.apply_allowed, true);

  const result = await applyRetirement(pool, {
    confirmFingerprint: plan.fingerprint,
    backupReference: "runtime-postgres-20260817.dump",
    backupSha256: "b".repeat(64),
  });
  assert.equal(result.removed_source_rows, 1);
  assert.equal(result.sanitized_build_job_documents, 1);
  assert.equal(pool.sourcesTablePresent, false);
  assert.equal(hasForbiddenContent(pool.buildJobs[0].raw_json), false);
  assert.ok(pool.calls.includes("COMMIT"));
  assert.ok(pool.calls.includes("DROP TABLE project_sources"));
});

class RetirementPool {
  constructor() {
    this.sourcesTablePresent = true;
    this.sources = [{ project_id: "project-1", path: "main.cpp", raw_json: { path: "main.cpp", content: "x" } }];
    this.projects = [{
      project_id: "project-1", repository_provider: "forgejo", repository_state: "active",
      repository_id: "42", head_sha: "a".repeat(40), raw_json: { project_id: "project-1" },
    }];
    this.versions = [];
    this.buildJobs = [{
      build_job_id: "build-1", project_id: "project-1",
      raw_json: { build_job_id: "build-1", source_snapshot: [{ path: "main.cpp", content: "x" }] },
    }];
    this.calls = [];
  }

  async connect() { return this; }
  release() {}

  async query(text, values = []) {
    const sql = String(text).trim().replace(/\s+/g, " ");
    this.calls.push(sql);
    if (sql.startsWith("SELECT to_regclass")) return { rows: [{ present: this.sourcesTablePresent }] };
    if (sql.startsWith("SELECT project_id, path")) return { rows: structuredClone(this.sources) };
    if (sql.startsWith("SELECT project_id, repository_provider")) return { rows: structuredClone(this.projects) };
    if (sql.startsWith("SELECT version_id")) return { rows: structuredClone(this.versions) };
    if (sql.startsWith("SELECT build_job_id")) return { rows: structuredClone(this.buildJobs) };
    if (sql.startsWith("UPDATE project_build_jobs")) {
      this.buildJobs.find((row) => row.build_job_id === values[0]).raw_json = structuredClone(values[1]);
      return { rowCount: 1, rows: [] };
    }
    if (sql === "DROP TABLE project_sources") this.sourcesTablePresent = false;
    return { rowCount: 0, rows: [] };
  }
}
