"use strict";

class PostgresCommunityRepository {
  constructor(pool) {
    this.pool = pool;
  }

  static async create(options = {}) {
    const { Pool } = require("pg");
    const pool = options.pool || new Pool(options.poolOptions || options);
    const repository = new PostgresCommunityRepository(pool);
    await repository.ensureSchema();
    return repository;
  }

  async ensureSchema() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS community_questions (
        question_id text PRIMARY KEY,
        author_user_id text NOT NULL,
        project_id text NOT NULL,
        visibility text NOT NULL,
        status text NOT NULL,
        triage_status text NOT NULL,
        raw_json jsonb NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_community_questions_author
        ON community_questions (author_user_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_community_questions_visibility
        ON community_questions (visibility, updated_at DESC);

      CREATE TABLE IF NOT EXISTS community_answers (
        answer_id text PRIMARY KEY,
        question_id text NOT NULL REFERENCES community_questions(question_id) ON DELETE CASCADE,
        author_user_id text NOT NULL,
        verification_state text NOT NULL,
        raw_json jsonb NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_community_answers_question
        ON community_answers (question_id, created_at);

      CREATE TABLE IF NOT EXISTS community_knowledge_documents (
        document_id text PRIMARY KEY,
        question_id text NOT NULL REFERENCES community_questions(question_id) ON DELETE CASCADE,
        source_type text NOT NULL,
        source_id text NOT NULL,
        verification_state text NOT NULL,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL
      );

      CREATE TABLE IF NOT EXISTS community_migrations (
        migration_id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  async saveQuestion(question) {
    await this.pool.query(`
      INSERT INTO community_questions
        (question_id, author_user_id, project_id, visibility, status, triage_status,
         raw_json, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (question_id) DO UPDATE SET
        author_user_id=EXCLUDED.author_user_id,
        project_id=EXCLUDED.project_id,
        visibility=EXCLUDED.visibility,
        status=EXCLUDED.status,
        triage_status=EXCLUDED.triage_status,
        raw_json=EXCLUDED.raw_json,
        updated_at=EXCLUDED.updated_at
    `, [
      question.question_id, question.author_user_id, question.project_id || "",
      question.visibility, question.status, question.triage_status, question,
      question.created_at, question.updated_at,
    ]);
    return clone(question);
  }

  async findQuestion(questionId) {
    return first(await this.pool.query(
      "SELECT raw_json FROM community_questions WHERE question_id=$1",
      [questionId],
    ));
  }

  async listQuestions(filter = {}) {
    const conditions = [];
    const values = [];
    for (const [column, value] of [
      ["status", filter.status],
      ["triage_status", filter.triage_status],
      ["project_id", filter.project_id],
      ["visibility", filter.visibility],
    ]) {
      if (value) {
        values.push(value);
        conditions.push(`${column}=$${values.length}`);
      }
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const items = rows(await this.pool.query(
      `SELECT raw_json FROM community_questions ${where} ORDER BY updated_at DESC`,
      values,
    ));
    return filter.tag ? items.filter((question) => question.tags.includes(filter.tag)) : items;
  }

  async saveAnswer(answer) {
    await this.pool.query(`
      INSERT INTO community_answers
        (answer_id, question_id, author_user_id, verification_state, raw_json, created_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (answer_id) DO UPDATE SET
        author_user_id=EXCLUDED.author_user_id,
        verification_state=EXCLUDED.verification_state,
        raw_json=EXCLUDED.raw_json,
        updated_at=EXCLUDED.updated_at
    `, [
      answer.answer_id, answer.question_id, answer.author_user_id,
      answer.verification_state, answer, answer.created_at, answer.updated_at,
    ]);
    return clone(answer);
  }

  async findAnswer(answerId) {
    return first(await this.pool.query(
      "SELECT raw_json FROM community_answers WHERE answer_id=$1",
      [answerId],
    ));
  }

  async listAnswers(questionId) {
    return rows(await this.pool.query(
      "SELECT raw_json FROM community_answers WHERE question_id=$1 ORDER BY created_at",
      [questionId],
    ));
  }

  async listAllAnswers() {
    return rows(await this.pool.query(
      "SELECT raw_json FROM community_answers ORDER BY created_at",
    ));
  }

  async saveKnowledgeDocument(document) {
    await this.pool.query(`
      INSERT INTO community_knowledge_documents
        (document_id, question_id, source_type, source_id, verification_state, raw_json, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      ON CONFLICT (document_id) DO UPDATE SET
        verification_state=EXCLUDED.verification_state,
        raw_json=EXCLUDED.raw_json,
        updated_at=EXCLUDED.updated_at
    `, [
      document.document_id, document.question_id, document.source_type,
      document.source_id, document.verification_state, document,
      document.indexed_at || new Date().toISOString(),
    ]);
    return clone(document);
  }

  async listKnowledgeDocuments(filter = {}) {
    const result = rows(await this.pool.query(
      "SELECT raw_json FROM community_knowledge_documents ORDER BY updated_at DESC",
    ));
    return result
      .filter((item) => !filter.source_type || item.source_type === filter.source_type)
      .filter((item) => !filter.verification_state || item.verification_state === filter.verification_state);
  }

  async hasMigration(migrationId) {
    return (await this.pool.query(
      "SELECT 1 FROM community_migrations WHERE migration_id=$1",
      [migrationId],
    )).rowCount > 0;
  }

  async importLegacyState(state, migrationId = "community-sqlite-v1") {
    if (await this.hasMigration(migrationId)) return { imported: false, reason: "already_applied" };
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const count = await client.query("SELECT count(*) AS count FROM community_questions");
      if (Number(count.rows[0].count) > 0) throw new Error("COMMUNITY_POSTGRES_NOT_EMPTY");
      const transactionRepository = new PostgresCommunityRepository(client);
      for (const item of state.questions || []) await transactionRepository.saveQuestion(item);
      for (const item of state.answers || []) await transactionRepository.saveAnswer(item);
      for (const item of state.knowledgeDocuments || []) await transactionRepository.saveKnowledgeDocument(item);
      await client.query("INSERT INTO community_migrations (migration_id) VALUES ($1)", [migrationId]);
      await client.query("COMMIT");
      return {
        imported: true,
        questions: (state.questions || []).length,
        answers: (state.answers || []).length,
        knowledge_documents: (state.knowledgeDocuments || []).length,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async close() {
    await this.pool.end();
  }
}

function first(result) {
  return result.rows[0] ? clone(result.rows[0].raw_json) : null;
}
function rows(result) {
  return result.rows.map((row) => clone(row.raw_json));
}
function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

module.exports = { PostgresCommunityRepository };
