const { SqliteSnapshotStore } = require("../../../shared");
const { InMemoryCommunityRepository } = require("./in-memory-community-repository");

class SqliteBackedCommunityRepository extends InMemoryCommunityRepository {
  constructor(store) {
    super(store.load());
    this.store = store;
  }

  static create(sqlitePath) {
    return new SqliteBackedCommunityRepository(new SqliteSnapshotStore(sqlitePath, "community-platform", {
      defaultState: { questions: [], answers: [], knowledgeDocuments: [] },
    }));
  }

  saveQuestion(question) {
    const result = super.saveQuestion(question);
    this.persist();
    return result;
  }

  saveAnswer(answer) {
    const result = super.saveAnswer(answer);
    this.persist();
    return result;
  }

  saveKnowledgeDocument(document) {
    const result = super.saveKnowledgeDocument(document);
    this.persist();
    return result;
  }

  persist() {
    this.store.save({
      questions: Array.from(this.questions.values()),
      answers: Array.from(this.answers.values()),
      knowledgeDocuments: Array.from(this.knowledgeDocuments.values()),
    });
  }
}

module.exports = { SqliteBackedCommunityRepository };
