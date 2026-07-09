const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");

const { AiContextService, InMemoryAiContextRepository, SqliteBackedAiContextRepository } = require("../src");

const fixedNow = new Date("2026-07-09T10:00:00.000Z");

test("preflight denies without grant and writes audit event", () => {
  const service = createService();

  const result = service.preflight(preflightRequest());

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "missing_valid_grant");
  assert.equal(service.listAuditEvents()[0].access_decision, "denied");
  assert.equal(service.listAuditEvents()[0].rejection_reason, "missing_valid_grant");
});

test("local provider is allowed with matching active grant", () => {
  const service = createService();
  const grant = service.createGrant(grantInput({
    allowed_provider_scope: "local_only",
    redaction_level: "none",
  }));

  const result = service.preflight(preflightRequest({ provider: "ollama" }));

  assert.equal(result.allowed, true);
  assert.equal(result.grant.grant_id, grant.grant_id);
  assert.equal(result.redaction_level, "none");
  assert.equal(service.listAuditEvents()[0].access_decision, "allowed");
});

test("external provider requires explicit grant scope and redaction", () => {
  const service = createService();
  service.createGrant(grantInput({
    allowed_provider_scope: "external_redacted_only",
    redaction_level: "masked",
  }));

  const result = service.preflight(preflightRequest({
    provider: "api",
    model: "gpt-4.1-mini",
  }));

  assert.equal(result.allowed, true);
  assert.equal(result.redaction_level, "masked");
});

test("customer data stays blocked for external provider by global policy", () => {
  const service = createService();
  service.createGrant(grantInput({
    source_type: "customer_data",
    source_scope: "account/profile",
    allowed_provider_scope: "external_redacted_only",
    redaction_level: "masked",
  }));

  const result = service.preflight(preflightRequest({
    source_type: "customer_data",
    source_scope: "account/profile",
    provider: "api",
  }));

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "external_provider_customer_data_blocked_by_policy");
});

test("revoked grant no longer authorizes context access", () => {
  const service = createService();
  const grant = service.createGrant(grantInput());
  service.revokeGrant(grant.grant_id);

  const result = service.preflight(preflightRequest());

  assert.equal(result.allowed, false);
  assert.equal(result.reason, "missing_valid_grant");
});

test("sqlite repository persists grants policy and audit events in own database", () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-ai-context-")), "ai-context.sqlite");
  const service = new AiContextService({
    repository: SqliteBackedAiContextRepository.create(dbPath),
    now: () => fixedNow,
  });
  service.createGrant(grantInput());
  service.preflight(preflightRequest());

  const reloaded = new AiContextService({
    repository: SqliteBackedAiContextRepository.create(dbPath),
    now: () => fixedNow,
  });
  assert.equal(reloaded.listGrants().length, 1);
  assert.equal(reloaded.listAuditEvents().length, 1);

  const db = new DatabaseSync(dbPath);
  try {
    assert.equal(tableCount(db, "ai_context_grants"), 1);
    assert.equal(tableCount(db, "ai_context_audit_events"), 1);
    assert.equal(tableCount(db, "ai_context_policy"), 1);
  } finally {
    db.close();
  }
});

function createService() {
  return new AiContextService({
    repository: new InMemoryAiContextRepository(),
    now: () => fixedNow,
  });
}

function grantInput(overrides = {}) {
  return {
    account_id: "account-1",
    project_id: "project-1",
    granted_by_account_id: "account-1",
    source_type: "project_files",
    source_scope: "projects/project-1",
    purpose: "architecture_assistance",
    allowed_provider_scope: "local_only",
    redaction_level: "summary_only",
    valid_until: "2026-07-10T10:00:00.000Z",
    ...overrides,
  };
}

function preflightRequest(overrides = {}) {
  return {
    account_id: "account-1",
    project_id: "project-1",
    actor_id: "account-1",
    actor_role: "account_owner",
    source_type: "project_files",
    source_scope: "projects/project-1/src",
    purpose: "architecture_assistance",
    provider: "ollama",
    model: "llama3.2:3b",
    ...overrides,
  };
}

function tableCount(db, tableName) {
  return db.prepare(`SELECT COUNT(*) AS count FROM ${tableName}`).get().count;
}
