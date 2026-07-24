"use strict";

class PostgresProjectRepository {
  constructor(pool, clock = () => new Date()) {
    this.pool = pool;
    this.clock = clock;
  }

  static async create(options = {}, clock = () => new Date()) {
    const { Pool } = require("pg");
    const pool = options.pool || new Pool(options.poolOptions || options);
    const repository = new PostgresProjectRepository(pool, clock);
    await repository.ensureSchema();
    return repository;
  }

  async ensureSchema() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS project_projects (
        project_id text PRIMARY KEY,
        user_id text NOT NULL,
        status text NOT NULL,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_project_projects_user_id
        ON project_projects (user_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS project_sources (
        project_id text NOT NULL REFERENCES project_projects(project_id) ON DELETE CASCADE,
        path text NOT NULL,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL,
        PRIMARY KEY (project_id, path)
      );

      CREATE TABLE IF NOT EXISTS project_build_jobs (
        build_job_id text PRIMARY KEY,
        project_id text NOT NULL REFERENCES project_projects(project_id) ON DELETE CASCADE,
        user_id text NOT NULL,
        status text NOT NULL,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_project_build_jobs_project
        ON project_build_jobs (project_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_project_build_jobs_user
        ON project_build_jobs (user_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS project_artifacts (
        artifact_id text PRIMARY KEY,
        project_id text NOT NULL REFERENCES project_projects(project_id) ON DELETE CASCADE,
        build_job_id text NOT NULL,
        raw_json jsonb NOT NULL,
        created_at timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_project_artifacts_project
        ON project_artifacts (project_id);
      CREATE INDEX IF NOT EXISTS idx_project_artifacts_build_job
        ON project_artifacts (build_job_id);

      CREATE TABLE IF NOT EXISTS project_feedback (
        feedback_id text PRIMARY KEY,
        project_id text NOT NULL REFERENCES project_projects(project_id) ON DELETE CASCADE,
        user_id text NOT NULL,
        raw_json jsonb NOT NULL,
        created_at timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_project_feedback_project
        ON project_feedback (project_id);
      CREATE INDEX IF NOT EXISTS idx_project_feedback_user
        ON project_feedback (user_id);

      CREATE TABLE IF NOT EXISTS project_consents (
        consent_id text PRIMARY KEY,
        feedback_id text NOT NULL REFERENCES project_feedback(feedback_id) ON DELETE CASCADE,
        user_id text NOT NULL,
        revoked_at timestamptz,
        raw_json jsonb NOT NULL,
        created_at timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_project_consents_feedback
        ON project_consents (feedback_id);

      CREATE TABLE IF NOT EXISTS project_resource_policies (
        plan_id text PRIMARY KEY,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL
      );

      CREATE TABLE IF NOT EXISTS project_migrations (
        migration_id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );
    `);
  }

  async saveProject(project) {
    await this.pool.query(`
      INSERT INTO project_projects (project_id, user_id, status, raw_json, updated_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (project_id) DO UPDATE SET
        user_id=EXCLUDED.user_id,
        status=EXCLUDED.status,
        raw_json=EXCLUDED.raw_json,
        updated_at=EXCLUDED.updated_at
    `, [project.project_id, project.user_id, project.status, project, project.updated_at]);
    return clone(project);
  }

  async findProject(projectId) {
    return first(await this.pool.query(
      "SELECT raw_json FROM project_projects WHERE project_id=$1",
      [projectId],
    ));
  }

  async listProjects(filter = {}) {
    const result = filter.user_id
      ? await this.pool.query(
          "SELECT raw_json FROM project_projects WHERE user_id=$1 ORDER BY updated_at DESC",
          [filter.user_id],
        )
      : await this.pool.query("SELECT raw_json FROM project_projects ORDER BY updated_at DESC");
    return rows(result);
  }

  async saveSource(source) {
    await this.pool.query(`
      INSERT INTO project_sources (project_id, path, raw_json, updated_at)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (project_id, path) DO UPDATE SET
        raw_json=EXCLUDED.raw_json,
        updated_at=EXCLUDED.updated_at
    `, [source.project_id, source.path, source, source.updated_at]);
    return clone(source);
  }

  async findSource(projectId, sourcePath) {
    return first(await this.pool.query(
      "SELECT raw_json FROM project_sources WHERE project_id=$1 AND path=$2",
      [projectId, sourcePath],
    ));
  }

  async listSources(projectId) {
    return rows(await this.pool.query(
      "SELECT raw_json FROM project_sources WHERE project_id=$1 ORDER BY path",
      [projectId],
    ));
  }

  async saveBuildJob(job) {
    await this.pool.query(`
      INSERT INTO project_build_jobs
        (build_job_id, project_id, user_id, status, raw_json, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (build_job_id) DO UPDATE SET
        project_id=EXCLUDED.project_id,
        user_id=EXCLUDED.user_id,
        status=EXCLUDED.status,
        raw_json=EXCLUDED.raw_json,
        updated_at=EXCLUDED.updated_at
    `, [job.build_job_id, job.project_id, job.user_id, job.status, job, job.updated_at]);
    return clone(job);
  }

  async findBuildJob(jobId) {
    return first(await this.pool.query(
      "SELECT raw_json FROM project_build_jobs WHERE build_job_id=$1",
      [jobId],
    ));
  }

  async listBuildJobs(filter = {}) {
    const conditions = [];
    const values = [];
    if (filter.project_id) {
      values.push(filter.project_id);
      conditions.push(`project_id=$${values.length}`);
    }
    if (filter.user_id) {
      values.push(filter.user_id);
      conditions.push(`user_id=$${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    return rows(await this.pool.query(
      `SELECT raw_json FROM project_build_jobs ${where} ORDER BY updated_at DESC`,
      values,
    ));
  }

  async saveArtifact(artifact) {
    await this.pool.query(`
      INSERT INTO project_artifacts
        (artifact_id, project_id, build_job_id, raw_json, created_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (artifact_id) DO UPDATE SET raw_json=EXCLUDED.raw_json
    `, [
      artifact.artifact_id,
      artifact.project_id,
      artifact.build_job_id,
      artifact,
      artifact.created_at,
    ]);
    return clone(artifact);
  }

  async listArtifacts(filter = {}) {
    const conditions = [];
    const values = [];
    if (filter.project_id) {
      values.push(filter.project_id);
      conditions.push(`project_id=$${values.length}`);
    }
    if (filter.build_job_id) {
      values.push(filter.build_job_id);
      conditions.push(`build_job_id=$${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    return rows(await this.pool.query(
      `SELECT raw_json FROM project_artifacts ${where} ORDER BY created_at`,
      values,
    ));
  }

  async saveFeedback(feedback) {
    await this.pool.query(`
      INSERT INTO project_feedback
        (feedback_id, project_id, user_id, raw_json, created_at)
      VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (feedback_id) DO UPDATE SET
        user_id=EXCLUDED.user_id,
        raw_json=EXCLUDED.raw_json
    `, [
      feedback.feedback_id,
      feedback.project_id,
      feedback.user_id,
      feedback,
      feedback.created_at,
    ]);
    return clone(feedback);
  }

  async findFeedback(feedbackId) {
    return first(await this.pool.query(
      "SELECT raw_json FROM project_feedback WHERE feedback_id=$1",
      [feedbackId],
    ));
  }

  async listFeedback(filter = {}) {
    const conditions = [];
    const values = [];
    if (filter.project_id) {
      values.push(filter.project_id);
      conditions.push(`project_id=$${values.length}`);
    }
    if (filter.user_id) {
      values.push(filter.user_id);
      conditions.push(`user_id=$${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    return rows(await this.pool.query(
      `SELECT raw_json FROM project_feedback ${where} ORDER BY created_at`,
      values,
    ));
  }

  async saveConsent(consent) {
    await this.pool.query(`
      INSERT INTO project_consents
        (consent_id, feedback_id, user_id, revoked_at, raw_json, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (consent_id) DO UPDATE SET
        revoked_at=EXCLUDED.revoked_at,
        raw_json=EXCLUDED.raw_json
    `, [
      consent.consent_id,
      consent.feedback_id,
      consent.user_id,
      consent.revoked_at,
      consent,
      consent.created_at,
    ]);
    return clone(consent);
  }

  async findConsent(consentId) {
    return first(await this.pool.query(
      "SELECT raw_json FROM project_consents WHERE consent_id=$1",
      [consentId],
    ));
  }

  async findFeedbackConsent(feedbackId) {
    return first(await this.pool.query(`
      SELECT raw_json
      FROM project_consents
      WHERE feedback_id=$1 AND revoked_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `, [feedbackId]));
  }

  async listResourcePolicies() {
    return rows(await this.pool.query(
      "SELECT raw_json FROM project_resource_policies ORDER BY plan_id",
    ));
  }

  async saveResourcePolicy(policy) {
    await this.pool.query(`
      INSERT INTO project_resource_policies (plan_id, raw_json, updated_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (plan_id) DO UPDATE SET
        raw_json=EXCLUDED.raw_json,
        updated_at=EXCLUDED.updated_at
    `, [policy.plan_id, policy, policy.updated_at]);
    return clone(policy);
  }

  async deleteProject(projectId) {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const counts = {};
      for (const [key, table] of [
        ["sources", "project_sources"],
        ["build_jobs", "project_build_jobs"],
        ["artifacts", "project_artifacts"],
        ["feedback", "project_feedback"],
      ]) {
        counts[key] = Number((await client.query(
          `SELECT COUNT(*) AS count FROM ${table} WHERE project_id=$1`,
          [projectId],
        )).rows[0].count);
      }
      counts.consents = Number((await client.query(`
        SELECT COUNT(*) AS count
        FROM project_consents c
        JOIN project_feedback f ON f.feedback_id=c.feedback_id
        WHERE f.project_id=$1
      `, [projectId])).rows[0].count);
      const deleted = await client.query(
        "DELETE FROM project_projects WHERE project_id=$1 RETURNING project_id",
        [projectId],
      );
      if (!deleted.rowCount) throw new Error("PROJECT_NOT_FOUND");
      await client.query("COMMIT");
      return counts;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async hasMigration(migrationId) {
    return (await this.pool.query(
      "SELECT 1 FROM project_migrations WHERE migration_id=$1",
      [migrationId],
    )).rowCount > 0;
  }

  async importLegacyState(state, migrationId = "project-sqlite-v1") {
    if (await this.hasMigration(migrationId)) return { imported: false, reason: "already_applied" };
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const existing = Number((await client.query(
        "SELECT COUNT(*) AS count FROM project_projects",
      )).rows[0].count);
      if (existing > 0) throw new Error("PROJECT_POSTGRES_NOT_EMPTY");

      for (const project of state.projects || []) {
        await client.query(`
          INSERT INTO project_projects (project_id, user_id, status, raw_json, updated_at)
          VALUES ($1, $2, $3, $4, $5)
        `, [project.project_id, project.user_id, project.status, project, timestamp(project, "updated_at", "created_at")]);
      }
      await importSources(client, state.sources);
      await importBuildJobs(client, state.buildJobs);
      await importArtifacts(client, state.artifacts);
      await importFeedback(client, state.feedback);
      await importConsents(client, state.consents);
      await importPolicies(client, state.resourcePolicies);
      await client.query("INSERT INTO project_migrations (migration_id) VALUES ($1)", [migrationId]);
      await client.query("COMMIT");
      return {
        imported: true,
        projects: (state.projects || []).length,
        sources: (state.sources || []).length,
        build_jobs: (state.buildJobs || []).length,
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

async function importSources(client, items = []) {
  for (const item of items) {
    await client.query(`
      INSERT INTO project_sources (project_id, path, raw_json, updated_at)
      VALUES ($1, $2, $3, $4)
    `, [item.project_id, item.path, item, timestamp(item, "updated_at")]);
  }
}

async function importBuildJobs(client, items = []) {
  for (const item of items) {
    await client.query(`
      INSERT INTO project_build_jobs
        (build_job_id, project_id, user_id, status, raw_json, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [item.build_job_id, item.project_id, item.user_id, item.status, item, timestamp(item, "updated_at", "created_at")]);
  }
}

async function importArtifacts(client, items = []) {
  for (const item of items) {
    await client.query(`
      INSERT INTO project_artifacts
        (artifact_id, project_id, build_job_id, raw_json, created_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [item.artifact_id, item.project_id, item.build_job_id, item, timestamp(item, "created_at")]);
  }
}

async function importFeedback(client, items = []) {
  for (const item of items) {
    await client.query(`
      INSERT INTO project_feedback
        (feedback_id, project_id, user_id, raw_json, created_at)
      VALUES ($1, $2, $3, $4, $5)
    `, [item.feedback_id, item.project_id, item.user_id, item, timestamp(item, "created_at")]);
  }
}

async function importConsents(client, items = []) {
  for (const item of items) {
    await client.query(`
      INSERT INTO project_consents
        (consent_id, feedback_id, user_id, revoked_at, raw_json, created_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [item.consent_id, item.feedback_id, item.user_id, item.revoked_at || null, item, timestamp(item, "created_at")]);
  }
}

async function importPolicies(client, items = []) {
  for (const item of items) {
    await client.query(`
      INSERT INTO project_resource_policies (plan_id, raw_json, updated_at)
      VALUES ($1, $2, $3)
    `, [item.plan_id, item, timestamp(item, "updated_at")]);
  }
}

function timestamp(item, ...keys) {
  for (const key of keys) if (item?.[key]) return item[key];
  return new Date().toISOString();
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

module.exports = { PostgresProjectRepository };
