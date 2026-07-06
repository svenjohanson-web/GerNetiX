const { SqliteStateStore, jsonColumn } = require("../../../shared");
const { InMemoryCommunityAiRepository } = require("./in-memory-community-ai-repository");

class SqliteBackedCommunityAiRepository extends InMemoryCommunityAiRepository {
  constructor(store) {
    super(store.load());
    this.store = store;
    this.store.ensureSchema?.(communityAiSchema());
  }

  static create(sqlitePath) {
    return new SqliteBackedCommunityAiRepository(new SqliteStateStore(sqlitePath, "community-ai-assistant", {
      defaultState: { queries: [], config: null },
      collectionMap: {
        queries: "queries",
      },
    }));
  }

  saveQuery(query) {
    const result = super.saveQuery(query);
    this.persist();
    return result;
  }

  saveConfig(config) {
    const result = super.saveConfig(config);
    this.persist();
    return result;
  }

  persist() {
    const state = {
      queries: Array.from(this.queries.values()),
      config: this.config,
    };
    this.store.save(state);
    this.store.replaceCollection?.("queries", state.queries, "query_id");
    if (typeof this.store.replaceTable === "function") {
      this.store.replaceTable("community_ai_queries", state.queries, queryColumns());
      this.store.replaceTable("community_ai_config", [{ config_id: "default", ...state.config }], configColumns());
    }
  }
}

function communityAiSchema() {
  return [
    `CREATE TABLE IF NOT EXISTS community_ai_queries (query_id TEXT PRIMARY KEY, account_id TEXT, project_id TEXT, question TEXT, answer TEXT, status TEXT, rejection_reason TEXT, source_documents_json TEXT, usage_event_id TEXT, created_at TEXT, updated_at TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS community_ai_config (config_id TEXT PRIMARY KEY, assistant_enabled INTEGER, allowed_source_types_json TEXT, require_verified_sources INTEGER, max_sources INTEGER, moderation_blocklist_json TEXT, raw_json TEXT NOT NULL);`,
  ];
}

function queryColumns() {
  return { query_id: "query_id", account_id: "account_id", project_id: "project_id", question: "question", answer: "answer", status: "status", rejection_reason: "rejection_reason", source_documents_json: jsonColumn("source_documents"), usage_event_id: "usage_event_id", created_at: "created_at", updated_at: "updated_at", raw_json: jsonColumn((row) => row) };
}

function configColumns() {
  return { config_id: "config_id", assistant_enabled: (row) => row.assistant_enabled ? 1 : 0, allowed_source_types_json: jsonColumn("allowed_source_types"), require_verified_sources: (row) => row.require_verified_sources ? 1 : 0, max_sources: "max_sources", moderation_blocklist_json: jsonColumn("moderation_blocklist"), raw_json: jsonColumn((row) => row) };
}

module.exports = { SqliteBackedCommunityAiRepository };
