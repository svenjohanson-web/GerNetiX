const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");

const { ContextService, InMemoryContextRepository, SqliteBackedContextRepository } = require("../src");

test("builds current context from requirement slices and runtime references", () => {
  const service = new ContextService({ repository: new InMemoryContextRepository() });
  const scope = service.upsertScope({ account_id: "acct-1", project_id: "project-1", title: "User IDE Ausbau" });

  const slice = service.upsertRequirementSlice({
    scope_id: scope.scope_id,
    requirement_id: "BR-IDE-001",
    slice_key: "ide-project-server-binding",
    title: "User IDE an Project Server anbinden",
    status: "implemented",
    implemented_by: ["services/project-server", "tools/guided-code-lesson"],
    related_artifacts: ["data/architecture/artifacts.yaml"],
  });
  service.upsertRuntimeReference({
    scope_id: scope.scope_id,
    reference_type: "service",
    reference_id: "project-server",
    source_service: "project-server",
    payload: { endpoint: "/api/projects", token: "secret-token" },
  });
  service.recordDecision({
    scope_id: scope.scope_id,
    title: "Requirement Slices statt 1:1 Requirement Mapping",
    related_slice_ids: [slice.slice_id],
  });

  const context = service.currentContext({ account_id: "acct-1", project_id: "project-1" });
  assert.equal(context.scope.title, "User IDE Ausbau");
  assert.equal(context.requirement_slices[0].slice_key, "ide-project-server-binding");
  assert.equal(context.runtime_references[0].source_service, "project-server");
  assert.equal(context.decisions[0].related_slice_ids[0], slice.slice_id);
});

test("creates redacted context packs", () => {
  const service = new ContextService({ repository: new InMemoryContextRepository() });
  const scope = service.upsertScope({ account_id: "acct-1", project_id: "project-1", title: "AI Usage" });
  service.upsertRuntimeReference({
    scope_id: scope.scope_id,
    title: "AI Usage State",
    payload: { token: "do-not-leak", nested: { wifi_password: "also-secret", value: 7 } },
  });

  const pack = service.createContextPack({ scope_id: scope.scope_id, purpose: "codex_handoff" });
  assert.equal(pack.payload.runtime_references[0].payload.token, "[redacted]");
  assert.equal(pack.payload.runtime_references[0].payload.nested.wifi_password, "[redacted]");
  assert.equal(pack.payload.runtime_references[0].payload.nested.value, 7);
});

test("persists context manager state in sqlite normalized tables", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-context-"));
  const dbPath = path.join(tmp, "context.sqlite");
  const repository = SqliteBackedContextRepository.create(dbPath);
  const service = new ContextService({ repository });
  const scope = service.upsertScope({ account_id: "acct-1", project_id: "project-1", title: "Project Context" });

  service.upsertRequirementSlice({
    scope_id: scope.scope_id,
    requirement_id: "BR-CTX-001",
    title: "Kontext aus Anforderungen ableiten",
    status: "implemented",
    evidence: ["services/context-manager"],
  });
  service.createContextPack({ scope_id: scope.scope_id });

  repository.store.close();
  const db = new DatabaseSync(dbPath);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM context_scopes").get().count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM context_requirement_slices").get().count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM context_packs").get().count, 1);
  assert.equal(db.prepare("SELECT COUNT(*) AS count FROM service_documents WHERE service_key = 'context-manager'").get().count >= 3, true);
  db.close();
});
