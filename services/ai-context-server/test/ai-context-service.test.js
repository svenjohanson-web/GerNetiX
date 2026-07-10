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

test("hardware catalog source is registered and can be authorized locally", () => {
  const service = createService();
  assert.ok(service.listSources().some((source) => source.source_type === "hardware_catalog" && source.source_scope === "processor_boards/esp32"));
  assert.ok(service.listSources().some((source) => source.source_type === "ai_prompt" && source.source_scope === "prompt_foundations"));
  assert.ok(service.listSources().some((source) => source.source_type === "architecture_context" && source.source_scope === "start_architecture/components"));
  service.createGrant(grantInput({
    account_id: "*",
    source_type: "hardware_catalog",
    source_scope: "processor_boards/esp32",
    redaction_level: "summary_only",
  }));

  const result = service.preflight(preflightRequest({
    source_type: "hardware_catalog",
    source_scope: "processor_boards/esp32",
    provider: "ollama",
  }));

  assert.equal(result.allowed, true);
  assert.equal(result.redaction_level, "summary_only");
});

test("architecture components are centrally available from ai context", () => {
  const service = createService();
  const components = service.listArchitectureComponents();

  assert.ok(components.length >= 8);
  assert.ok(components.find((component) => component.name === "MQTT Broker").aliases.includes("mqtt"));
  assert.ok(components.find((component) => component.name === "Mobile App").decision_hints.join(" ").includes("Browser UI reicht"));
  assert.ok(components.find((component) => component.name === "Backend / API").provided_interfaces.includes("REST API"));
});

test("architecture components can be updated centrally without identity code changes", () => {
  const service = createService();

  const component = service.upsertArchitectureComponent({
    component_id: "arch_component.example_component",
    name: "Example Component",
    aliases: ["example"],
    summary: "Zentral gepflegter Beispielbaustein.",
    properties: ["testbar"],
    provided_interfaces: ["Example API"],
    required_interfaces: ["Example Input"],
    decision_hints: ["Nur fuer Tests."],
    status: "active",
  });

  assert.equal(component.summary, "Zentral gepflegter Beispielbaustein.");
  assert.equal(service.listArchitectureComponents({ component_id: "arch_component.example_component" })[0].name, "Example Component");
});

test("prompt foundations are centrally available from ai context", () => {
  const service = createService();
  const prompts = service.listPromptFoundations();

  assert.equal(prompts.length, 2);
  assert.ok(prompts.some((prompt) => prompt.route_task === "general_chat"));
  assert.ok(prompts.find((prompt) => prompt.route_task === "architecture_discovery").content.includes("Minimalumfang"));
  assert.ok(prompts.find((prompt) => prompt.route_task === "architecture_discovery").content.includes("ESP32-only"));
  assert.ok(prompts.find((prompt) => prompt.route_task === "architecture_discovery").content.includes("PlantUML-Strukturdiagramme"));
  assert.ok(prompts.find((prompt) => prompt.route_task === "architecture_discovery").content.includes("maximalen Architektur"));
  assert.ok(prompts.find((prompt) => prompt.route_task === "architecture_discovery").content.includes("max oder leer"));
  assert.ok(prompts.find((prompt) => prompt.route_task === "architecture_discovery").content.includes("Systemverhalten"));
  assert.ok(prompts.find((prompt) => prompt.route_task === "architecture_discovery").content.includes("Komponenten besitzen Eigenschaften"));
});

test("prompt foundations can be updated centrally without identity code changes", () => {
  const service = createService();

  const prompt = service.upsertPromptFoundation({
    foundation_id: "ai_prompt.architecture_discovery.system",
    title: "Architektur-Discovery Systemprompt",
    route_task: "architecture_discovery",
    source_scope: "prompt_foundations/architecture_discovery/system",
    content_kind: "system_prompt",
    allowed_sources: ["current_chat"],
    blocked_sources: ["project_files"],
    content: "Nur aus AI Context gepflegte Prompt-Regel.",
    status: "active",
  });

  assert.equal(prompt.content, "Nur aus AI Context gepflegte Prompt-Regel.");
  assert.equal(service.listPromptFoundations({ route_task: "architecture_discovery" })[0].content, "Nur aus AI Context gepflegte Prompt-Regel.");
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
  const summary = reloaded.sqliteSummary();
  assert.equal(summary.available, true);
  assert.equal(summary.db_path, dbPath);
  assert.equal(summary.tables.find((table) => table.table_name === "ai_context_sources").row_count, 4);
  assert.equal(summary.tables.find((table) => table.table_name === "ai_context_prompt_foundations").row_count, 2);
  assert.ok(summary.tables.find((table) => table.table_name === "ai_context_architecture_components").row_count >= 8);
  assert.equal(summary.tables.find((table) => table.table_name === "ai_context_grants").row_count, 1);
  assert.equal(summary.tables.find((table) => table.table_name === "ai_context_audit_events").row_count, 1);
  assert.equal(summary.tables.find((table) => table.table_name === "ai_context_policy").preview_rows[0].raw_json, undefined);

  const db = new DatabaseSync(dbPath);
  try {
    assert.equal(tableCount(db, "ai_context_grants"), 1);
    assert.equal(tableCount(db, "ai_context_audit_events"), 1);
    assert.equal(tableCount(db, "ai_context_policy"), 1);
    assert.equal(tableCount(db, "ai_context_sources"), 4);
    assert.equal(tableCount(db, "ai_context_prompt_foundations"), 2);
    assert.ok(tableCount(db, "ai_context_architecture_components") >= 8);
  } finally {
    db.close();
  }
});

test("sqlite repository persists prompt foundation updates", () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-ai-context-")), "ai-context.sqlite");
  const service = new AiContextService({
    repository: SqliteBackedAiContextRepository.create(dbPath),
    now: () => fixedNow,
  });

  service.upsertPromptFoundation({
    foundation_id: "ai_prompt.architecture_discovery.system",
    title: "Architektur-Discovery Systemprompt",
    route_task: "architecture_discovery",
    source_scope: "prompt_foundations/architecture_discovery/system",
    content_kind: "system_prompt",
    allowed_sources: ["current_chat"],
    blocked_sources: ["project_files"],
    content: "Persistierte AI-Context-Prompt-Regel.",
    status: "active",
  });

  const reloaded = new AiContextService({
    repository: SqliteBackedAiContextRepository.create(dbPath),
    now: () => fixedNow,
  });
  assert.equal(reloaded.listPromptFoundations({ route_task: "architecture_discovery" })[0].content, "Persistierte AI-Context-Prompt-Regel.");

  const db = new DatabaseSync(dbPath);
  try {
    const row = db.prepare("SELECT content FROM ai_context_prompt_foundations WHERE foundation_id = ?").get("ai_prompt.architecture_discovery.system");
    assert.equal(row.content, "Persistierte AI-Context-Prompt-Regel.");
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
