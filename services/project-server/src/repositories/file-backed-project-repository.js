const path = require("node:path");
const { JsonFileStore, jsonColumn } = require("../../../shared");
const { InMemoryProjectRepository } = require("./in-memory-project-repository");

class FileBackedProjectRepository extends InMemoryProjectRepository {
  constructor(store) {
    super(store.load());
    this.store = store;
    if (typeof this.store.ensureSchema === "function") {
      this.store.ensureSchema(projectServerSchema());
    }
    this.migrateLegacyIotDeviceComponentPaths();
  }

  static create(runtimeRoot) {
    return new FileBackedProjectRepository(new JsonFileStore(path.join(runtimeRoot, "project-server-state.json"), {
      defaultState: emptyState(),
    }));
  }

  saveProject(project) {
    const result = super.saveProject(project);
    this.persist();
    return result;
  }

  saveSource(source) {
    const result = super.saveSource(source);
    this.persist();
    return result;
  }

  saveBuildJob(job) {
    const result = super.saveBuildJob(job);
    this.persist();
    return result;
  }

  saveArtifact(artifact) {
    const result = super.saveArtifact(artifact);
    this.persist();
    return result;
  }

  saveFeedback(feedback) {
    const result = super.saveFeedback(feedback);
    this.persist();
    return result;
  }

  saveConsent(consent) {
    const result = super.saveConsent(consent);
    this.persist();
    return result;
  }

  saveResourcePolicy(policy) {
    const result = super.saveResourcePolicy(policy);
    this.persist();
    return result;
  }

  persist() {
    const state = {
      projects: Array.from(this.projects.values()),
      sources: Array.from(this.sources.values()),
      buildJobs: Array.from(this.buildJobs.values()),
      artifacts: Array.from(this.artifacts.values()),
      feedback: Array.from(this.feedback.values()),
      consents: Array.from(this.consents.values()),
      resourcePolicies: Array.from(this.resourcePolicies.values()),
    };
    this.store.save(state);
    if (typeof this.store.replaceCollection === "function") {
      this.store.replaceCollection("projects", state.projects, "project_id");
      this.store.replaceCollection("sources", state.sources, sourceDocumentId);
      this.store.replaceCollection("build_jobs", state.buildJobs, "build_job_id");
      this.store.replaceCollection("artifacts", state.artifacts, "artifact_id");
      this.store.replaceCollection("feedback", state.feedback, "feedback_id");
      this.store.replaceCollection("consents", state.consents, "consent_id");
      this.store.replaceCollection("resourcePolicies", state.resourcePolicies, "plan_id");
    }
    if (typeof this.store.replaceTable === "function") {
      this.store.replaceTable("project_server_projects", state.projects, projectColumns());
      this.store.replaceTable("project_server_sources", state.sources, sourceColumns());
      this.store.replaceTable("project_server_build_jobs", state.buildJobs, buildJobColumns());
      this.store.replaceTable("project_server_artifacts", state.artifacts, artifactColumns());
      this.store.replaceTable("project_server_feedback", state.feedback, feedbackColumns());
      this.store.replaceTable("project_server_consents", state.consents, consentColumns());
      this.store.replaceTable("project_server_resource_policies", state.resourcePolicies, resourcePolicyColumns());
    }
  }

  migrateLegacyIotDeviceComponentPaths() {
    const migrationNamespace = "project-server-content";
    const migrationVersion = 1;
    if (typeof this.store.schemaVersion === "function" && this.store.schemaVersion(migrationNamespace) >= migrationVersion) return;
    let changed = false;
    for (const [projectId, project] of this.projects) {
      const migrated = replaceLegacyIotDevicePath(project);
      if (JSON.stringify(migrated) !== JSON.stringify(project)) {
        this.projects.set(projectId, migrated);
        changed = true;
      }
    }
    const migratedSources = new Map();
    for (const source of this.sources.values()) {
      const migrated = replaceLegacyIotDevicePath(source);
      const migratedId = sourceDocumentId(migrated);
      const existing = migratedSources.get(migratedId);
      if (existing && JSON.stringify(existing) !== JSON.stringify(migrated)) {
        throw new Error(`project_source_path_migration_conflict:${migratedId}`);
      }
      migratedSources.set(migratedId, migrated);
      if (migrated.path !== source.path || migrated.content !== source.content) changed = true;
    }
    this.sources = migratedSources;
    if (changed) this.persist();
    if (typeof this.store.recordSchemaVersion === "function") {
      this.store.recordSchemaVersion(migrationNamespace, migrationVersion);
    }
  }
}

function replaceLegacyIotDevicePath(value) {
  if (Array.isArray(value)) return value.map(replaceLegacyIotDevicePath);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, replaceLegacyIotDevicePath(entry)]));
  }
  if (typeof value !== "string") return value;
  return value
    .replaceAll("Komponenten/ESP32", "Komponenten/IoT-Device 1")
    .replaceAll("IoT Device / ESP32", "IoT-Device 1")
    .replaceAll("ESP32 Device only", "IoT-Device only")
    .replaceAll("ESP32 Device", "IoT-Device")
    .replaceAll("ESP32-Device", "IoT-Device")
    .replaceAll("ESP32 Datenlogger", "IoT-Device Datenlogger")
    .replaceAll('rectangle "ESP32" as esp32', 'rectangle "IoT-Device 1" as esp32');
}

function sourceDocumentId(source) {
  return `${source.project_id}:${source.path}`;
}

function projectServerSchema() {
  return [
    `CREATE TABLE IF NOT EXISTS project_server_projects (
      project_id TEXT PRIMARY KEY,
      user_id TEXT,
      title TEXT,
      description TEXT,
      learning_project_id TEXT,
      hardware_profile_id TEXT,
      device_id TEXT,
      build_config_json TEXT,
      status TEXT,
      created_at TEXT,
      updated_at TEXT,
      raw_json TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS project_server_sources (
      project_id TEXT NOT NULL,
      path TEXT NOT NULL,
      content TEXT,
      content_sha256 TEXT,
      content_type TEXT,
      role TEXT,
      updated_at TEXT,
      raw_json TEXT NOT NULL,
      PRIMARY KEY (project_id, path)
    );`,
    `CREATE TABLE IF NOT EXISTS project_server_build_jobs (
      build_job_id TEXT PRIMARY KEY,
      project_id TEXT,
      user_id TEXT,
      mode TEXT,
      status TEXT,
      build_deploy_job_id TEXT,
      device_id TEXT,
      created_at TEXT,
      updated_at TEXT,
      submitted_at TEXT,
      finished_at TEXT,
      result_json TEXT,
      error_json TEXT,
      raw_json TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS project_server_artifacts (
      artifact_id TEXT PRIMARY KEY,
      project_id TEXT,
      build_job_id TEXT,
      artifact_type TEXT,
      file_name TEXT,
      url TEXT,
      sha256 TEXT,
      size_bytes INTEGER,
      created_at TEXT,
      raw_json TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS project_server_feedback (
      feedback_id TEXT PRIMARY KEY,
      project_id TEXT,
      user_id TEXT,
      learning_step_id TEXT,
      category TEXT,
      message TEXT,
      contact_mode TEXT,
      contact_email TEXT,
      anonymize_after TEXT,
      anonymized_at TEXT,
      created_at TEXT,
      raw_json TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS project_server_consents (
      consent_id TEXT PRIMARY KEY,
      feedback_id TEXT,
      user_id TEXT,
      purpose TEXT,
      granted_to_role TEXT,
      valid_from TEXT,
      valid_until TEXT,
      revoked_at TEXT,
      created_at TEXT,
      raw_json TEXT NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS project_server_resource_policies (
      plan_id TEXT PRIMARY KEY, max_projects INTEGER, max_storage_bytes INTEGER,
      max_monthly_traffic_bytes INTEGER, updated_at TEXT, raw_json TEXT NOT NULL
    );`,
  ];
}

function projectColumns() {
  return {
    project_id: "project_id",
    user_id: "user_id",
    title: "title",
    description: "description",
    learning_project_id: "learning_project_id",
    hardware_profile_id: "hardware_profile_id",
    device_id: "device_id",
    build_config_json: jsonColumn("build_config"),
    status: "status",
    created_at: "created_at",
    updated_at: "updated_at",
    raw_json: jsonColumn((row) => row),
  };
}

function sourceColumns() {
  return {
    project_id: "project_id",
    path: "path",
    content: "content",
    content_sha256: "content_sha256",
    content_type: "content_type",
    role: "role",
    updated_at: "updated_at",
    raw_json: jsonColumn((row) => row),
  };
}

function buildJobColumns() {
  return {
    build_job_id: "build_job_id",
    project_id: "project_id",
    user_id: "user_id",
    mode: "mode",
    status: "status",
    build_deploy_job_id: "build_deploy_job_id",
    device_id: "device_id",
    created_at: "created_at",
    updated_at: "updated_at",
    submitted_at: "submitted_at",
    finished_at: "finished_at",
    result_json: jsonColumn("result"),
    error_json: jsonColumn("error"),
    raw_json: jsonColumn((row) => row),
  };
}

function artifactColumns() {
  return {
    artifact_id: "artifact_id",
    project_id: "project_id",
    build_job_id: "build_job_id",
    artifact_type: "artifact_type",
    file_name: "file_name",
    url: "url",
    sha256: "sha256",
    size_bytes: "size_bytes",
    created_at: "created_at",
    raw_json: jsonColumn((row) => row),
  };
}

function feedbackColumns() {
  return {
    feedback_id: "feedback_id",
    project_id: "project_id",
    user_id: "user_id",
    learning_step_id: "learning_step_id",
    category: "category",
    message: "message",
    contact_mode: "contact_mode",
    contact_email: "contact_email",
    anonymize_after: "anonymize_after",
    anonymized_at: "anonymized_at",
    created_at: "created_at",
    raw_json: jsonColumn((row) => row),
  };
}

function consentColumns() {
  return {
    consent_id: "consent_id",
    feedback_id: "feedback_id",
    user_id: "user_id",
    purpose: "purpose",
    granted_to_role: "granted_to_role",
    valid_from: "valid_from",
    valid_until: "valid_until",
    revoked_at: "revoked_at",
    created_at: "created_at",
    raw_json: jsonColumn((row) => row),
  };
}

function resourcePolicyColumns() {
  return { plan_id: "plan_id", max_projects: "max_projects", max_storage_bytes: "max_storage_bytes", max_monthly_traffic_bytes: "max_monthly_traffic_bytes", updated_at: "updated_at", raw_json: jsonColumn((row) => row) };
}

function emptyState() {
  return {
    projects: [],
    sources: [],
    buildJobs: [],
    artifacts: [],
    feedback: [],
    consents: [],
    resourcePolicies: [],
  };
}

module.exports = { FileBackedProjectRepository };
