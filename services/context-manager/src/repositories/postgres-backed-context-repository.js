const { InMemoryContextRepository } = require("./in-memory-context-repository");
const { PostgresStateStore } = require("../../../shared/persistence/postgres-state-store");

class PostgresBackedContextRepository extends InMemoryContextRepository {
  static async create(options = {}) {
    const store = await PostgresStateStore.create({
      pool: options.pool,
      namespace: "context-manager",
      defaultState: defaultState(),
      encryptionKey: options.encryptionKey,
    });
    return new PostgresBackedContextRepository(store);
  }

  constructor(store) {
    super(store.load());
    this.store = store;
    this.pendingSave = Promise.resolve();
  }

  persist() {
    const snapshot = this.state();
    this.pendingSave = this.pendingSave.then(() => this.store.save(snapshot));
  }

  flush() { return this.pendingSave; }
  close() { return this.store.close(); }
}

for (const method of [
  "saveScope",
  "saveRequirementSlice",
  "saveArtifactReference",
  "saveRuntimeReference",
  "saveDecision",
  "saveEvent",
  "saveContextPack",
  "saveRedactionPolicy",
  "saveSuggestion",
]) {
  PostgresBackedContextRepository.prototype[method] = function saveAndPersist(value) {
    const result = InMemoryContextRepository.prototype[method].call(this, value);
    this.persist();
    return result;
  };
}

function defaultState() {
  return {
    scopes: [], requirementSlices: [], artifactReferences: [], runtimeReferences: [],
    decisions: [], events: [], contextPacks: [], redactionPolicies: [], suggestions: [],
  };
}

module.exports = { PostgresBackedContextRepository };
