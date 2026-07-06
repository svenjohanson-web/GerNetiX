const { SqliteSnapshotStore } = require("../../../shared");
const { InMemoryCommunityAiRepository } = require("./in-memory-community-ai-repository");

class SqliteBackedCommunityAiRepository extends InMemoryCommunityAiRepository {
  constructor(store) {
    super(store.load());
    this.store = store;
  }

  static create(sqlitePath) {
    return new SqliteBackedCommunityAiRepository(new SqliteSnapshotStore(sqlitePath, "community-ai-assistant", {
      defaultState: { queries: [], config: null },
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
    this.store.save({
      queries: Array.from(this.queries.values()),
      config: this.config,
    });
  }
}

module.exports = { SqliteBackedCommunityAiRepository };
