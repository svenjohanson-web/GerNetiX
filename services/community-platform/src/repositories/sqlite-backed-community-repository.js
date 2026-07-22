const { SqliteStateStore, jsonColumn } = require("../../../shared");
const { InMemoryCommunityRepository } = require("./in-memory-community-repository");

class SqliteBackedCommunityRepository extends InMemoryCommunityRepository {
  constructor(store) {
    super(store.load());
    this.store = store;
    this.store.ensureSchema?.(communitySchema());
  }

  static create(sqlitePath) {
    return new SqliteBackedCommunityRepository(new SqliteStateStore(sqlitePath, "community-platform", {
      defaultState: { questions: [], answers: [], knowledgeDocuments: [] },
      collectionMap: {
        questions: "questions",
        answers: "answers",
        knowledgeDocuments: "knowledge_documents",
      },
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
    const state = {
      questions: Array.from(this.questions.values()),
      answers: Array.from(this.answers.values()),
      knowledgeDocuments: Array.from(this.knowledgeDocuments.values()),
    };
    this.store.save(state);
    this.store.replaceCollection?.("questions", state.questions, "question_id");
    this.store.replaceCollection?.("answers", state.answers, "answer_id");
    this.store.replaceCollection?.("knowledge_documents", state.knowledgeDocuments, "document_id");
    if (typeof this.store.replaceTable === "function") {
      this.store.replaceTable("community_questions", state.questions, questionColumns());
      this.store.replaceTable("community_answers", state.answers, answerColumns());
      this.store.replaceTable("community_knowledge_documents", state.knowledgeDocuments, documentColumns());
    }
  }
}

function communitySchema() {
  return [
    `CREATE TABLE IF NOT EXISTS community_questions (question_id TEXT PRIMARY KEY, account_id TEXT, project_id TEXT, title TEXT, body TEXT, visibility TEXT, status TEXT, triage_status TEXT, tags_json TEXT, created_at TEXT, updated_at TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS community_answers (answer_id TEXT PRIMARY KEY, question_id TEXT, account_id TEXT, body TEXT, verification_state TEXT, visible_state TEXT, created_at TEXT, updated_at TEXT, verified_at TEXT, raw_json TEXT NOT NULL);`,
    `CREATE TABLE IF NOT EXISTS community_knowledge_documents (document_id TEXT PRIMARY KEY, source_type TEXT, source_id TEXT, title TEXT, body TEXT, verification_state TEXT, tags_json TEXT, updated_at TEXT, raw_json TEXT NOT NULL);`,
  ];
}

function questionColumns() {
  return { question_id: "question_id", account_id: "account_id", project_id: "project_id", title: "title", body: "body", visibility: "visibility", status: "status", triage_status: "triage_status", tags_json: jsonColumn("tags"), created_at: "created_at", updated_at: "updated_at", raw_json: jsonColumn((row) => row) };
}

function answerColumns() {
  return { answer_id: "answer_id", question_id: "question_id", account_id: "account_id", body: "body", verification_state: "verification_state", visible_state: "visible_state", created_at: "created_at", updated_at: "updated_at", verified_at: "verified_at", raw_json: jsonColumn((row) => row) };
}

function documentColumns() {
  return { document_id: "document_id", source_type: "source_type", source_id: "source_id", title: "title", body: "body", verification_state: "verification_state", tags_json: jsonColumn("tags"), updated_at: "updated_at", raw_json: jsonColumn((row) => row) };
}

module.exports = { SqliteBackedCommunityRepository };
