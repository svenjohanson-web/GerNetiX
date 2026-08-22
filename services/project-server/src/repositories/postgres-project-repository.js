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
        repository_provider text,
        repository_name text,
        repository_id text,
        repository_state text,
        default_branch text,
        head_sha text,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL
      );
      ALTER TABLE project_projects ADD COLUMN IF NOT EXISTS repository_provider text;
      ALTER TABLE project_projects ADD COLUMN IF NOT EXISTS repository_name text;
      ALTER TABLE project_projects ADD COLUMN IF NOT EXISTS repository_id text;
      ALTER TABLE project_projects ADD COLUMN IF NOT EXISTS repository_state text;
      ALTER TABLE project_projects ADD COLUMN IF NOT EXISTS default_branch text;
      ALTER TABLE project_projects ADD COLUMN IF NOT EXISTS head_sha text;
      CREATE INDEX IF NOT EXISTS idx_project_projects_user_id
        ON project_projects (user_id, updated_at DESC);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_project_projects_repository
        ON project_projects (repository_provider, repository_name)
        WHERE repository_provider IS NOT NULL AND repository_name IS NOT NULL;

      CREATE TABLE IF NOT EXISTS project_build_jobs (
        build_job_id text PRIMARY KEY,
        project_id text NOT NULL REFERENCES project_projects(project_id) ON DELETE CASCADE,
        user_id text NOT NULL,
        repository_id text,
        commit_sha text,
        status text NOT NULL,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL
      );
      ALTER TABLE project_build_jobs ADD COLUMN IF NOT EXISTS repository_id text;
      ALTER TABLE project_build_jobs ADD COLUMN IF NOT EXISTS commit_sha text;
      CREATE INDEX IF NOT EXISTS idx_project_build_jobs_project
        ON project_build_jobs (project_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_project_build_jobs_user
        ON project_build_jobs (user_id, updated_at DESC);
      CREATE INDEX IF NOT EXISTS idx_project_build_jobs_commit
        ON project_build_jobs (repository_id, commit_sha)
        WHERE repository_id IS NOT NULL AND commit_sha IS NOT NULL;

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

      CREATE TABLE IF NOT EXISTS project_template_feedback (
        feedback_id text PRIMARY KEY,
        template_id text NOT NULL,
        user_id text NOT NULL,
        category text NOT NULL,
        raw_json jsonb NOT NULL,
        created_at timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_project_template_feedback_template
        ON project_template_feedback (template_id, created_at DESC);

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

      CREATE TABLE IF NOT EXISTS project_learning_progress (
        project_id text PRIMARY KEY REFERENCES project_projects(project_id) ON DELETE CASCADE,
        user_id text NOT NULL,
        status text NOT NULL,
        current_lesson_id text NOT NULL DEFAULT '',
        current_step_id text NOT NULL DEFAULT '',
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_project_learning_progress_user
        ON project_learning_progress (user_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS project_resource_policies (
        plan_id text PRIMARY KEY,
        raw_json jsonb NOT NULL,
        updated_at timestamptz NOT NULL
      );

      CREATE TABLE IF NOT EXISTS project_versions (
        version_id text PRIMARY KEY,
        project_id text NOT NULL REFERENCES project_projects(project_id) ON DELETE CASCADE,
        parent_version_id text,
        created_by_user_id text,
        state text NOT NULL,
        snapshot_sha256 text,
        includes_binary boolean NOT NULL DEFAULT false,
        created_at timestamptz NOT NULL,
        raw_json jsonb NOT NULL
      );
      ALTER TABLE project_versions ADD COLUMN IF NOT EXISTS parent_version_id text;
      ALTER TABLE project_versions ADD COLUMN IF NOT EXISTS created_by_user_id text;
      ALTER TABLE project_versions ADD COLUMN IF NOT EXISTS snapshot_sha256 text;
      ALTER TABLE project_versions ADD COLUMN IF NOT EXISTS includes_binary boolean NOT NULL DEFAULT false;
      CREATE INDEX IF NOT EXISTS idx_project_versions_project
        ON project_versions (project_id, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_project_versions_parent
        ON project_versions (parent_version_id);
      CREATE INDEX IF NOT EXISTS idx_project_versions_snapshot
        ON project_versions (project_id, snapshot_sha256);

      CREATE TABLE IF NOT EXISTS project_app_settings (
        project_id text NOT NULL REFERENCES project_projects(project_id) ON DELETE CASCADE,
        account_id text NOT NULL,
        manifest_version integer NOT NULL,
        revision integer NOT NULL,
        raw_json jsonb NOT NULL,
        created_at timestamptz NOT NULL,
        updated_at timestamptz NOT NULL,
        PRIMARY KEY (project_id, account_id)
      );
      CREATE INDEX IF NOT EXISTS idx_project_app_settings_account
        ON project_app_settings (account_id, updated_at DESC);

      CREATE TABLE IF NOT EXISTS project_migrations (
        migration_id text PRIMARY KEY,
        applied_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS project_repository_migrations (
        project_id text PRIMARY KEY REFERENCES project_projects(project_id) ON DELETE CASCADE,
        source_sha256 text NOT NULL,
        report_sha256 text NOT NULL,
        target_repository_id text,
        target_head_sha text,
        source_file_count integer NOT NULL,
        source_version_count integer NOT NULL,
        target_commit_count integer NOT NULL,
        status text NOT NULL,
        error_code text,
        started_at timestamptz NOT NULL,
        completed_at timestamptz,
        updated_at timestamptz NOT NULL
      );

      CREATE OR REPLACE FUNCTION gernetix_reject_project_version_snapshot()
      RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN
        IF NEW.raw_json ?| ARRAY['sources', 'source_snapshot', 'project_snapshot'] THEN
          RAISE EXCEPTION 'PROJECT_SQL_VERSION_SNAPSHOT_FORBIDDEN' USING ERRCODE = 'integrity_constraint_violation';
        END IF;
        RETURN NEW;
      END $$;
      DROP TRIGGER IF EXISTS project_versions_snapshot_forbidden ON project_versions;
      CREATE TRIGGER project_versions_snapshot_forbidden
        BEFORE INSERT OR UPDATE ON project_versions
        FOR EACH ROW EXECUTE FUNCTION gernetix_reject_project_version_snapshot();
    `);
  }

  async saveProject(project) {
    assertNoProjectFilePayload(project, "PROJECT_SQL_PROJECT_PAYLOAD_FORBIDDEN");
    const binding = project.repository_binding || {};
    await this.pool.query(`
      INSERT INTO project_projects
        (project_id, user_id, status, repository_provider, repository_name,
         repository_id, repository_state, default_branch, head_sha, raw_json, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      ON CONFLICT (project_id) DO UPDATE SET
        user_id=EXCLUDED.user_id,
        status=EXCLUDED.status,
        repository_provider=EXCLUDED.repository_provider,
        repository_name=EXCLUDED.repository_name,
        repository_id=EXCLUDED.repository_id,
        repository_state=EXCLUDED.repository_state,
        default_branch=EXCLUDED.default_branch,
        head_sha=EXCLUDED.head_sha,
        raw_json=EXCLUDED.raw_json,
        updated_at=EXCLUDED.updated_at
    `, [
      project.project_id,
      project.user_id,
      project.status,
      binding.provider || null,
      binding.repository_name || null,
      binding.repository_id || null,
      binding.state || null,
      binding.default_branch || null,
      binding.head_sha || null,
      project,
      project.updated_at,
    ]);
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

  async listProjectSummaries(filter = {}) {
    const values = [];
    const where = filter.user_id ? "WHERE p.user_id=$1" : "";
    if (filter.user_id) values.push(filter.user_id);
    const result = await this.pool.query(`
      SELECT
        p.project_id,
        p.user_id,
        p.status,
        p.raw_json->>'plan_id' AS plan_id,
        p.raw_json->>'title' AS title,
        p.raw_json->>'description' AS description,
        p.raw_json->>'learning_project_id' AS learning_project_id,
        p.raw_json#>>'{view_manifest,entry_mode}' AS entry_mode,
        p.raw_json->>'hardware_profile_id' AS hardware_profile_id,
        p.raw_json->>'device_id' AS device_id,
        COALESCE(p.raw_json->'device_ids', '[]'::jsonb) AS device_ids,
        p.raw_json->>'created_at' AS created_at,
        p.raw_json->>'updated_at' AS updated_at,
        false AS has_project_app
      FROM project_projects p
      ${where}
      ORDER BY p.updated_at DESC
    `, values);
    return result.rows.map((row) => ({ ...row, device_ids: row.device_ids || [] }));
  }

  async saveSource(source) {
    void source;
    throw new Error("PROJECT_SQL_SOURCE_WRITE_FORBIDDEN");
  }

  async findSource(projectId, sourcePath) {
    void projectId;
    void sourcePath;
    throw new Error("PROJECT_SQL_SOURCE_READ_FORBIDDEN");
  }

  async listSources(projectId) {
    void projectId;
    throw new Error("PROJECT_SQL_SOURCE_READ_FORBIDDEN");
  }

  async deleteSource(projectId, sourcePath) {
    void projectId;
    void sourcePath;
    throw new Error("PROJECT_SQL_SOURCE_WRITE_FORBIDDEN");
  }

  async saveBuildJob(job) {
    assertNoProjectFilePayload(job, "PROJECT_SQL_BUILD_PAYLOAD_FORBIDDEN");
    await this.pool.query(`
      INSERT INTO project_build_jobs
        (build_job_id, project_id, user_id, repository_id, commit_sha, status, raw_json, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      ON CONFLICT (build_job_id) DO UPDATE SET
        project_id=EXCLUDED.project_id,
        user_id=EXCLUDED.user_id,
        repository_id=EXCLUDED.repository_id,
        commit_sha=EXCLUDED.commit_sha,
        status=EXCLUDED.status,
        raw_json=EXCLUDED.raw_json,
        updated_at=EXCLUDED.updated_at
    `, [job.build_job_id, job.project_id, job.user_id, job.repository_id || null, job.commit_sha || null, job.status, job, job.updated_at]);
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

  async saveVersion(version) {
    assertNoProjectFilePayload(version, "PROJECT_SQL_VERSION_SNAPSHOT_FORBIDDEN");
    const result = await this.pool.query(`
      INSERT INTO project_versions
        (version_id, project_id, parent_version_id, created_by_user_id, state,
         snapshot_sha256, includes_binary, created_at, raw_json)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
      ON CONFLICT (version_id) DO NOTHING
    `, [
      version.version_id,
      version.project_id,
      version.parent_version_id,
      version.created_by_user_id,
      version.state,
      version.snapshot_sha256,
      version.includes_binary === true,
      version.created_at,
      version,
    ]);
    if (!result.rowCount) throw new Error("PROJECT_VERSION_IMMUTABLE");
    return clone(version);
  }

  async findVersion(versionId) {
    return first(await this.pool.query("SELECT raw_json FROM project_versions WHERE version_id=$1", [versionId]));
  }

  async listVersions(filter = {}) {
    const query = filter.project_id
      ? await this.pool.query("SELECT raw_json FROM project_versions WHERE project_id=$1 ORDER BY created_at DESC", [filter.project_id])
      : await this.pool.query("SELECT raw_json FROM project_versions ORDER BY created_at DESC");
    return rows(query);
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

  async findProjectAppSettings(projectId, accountId) {
    return first(await this.pool.query(
      "SELECT raw_json FROM project_app_settings WHERE project_id=$1 AND account_id=$2",
      [projectId, accountId],
    ));
  }

  async compareAndSetProjectAppSettings(settings, expectedRevision) {
    const result = await this.pool.query(`
      WITH updated AS (
        UPDATE project_app_settings SET
          manifest_version=$3,
          revision=$4,
          raw_json=$5,
          updated_at=$7
        WHERE project_id=$1 AND account_id=$2 AND revision=$8
        RETURNING raw_json
      ), inserted AS (
        INSERT INTO project_app_settings
          (project_id, account_id, manifest_version, revision, raw_json, created_at, updated_at)
        SELECT $1,$2,$3,$4,$5,$6,$7
        WHERE $8=0 AND NOT EXISTS (
          SELECT 1 FROM project_app_settings WHERE project_id=$1 AND account_id=$2
        )
        ON CONFLICT (project_id, account_id) DO NOTHING
        RETURNING raw_json
      )
      SELECT raw_json FROM updated
      UNION ALL
      SELECT raw_json FROM inserted
    `, [
      settings.project_id, settings.account_id, settings.manifest_version, settings.revision,
      settings, settings.created_at, settings.updated_at, expectedRevision,
    ]);
    if (result.rowCount) return { saved: true, value: clone(result.rows[0].raw_json) };
    return { saved: false, current: await this.findProjectAppSettings(settings.project_id, settings.account_id) };
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

  async saveTemplateFeedback(feedback) {
    await this.pool.query(`
      INSERT INTO project_template_feedback (feedback_id, template_id, user_id, category, raw_json, created_at)
      VALUES ($1,$2,$3,$4,$5,$6)
      ON CONFLICT (feedback_id) DO UPDATE SET raw_json=EXCLUDED.raw_json
    `, [feedback.feedback_id, feedback.template_id, feedback.user_id, feedback.category, feedback, feedback.created_at]);
    return clone(feedback);
  }

  async listTemplateFeedback(filter = {}) {
    const conditions = [];
    const values = [];
    if (filter.template_id) { values.push(filter.template_id); conditions.push(`template_id=$${values.length}`); }
    if (filter.user_id) { values.push(filter.user_id); conditions.push(`user_id=$${values.length}`); }
    const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    return rows(await this.pool.query(`SELECT raw_json FROM project_template_feedback ${where} ORDER BY created_at`, values));
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

  async saveLearningProgress(progress) {
    await this.pool.query(`
      INSERT INTO project_learning_progress
        (project_id, user_id, status, current_lesson_id, current_step_id, raw_json, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (project_id) DO UPDATE SET
        user_id=EXCLUDED.user_id,
        status=EXCLUDED.status,
        current_lesson_id=EXCLUDED.current_lesson_id,
        current_step_id=EXCLUDED.current_step_id,
        raw_json=EXCLUDED.raw_json,
        updated_at=EXCLUDED.updated_at
    `, [
      progress.project_id,
      progress.user_id,
      progress.status,
      progress.current_lesson_id,
      progress.current_step_id,
      progress,
      progress.last_seen_at,
    ]);
    return clone(progress);
  }

  async findLearningProgress(projectId) {
    return first(await this.pool.query(
      "SELECT raw_json FROM project_learning_progress WHERE project_id=$1",
      [projectId],
    ));
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
        ["build_jobs", "project_build_jobs"],
        ["artifacts", "project_artifacts"],
        ["feedback", "project_feedback"],
        ["learning_progress", "project_learning_progress"],
        ["project_app_settings", "project_app_settings"],
      ]) {
        counts[key] = Number((await client.query(
          `SELECT COUNT(*) AS count FROM ${table} WHERE project_id=$1`,
          [projectId],
        )).rows[0].count);
      }
      counts.sources = 0;
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

  async findRepositoryMigration(projectId) {
    const result = await this.pool.query(
      "SELECT * FROM project_repository_migrations WHERE project_id=$1",
      [projectId],
    );
    return result.rows[0] ? clone(result.rows[0]) : null;
  }

  async saveRepositoryMigration(entry) {
    const result = await this.pool.query(`
      INSERT INTO project_repository_migrations
        (project_id, source_sha256, report_sha256, target_repository_id, target_head_sha,
         source_file_count, source_version_count, target_commit_count, status, error_code,
         started_at, completed_at, updated_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT (project_id) DO UPDATE SET
        source_sha256=EXCLUDED.source_sha256,
        report_sha256=EXCLUDED.report_sha256,
        target_repository_id=EXCLUDED.target_repository_id,
        target_head_sha=EXCLUDED.target_head_sha,
        source_file_count=EXCLUDED.source_file_count,
        source_version_count=EXCLUDED.source_version_count,
        target_commit_count=EXCLUDED.target_commit_count,
        status=EXCLUDED.status,
        error_code=EXCLUDED.error_code,
        started_at=EXCLUDED.started_at,
        completed_at=EXCLUDED.completed_at,
        updated_at=EXCLUDED.updated_at
      RETURNING *
    `, [
      entry.project_id, entry.source_sha256, entry.report_sha256,
      entry.target_repository_id || null, entry.target_head_sha || null,
      entry.source_file_count, entry.source_version_count, entry.target_commit_count,
      entry.status, entry.error_code || null, entry.started_at,
      entry.completed_at || null, entry.updated_at,
    ]);
    return clone(result.rows[0]);
  }

  async importLegacyState(state, migrationId = "project-sqlite-v1") {
    if (await this.hasMigration(migrationId)) return { imported: false, reason: "already_applied" };
    if ((state.sources || []).length
      || (state.projects || []).some(hasProjectFilePayload)
      || (state.buildJobs || []).some(hasProjectFilePayload)
      || (state.versions || []).some(hasProjectFilePayload)) {
      throw new Error("PROJECT_SQL_LEGACY_CONTENT_IMPORT_FORBIDDEN");
    }
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
      await importBuildJobs(client, state.buildJobs);
      await importArtifacts(client, state.artifacts);
      await importFeedback(client, state.feedback);
      await importConsents(client, state.consents);
      await importLearningProgress(client, state.learningProgress);
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

const FORBIDDEN_PROJECT_PAYLOAD_KEYS = new Set(["sources", "source_snapshot", "project_snapshot"]);

function hasProjectFilePayload(value) {
  if (Array.isArray(value)) return value.some(hasProjectFilePayload);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, entry]) => FORBIDDEN_PROJECT_PAYLOAD_KEYS.has(key) || hasProjectFilePayload(entry));
}

function assertNoProjectFilePayload(value, code) {
  if (hasProjectFilePayload(value)) throw new Error(code);
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

async function importLearningProgress(client, items = []) {
  for (const item of items) {
    await client.query(`
      INSERT INTO project_learning_progress
        (project_id, user_id, status, current_lesson_id, current_step_id, raw_json, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      item.project_id,
      item.user_id,
      item.status || "active",
      item.current_lesson_id || "",
      item.current_step_id || "",
      item,
      timestamp(item, "last_seen_at", "updated_at", "started_at"),
    ]);
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
