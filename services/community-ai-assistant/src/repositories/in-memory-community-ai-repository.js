class InMemoryCommunityAiRepository {
  constructor(seed = {}) {
    this.queries = new Map((seed.queries || []).map((item) => [item.query_id, item]));
    this.config = seed.config || {
      assistant_enabled: true,
      allowed_source_types: ["community_answer"],
      require_verified_sources: true,
      max_sources: 5,
      moderation_blocklist: ["password dump", "private key"],
    };
  }

  saveQuery(query) {
    this.queries.set(query.query_id, query);
    return query;
  }

  listQueries(filter = {}) {
    return Array.from(this.queries.values()).filter((query) => {
      if (filter.account_id && query.account_id !== filter.account_id) return false;
      if (filter.status && query.status !== filter.status) return false;
      return true;
    });
  }

  getConfig() {
    return this.config;
  }

  saveConfig(config) {
    this.config = config;
    return this.config;
  }
}

module.exports = { InMemoryCommunityAiRepository };
