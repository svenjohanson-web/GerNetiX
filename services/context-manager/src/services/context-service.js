const crypto = require("node:crypto");
const { ContextManagerError } = require("../errors");

const DEFAULT_SENSITIVE_KEYS = [
  "secret",
  "password",
  "password_hash",
  "token",
  "token_hash",
  "private_key",
  "pairing_code",
  "credential",
  "wifi_password",
];

class ContextService {
  constructor(options) {
    this.repository = options.repository;
  }

  currentContext(query = {}) {
    const scope = this.requireOrCreateScope(query);
    const latestPack = this.repository.listContextPacks(scope.scope_id)[0] || null;
    return {
      scope,
      requirement_slices: this.repository.listRequirementSlices(scope.scope_id),
      artifact_references: this.repository.listArtifactReferences(scope.scope_id),
      runtime_references: this.repository.listRuntimeReferences(scope.scope_id),
      decisions: this.repository.listDecisions(scope.scope_id),
      recent_events: this.repository.listEvents(scope.scope_id, Number(query.limit || 25)),
      latest_context_pack: latestPack ? packSummary(latestPack) : null,
    };
  }

  upsertScope(input = {}) {
    const now = new Date().toISOString();
    const current = input.scope_id ? this.repository.findScope(input.scope_id) : this.repository.findScopeByProject(input.account_id, input.project_id);
    const scope = {
      ...(current || {}),
      scope_id: input.scope_id || current?.scope_id || createId("context_scope"),
      account_id: input.account_id || current?.account_id || "default-account",
      project_id: input.project_id || current?.project_id || "default-project",
      title: input.title || current?.title || "Default Context",
      description: input.description ?? current?.description ?? "",
      status: input.status || current?.status || "active",
      created_at: current?.created_at || now,
      updated_at: now,
    };
    return this.repository.saveScope(scope);
  }

  upsertRequirementSlice(input = {}) {
    const scope = this.requireOrCreateScope(input);
    const now = new Date().toISOString();
    const sliceId = input.slice_id || input.id || createId("context_slice");
    const slice = {
      slice_id: sliceId,
      scope_id: scope.scope_id,
      requirement_id: input.requirement_id || "",
      slice_key: input.slice_key || input.key || sliceId,
      title: required(input.title, "title"),
      status: input.status || "open",
      summary: input.summary || "",
      implemented_by: normalizeList(input.implemented_by),
      related_artifacts: normalizeList(input.related_artifacts),
      open_points: normalizeList(input.open_points),
      evidence: normalizeList(input.evidence),
      created_at: input.created_at || now,
      updated_at: now,
    };
    return this.repository.saveRequirementSlice(slice);
  }

  upsertArtifactReference(input = {}) {
    const scope = this.requireOrCreateScope(input);
    const now = new Date().toISOString();
    const reference = {
      artifact_reference_id: input.artifact_reference_id || input.id || createId("context_artifact"),
      scope_id: scope.scope_id,
      artifact_id: input.artifact_id || "",
      artifact_type: input.artifact_type || "implementation",
      path: input.path || "",
      title: input.title || input.path || input.artifact_id || "Artifact",
      relation: input.relation || "related",
      metadata: input.metadata || {},
      created_at: input.created_at || now,
      updated_at: now,
    };
    return this.repository.saveArtifactReference(reference);
  }

  upsertRuntimeReference(input = {}) {
    const scope = this.requireOrCreateScope(input);
    const now = new Date().toISOString();
    const reference = {
      runtime_reference_id: input.runtime_reference_id || input.id || createId("context_runtime"),
      scope_id: scope.scope_id,
      reference_type: input.reference_type || "service",
      reference_id_value: input.reference_id_value || input.reference_id || "",
      title: input.title || input.reference_id_value || input.reference_id || "Runtime Reference",
      source_service: input.source_service || "",
      visibility: input.visibility || "internal",
      payload: input.payload || {},
      created_at: input.created_at || now,
      updated_at: now,
    };
    return this.repository.saveRuntimeReference(reference);
  }

  recordDecision(input = {}) {
    const scope = this.requireOrCreateScope(input);
    const now = new Date().toISOString();
    const decision = {
      decision_id: input.decision_id || input.id || createId("context_decision"),
      scope_id: scope.scope_id,
      title: required(input.title, "title"),
      status: input.status || "accepted",
      rationale: input.rationale || "",
      related_slice_ids: normalizeList(input.related_slice_ids),
      created_at: input.created_at || now,
      updated_at: now,
    };
    return this.repository.saveDecision(decision);
  }

  recordEvent(input = {}) {
    const scope = this.requireOrCreateScope(input);
    const now = new Date().toISOString();
    const event = {
      event_id: input.event_id || input.id || createId("context_event"),
      scope_id: scope.scope_id,
      event_type: input.event_type || "context.updated",
      actor_id: input.actor_id || "system",
      payload: input.payload || {},
      created_at: input.created_at || now,
      updated_at: now,
    };
    return this.repository.saveEvent(event);
  }

  createContextPack(input = {}) {
    const scope = this.requireOrCreateScope(input);
    const now = new Date().toISOString();
    const sections = normalizeList(input.include_sections || input.sections);
    const current = this.currentContext({ scope_id: scope.scope_id, limit: input.event_limit || 25 });
    const payload = this.redact(selectSections(current, sections)).payload;
    const pack = {
      pack_id: input.pack_id || input.id || createId("context_pack"),
      scope_id: scope.scope_id,
      purpose: input.purpose || "codex_context",
      sections: sections.length ? sections : ["scope", "requirement_slices", "artifact_references", "runtime_references", "decisions", "recent_events"],
      payload,
      created_at: now,
      updated_at: now,
    };
    return this.repository.saveContextPack(pack);
  }

  getContextPack(packId) {
    const pack = this.repository.findContextPack(packId);
    if (!pack) throw new ContextManagerError("context_pack_not_found", "ContextPack wurde nicht gefunden.", 404);
    return pack;
  }

  redact(input = {}) {
    return { payload: redactSensitive(input.payload ?? input, this.sensitiveKeys()) };
  }

  sensitiveKeys() {
    const policyKeys = this.repository.state().redactionPolicies.flatMap((policy) => policy.sensitive_keys || []);
    return new Set([...DEFAULT_SENSITIVE_KEYS, ...policyKeys].map((key) => String(key).toLowerCase()));
  }

  requireOrCreateScope(input = {}) {
    if (input.scope_id) {
      const scope = this.repository.findScope(input.scope_id);
      if (scope) return scope;
      return this.upsertScope(input);
    }
    const scope = this.repository.findScopeByProject(input.account_id, input.project_id);
    if (scope) return scope;
    return this.upsertScope(input);
  }
}

function selectSections(context, sections) {
  if (!sections.length) return context;
  return Object.fromEntries(sections.filter((section) => Object.hasOwn(context, section)).map((section) => [section, context[section]]));
}

function redactSensitive(value, sensitiveKeys) {
  if (Array.isArray(value)) return value.map((entry) => redactSensitive(entry, sensitiveKeys));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [
    key,
    sensitiveKeys.has(String(key).toLowerCase()) || /(secret|password|token|private_key|pairing_code|credential)/i.test(key)
      ? "[redacted]"
      : redactSensitive(entry, sensitiveKeys),
  ]));
}

function packSummary(pack) {
  return {
    pack_id: pack.pack_id,
    scope_id: pack.scope_id,
    purpose: pack.purpose,
    sections: pack.sections,
    created_at: pack.created_at,
  };
}

function createId(prefix) {
  return `${prefix}.${crypto.randomUUID()}`;
}

function required(value, field) {
  if (value === undefined || value === null || value === "") throw new ContextManagerError("missing_field", `${field} fehlt.`, 400, { field });
  return value;
}

function normalizeList(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

module.exports = { ContextService, DEFAULT_SENSITIVE_KEYS };
