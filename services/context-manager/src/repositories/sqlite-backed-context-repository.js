const { SqliteStateStore, jsonColumn } = require("../../../shared");
const { InMemoryContextRepository } = require("./in-memory-context-repository");

class SqliteBackedContextRepository extends InMemoryContextRepository {
  constructor(store) {
    super(store.load());
    this.store = store;
    this.store.ensureSchema?.(contextManagerSchema());
  }

  static create(sqlitePath) {
    return new SqliteBackedContextRepository(new SqliteStateStore(sqlitePath, "context-manager", {
      defaultState: defaultState(),
      collectionMap: {
        scopes: "context_scopes",
        requirementSlices: "context_requirement_slices",
        artifactReferences: "context_artifact_references",
        runtimeReferences: "context_runtime_references",
        decisions: "context_decisions",
        events: "context_events",
        contextPacks: "context_packs",
        redactionPolicies: "context_redaction_policies",
      },
    }));
  }

  saveScope(scope) {
    const result = super.saveScope(scope);
    this.persist();
    return result;
  }

  saveRequirementSlice(slice) {
    const result = super.saveRequirementSlice(slice);
    this.persist();
    return result;
  }

  saveArtifactReference(reference) {
    const result = super.saveArtifactReference(reference);
    this.persist();
    return result;
  }

  saveRuntimeReference(reference) {
    const result = super.saveRuntimeReference(reference);
    this.persist();
    return result;
  }

  saveDecision(decision) {
    const result = super.saveDecision(decision);
    this.persist();
    return result;
  }

  saveEvent(event) {
    const result = super.saveEvent(event);
    this.persist();
    return result;
  }

  saveContextPack(pack) {
    const result = super.saveContextPack(pack);
    this.persist();
    return result;
  }

  saveRedactionPolicy(policy) {
    const result = super.saveRedactionPolicy(policy);
    this.persist();
    return result;
  }

  persist() {
    const state = this.state();
    this.store.save(state);
    this.store.replaceCollection?.("context_scopes", state.scopes, "scope_id");
    this.store.replaceCollection?.("context_requirement_slices", state.requirementSlices, "slice_id");
    this.store.replaceCollection?.("context_artifact_references", state.artifactReferences, "artifact_reference_id");
    this.store.replaceCollection?.("context_runtime_references", state.runtimeReferences, "runtime_reference_id");
    this.store.replaceCollection?.("context_decisions", state.decisions, "decision_id");
    this.store.replaceCollection?.("context_events", state.events, "event_id");
    this.store.replaceCollection?.("context_packs", state.contextPacks, "pack_id");
    this.store.replaceCollection?.("context_redaction_policies", state.redactionPolicies, "policy_id");
    if (typeof this.store.replaceTable === "function") {
      this.store.replaceTable("context_scopes", state.scopes, scopeColumns());
      this.store.replaceTable("context_requirement_slices", state.requirementSlices, sliceColumns());
      this.store.replaceTable("context_artifact_references", state.artifactReferences, artifactColumns());
      this.store.replaceTable("context_runtime_references", state.runtimeReferences, runtimeColumns());
      this.store.replaceTable("context_decisions", state.decisions, decisionColumns());
      this.store.replaceTable("context_events", state.events, eventColumns());
      this.store.replaceTable("context_packs", state.contextPacks, packColumns());
      this.store.replaceTable("context_redaction_policies", state.redactionPolicies, policyColumns());
    }
  }
}

function defaultState() {
  return {
    scopes: [],
    requirementSlices: [],
    artifactReferences: [],
    runtimeReferences: [],
    decisions: [],
    events: [],
    contextPacks: [],
    redactionPolicies: [],
  };
}

function contextManagerSchema() {
  return [
    `CREATE TABLE IF NOT EXISTS context_scopes (scope_id TEXT PRIMARY KEY, account_id TEXT, project_id TEXT, title TEXT, description TEXT, status TEXT, created_at TEXT, updated_at TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS context_requirement_slices (slice_id TEXT PRIMARY KEY, scope_id TEXT NOT NULL, requirement_id TEXT, slice_key TEXT, title TEXT, status TEXT, implemented_by_json TEXT, related_artifacts_json TEXT, open_points_json TEXT, evidence_json TEXT, created_at TEXT, updated_at TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS context_artifact_references (artifact_reference_id TEXT PRIMARY KEY, scope_id TEXT NOT NULL, artifact_id TEXT, artifact_type TEXT, path TEXT, title TEXT, relation TEXT, metadata_json TEXT, created_at TEXT, updated_at TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS context_runtime_references (runtime_reference_id TEXT PRIMARY KEY, scope_id TEXT NOT NULL, reference_type TEXT, reference_id_value TEXT, title TEXT, source_service TEXT, visibility TEXT, payload_json TEXT, created_at TEXT, updated_at TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS context_decisions (decision_id TEXT PRIMARY KEY, scope_id TEXT NOT NULL, title TEXT, status TEXT, rationale TEXT, related_slice_ids_json TEXT, created_at TEXT, updated_at TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS context_events (event_id TEXT PRIMARY KEY, scope_id TEXT NOT NULL, event_type TEXT, actor_id TEXT, payload_json TEXT, created_at TEXT, updated_at TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS context_packs (pack_id TEXT PRIMARY KEY, scope_id TEXT NOT NULL, purpose TEXT, sections_json TEXT, payload_json TEXT, created_at TEXT, updated_at TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS context_redaction_policies (policy_id TEXT PRIMARY KEY, scope_id TEXT, title TEXT, sensitive_keys_json TEXT, replacement TEXT, created_at TEXT, updated_at TEXT, raw_json TEXT NOT NULL);`,
  ];
}

function columns(names) {
  return Object.fromEntries(names.map((name) => [name, name]));
}

function scopeColumns() {
  return { ...columns(["scope_id", "account_id", "project_id", "title", "description", "status", "created_at", "updated_at"]), raw_json: jsonColumn((row) => row) };
}

function sliceColumns() {
  return { ...columns(["slice_id", "scope_id", "requirement_id", "slice_key", "title", "status", "created_at", "updated_at"]), implemented_by_json: jsonColumn("implemented_by"), related_artifacts_json: jsonColumn("related_artifacts"), open_points_json: jsonColumn("open_points"), evidence_json: jsonColumn("evidence"), raw_json: jsonColumn((row) => row) };
}

function artifactColumns() {
  return { ...columns(["artifact_reference_id", "scope_id", "artifact_id", "artifact_type", "path", "title", "relation", "created_at", "updated_at"]), metadata_json: jsonColumn("metadata"), raw_json: jsonColumn((row) => row) };
}

function runtimeColumns() {
  return { ...columns(["runtime_reference_id", "scope_id", "reference_type", "reference_id_value", "title", "source_service", "visibility", "created_at", "updated_at"]), payload_json: jsonColumn("payload"), raw_json: jsonColumn((row) => row) };
}

function decisionColumns() {
  return { ...columns(["decision_id", "scope_id", "title", "status", "rationale", "created_at", "updated_at"]), related_slice_ids_json: jsonColumn("related_slice_ids"), raw_json: jsonColumn((row) => row) };
}

function eventColumns() {
  return { ...columns(["event_id", "scope_id", "event_type", "actor_id", "created_at", "updated_at"]), payload_json: jsonColumn("payload"), raw_json: jsonColumn((row) => row) };
}

function packColumns() {
  return { ...columns(["pack_id", "scope_id", "purpose", "created_at", "updated_at"]), sections_json: jsonColumn("sections"), payload_json: jsonColumn("payload"), raw_json: jsonColumn((row) => row) };
}

function policyColumns() {
  return { ...columns(["policy_id", "scope_id", "title", "replacement", "created_at", "updated_at"]), sensitive_keys_json: jsonColumn("sensitive_keys"), raw_json: jsonColumn((row) => row) };
}

module.exports = { SqliteBackedContextRepository };
