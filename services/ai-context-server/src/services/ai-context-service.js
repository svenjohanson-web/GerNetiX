const crypto = require("node:crypto");
const { AiContextError } = require("../errors");
const { isGrantActive } = require("../repositories/in-memory-ai-context-repository");

const SOURCE_TYPES = new Set(["current_chat", "project_files", "graph_database", "device_data", "customer_data", "admin_statistics", "hardware_catalog", "ai_prompt"]);
const PURPOSES = new Set(["architecture_assistance", "debugging", "support_case", "usage_analysis", "general_chat"]);
const PROVIDER_SCOPES = new Set(["local_only", "external_allowed", "external_redacted_only"]);
const REDACTION_LEVELS = new Set(["none", "metadata_only", "summary_only", "masked"]);

class AiContextService {
  constructor(options) {
    this.repository = options.repository;
    this.now = options.now || (() => new Date());
  }

  createGrant(input = {}) {
    validateGrantInput(input);
    const now = this.now().toISOString();
    const grant = {
      grant_id: input.grant_id || createId("ai_ctx_grant"),
      account_id: clean(input.account_id),
      project_id: clean(input.project_id),
      granted_by_account_id: clean(input.granted_by_account_id || input.account_id),
      source_type: clean(input.source_type),
      source_scope: normalizeScope(input.source_scope),
      purpose: clean(input.purpose),
      allowed_provider_scope: clean(input.allowed_provider_scope || "local_only"),
      redaction_level: clean(input.redaction_level || "summary_only"),
      max_context_items: positiveInt(input.max_context_items, this.repository.getPolicy().default_max_context_items),
      valid_from: clean(input.valid_from) || now,
      valid_until: clean(input.valid_until),
      revoked_at: clean(input.revoked_at),
      created_at: now,
      rationale: clean(input.rationale),
    };
    assertValidGrantWindow(grant);
    return this.repository.saveGrant(grant);
  }

  revokeGrant(grantId, input = {}) {
    const grant = this.repository.revokeGrant(grantId, clean(input.revoked_at) || this.now().toISOString());
    if (!grant) throw new AiContextError("grant_not_found", "AI-Kontext-Grant wurde nicht gefunden.", 404);
    return grant;
  }

  listGrants(filter = {}) {
    return this.repository.listGrants(filter);
  }

  listSources(filter = {}) {
    return this.repository.listSources(filter);
  }

  listPromptFoundations(filter = {}) {
    return this.repository.listPromptFoundations(filter);
  }

  upsertPromptFoundation(input = {}) {
    validatePromptFoundationInput(input);
    const now = this.now().toISOString();
    const foundationId = clean(input.foundation_id);
    const existing = this.repository.listPromptFoundations().find((item) => item.foundation_id === foundationId);
    return this.repository.savePromptFoundation({
      foundation_id: foundationId,
      title: clean(input.title),
      route_task: clean(input.route_task),
      source_scope: normalizeScope(input.source_scope),
      content_kind: clean(input.content_kind || "system_prompt"),
      allowed_sources: Array.isArray(input.allowed_sources) ? input.allowed_sources.map(clean).filter(Boolean) : [],
      blocked_sources: Array.isArray(input.blocked_sources) ? input.blocked_sources.map(clean).filter(Boolean) : [],
      content: clean(input.content),
      status: clean(input.status || "active"),
      created_at: existing?.created_at || now,
      updated_at: now,
    });
  }

  upsertSource(input = {}) {
    validateSourceInput(input);
    const now = this.now().toISOString();
    const existing = this.repository.listSources().find((source) => source.source_id === clean(input.source_id));
    return this.repository.saveSource({
      source_id: clean(input.source_id),
      source_type: clean(input.source_type),
      source_scope: normalizeScope(input.source_scope),
      title: clean(input.title),
      summary: clean(input.summary),
      backing_service: clean(input.backing_service),
      endpoint: clean(input.endpoint),
      contains: Array.isArray(input.contains) ? input.contains.map(clean).filter(Boolean) : [],
      default_redaction_level: clean(input.default_redaction_level || "summary_only"),
      default_provider_scope: clean(input.default_provider_scope || "local_only"),
      allowed_purposes: Array.isArray(input.allowed_purposes) ? input.allowed_purposes.map(clean).filter((purpose) => PURPOSES.has(purpose)) : [],
      status: clean(input.status || "active"),
      created_at: existing?.created_at || now,
      updated_at: now,
    });
  }

  getPolicy() {
    return this.repository.getPolicy();
  }

  updatePolicy(input = {}) {
    const policy = {
      deny_without_grant: bool(input.deny_without_grant, true),
      require_explicit_source_scope: bool(input.require_explicit_source_scope, true),
      allow_external_provider_customer_data: bool(input.allow_external_provider_customer_data, false),
      default_max_context_items: positiveInt(input.default_max_context_items, 12),
      protected_source_types: Array.isArray(input.protected_source_types)
        ? input.protected_source_types.filter((sourceType) => SOURCE_TYPES.has(sourceType))
        : undefined,
    };
    return this.repository.savePolicy(removeUndefined(policy));
  }

  preflight(input = {}) {
    const request = normalizePreflightInput(input);
    const policy = this.repository.getPolicy();
    const decision = decideAccess({ request, policy, grants: this.repository.listGrants() }, this.now());
    const auditEvent = this.repository.addAuditEvent({
      audit_event_id: createId("ai_ctx_audit"),
      occurred_at: this.now().toISOString(),
      account_id: request.account_id,
      project_id: request.project_id,
      actor_id: request.actor_id,
      actor_role: request.actor_role,
      source_type: request.source_type,
      source_scope: request.source_scope,
      purpose: request.purpose,
      provider: request.provider,
      model: request.model,
      grant_id: decision.grant?.grant_id || null,
      access_decision: decision.allowed ? "allowed" : "denied",
      rejection_reason: decision.allowed ? null : decision.reason,
      redaction_level: decision.redaction_level || null,
      allowed_context_items: decision.allowed_context_items || 0,
    });
    return {
      allowed: decision.allowed,
      reason: decision.reason,
      grant: decision.grant || null,
      redaction_level: decision.redaction_level || null,
      allowed_context_items: decision.allowed_context_items || 0,
      audit_event_id: auditEvent.audit_event_id,
    };
  }

  listAuditEvents(filter = {}) {
    return this.repository.listAuditEvents(filter);
  }

  sqliteSummary() {
    if (typeof this.repository.sqliteSummary === "function") {
      return this.repository.sqliteSummary();
    }
    return {
      available: false,
      reason: "sqlite_repository_not_enabled",
      tables: [],
      service_documents: [],
    };
  }
}

function decideAccess({ request, policy, grants }, now) {
  if (!SOURCE_TYPES.has(request.source_type)) return deny("unknown_source_type");
  if (!PURPOSES.has(request.purpose)) return deny("unknown_purpose");
  if (policy.require_explicit_source_scope && !request.source_scope) return deny("missing_source_scope");

  const matchingGrant = grants.find((grant) => grantMatchesRequest(grant, request, now));
  if (!matchingGrant) return deny("missing_valid_grant");

  if (request.provider !== "ollama" && matchingGrant.allowed_provider_scope === "local_only") {
    return deny("external_provider_not_allowed_by_grant");
  }
  if (request.provider !== "ollama" && matchingGrant.allowed_provider_scope === "external_redacted_only" && matchingGrant.redaction_level === "none") {
    return deny("external_provider_requires_redaction");
  }
  if (request.provider !== "ollama" && request.source_type === "customer_data" && !policy.allow_external_provider_customer_data) {
    return deny("external_provider_customer_data_blocked_by_policy");
  }

  return {
    allowed: true,
    reason: "valid_grant",
    grant: matchingGrant,
    redaction_level: matchingGrant.redaction_level,
    allowed_context_items: matchingGrant.max_context_items || policy.default_max_context_items,
  };
}

function grantMatchesRequest(grant, request, now) {
  if (!isGrantActive(grant, now)) return false;
  if (grant.account_id !== "*" && grant.account_id !== request.account_id) return false;
  if (grant.project_id && request.project_id && grant.project_id !== request.project_id) return false;
  if (grant.source_type !== request.source_type) return false;
  if (grant.purpose !== request.purpose) return false;
  return scopeIncludes(grant.source_scope, request.source_scope);
}

function scopeIncludes(grantScope, requestScope) {
  if (grantScope === "*") return true;
  if (!requestScope) return false;
  if (grantScope === requestScope) return true;
  return requestScope.startsWith(`${grantScope}/`);
}

function validateGrantInput(input) {
  for (const field of ["account_id", "source_type", "source_scope", "purpose", "valid_until"]) {
    if (!clean(input[field])) throw new AiContextError("missing_required_field", `Pflichtfeld fehlt: ${field}`);
  }
  if (!SOURCE_TYPES.has(clean(input.source_type))) throw new AiContextError("invalid_source_type", "Unbekannte Kontextquelle.");
  if (!PURPOSES.has(clean(input.purpose))) throw new AiContextError("invalid_purpose", "Unbekannter KI-Kontextzweck.");
  if (!PROVIDER_SCOPES.has(clean(input.allowed_provider_scope || "local_only"))) throw new AiContextError("invalid_provider_scope", "Unbekannter Provider-Scope.");
  if (!REDACTION_LEVELS.has(clean(input.redaction_level || "summary_only"))) throw new AiContextError("invalid_redaction_level", "Unbekannte Redaktionsstufe.");
}

function validateSourceInput(input) {
  for (const field of ["source_id", "source_type", "source_scope", "title", "backing_service", "endpoint"]) {
    if (!clean(input[field])) throw new AiContextError("missing_required_field", `Pflichtfeld fehlt: ${field}`);
  }
  if (!SOURCE_TYPES.has(clean(input.source_type))) throw new AiContextError("invalid_source_type", "Unbekannte Kontextquelle.");
  if (!REDACTION_LEVELS.has(clean(input.default_redaction_level || "summary_only"))) throw new AiContextError("invalid_redaction_level", "Unbekannte Redaktionsstufe.");
  if (!PROVIDER_SCOPES.has(clean(input.default_provider_scope || "local_only"))) throw new AiContextError("invalid_provider_scope", "Unbekannter Provider-Scope.");
}

function validatePromptFoundationInput(input) {
  for (const field of ["foundation_id", "title", "route_task", "source_scope", "content"]) {
    if (!clean(input[field])) throw new AiContextError("missing_required_field", `Pflichtfeld fehlt: ${field}`);
  }
  if (clean(input.content_kind || "system_prompt") !== "system_prompt") {
    throw new AiContextError("invalid_content_kind", "Unbekannte Prompt-Grundlagen-Art.");
  }
  if (!["active", "draft", "archived"].includes(clean(input.status || "active"))) {
    throw new AiContextError("invalid_status", "Unbekannter Prompt-Grundlagen-Status.");
  }
}

function normalizePreflightInput(input) {
  for (const field of ["account_id", "source_type", "purpose", "provider"]) {
    if (!clean(input[field])) throw new AiContextError("missing_required_field", `Pflichtfeld fehlt: ${field}`);
  }
  return {
    account_id: clean(input.account_id),
    project_id: clean(input.project_id),
    actor_id: clean(input.actor_id || input.account_id),
    actor_role: clean(input.actor_role || "account_owner"),
    source_type: clean(input.source_type),
    source_scope: normalizeScope(input.source_scope),
    purpose: clean(input.purpose),
    provider: clean(input.provider),
    model: clean(input.model),
  };
}

function assertValidGrantWindow(grant) {
  if (new Date(grant.valid_until).getTime() <= new Date(grant.valid_from).getTime()) {
    throw new AiContextError("invalid_validity_window", "valid_until muss nach valid_from liegen.");
  }
}

function deny(reason) {
  return { allowed: false, reason };
}

function clean(value) {
  return String(value || "").trim();
}

function normalizeScope(value) {
  const scope = clean(value);
  return scope.replace(/\\/g, "/").replace(/\/+/g, "/");
}

function positiveInt(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : fallback;
}

function bool(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function removeUndefined(input) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

module.exports = { AiContextService, decideAccess };
