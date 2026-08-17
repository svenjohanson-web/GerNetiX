class InMemoryProjectRepository {
  constructor(seed = {}) {
    this.projects = new Map((seed.projects || []).map((item) => [item.project_id, clone(item)]));
    this.sources = new Map((seed.sources || []).map((item) => [key(item.project_id, item.path), clone(item)]));
    this.buildJobs = new Map((seed.buildJobs || []).map((item) => [item.build_job_id, clone(item)]));
    this.artifacts = new Map((seed.artifacts || []).map((item) => [item.artifact_id, clone(item)]));
    this.feedback = new Map((seed.feedback || []).map((item) => [item.feedback_id, clone(item)]));
    this.templateFeedback = new Map((seed.templateFeedback || []).map((item) => [item.feedback_id, clone(item)]));
    this.consents = new Map((seed.consents || []).map((item) => [item.consent_id, clone(item)]));
    this.learningProgress = new Map((seed.learningProgress || []).map((item) => [item.project_id, clone(item)]));
    this.resourcePolicies = new Map((seed.resourcePolicies || []).map((item) => [item.plan_id, clone(item)]));
    this.versions = new Map((seed.versions || []).map((item) => [item.version_id, clone(item)]));
    this.projectAppSettings = new Map((seed.projectAppSettings || []).map((item) => [projectAppSettingsKey(item.project_id, item.account_id), clone(item)]));
    this.repositoryMigrations = new Map((seed.repositoryMigrations || []).map((item) => [item.project_id, clone(item)]));
  }

  saveProject(project) {
    this.projects.set(project.project_id, clone(project));
    return clone(project);
  }

  findProject(projectId) {
    return clone(this.projects.get(projectId));
  }

  listProjects(filter = {}) {
    return Array.from(this.projects.values())
      .filter((project) => !filter.user_id || project.user_id === filter.user_id)
      .map(clone);
  }

  listProjectSummaries(filter = {}) {
    return Array.from(this.projects.values())
      .filter((project) => !filter.user_id || project.user_id === filter.user_id)
      .map((project) => ({
        ...clone(project),
        has_project_app: this.sources.has(key(project.project_id, "project-app/manifest.json")),
      }));
  }

  saveSource(source) {
    this.sources.set(key(source.project_id, source.path), clone(source));
    return clone(source);
  }

  findSource(projectId, sourcePath) {
    return clone(this.sources.get(key(projectId, sourcePath)));
  }

  listSources(projectId) {
    return Array.from(this.sources.values())
      .filter((source) => source.project_id === projectId)
      .sort((left, right) => left.path.localeCompare(right.path))
      .map(clone);
  }

  deleteSource(projectId, sourcePath) { return this.sources.delete(key(projectId, sourcePath)); }

  saveBuildJob(job) {
    this.buildJobs.set(job.build_job_id, clone(job));
    return clone(job);
  }

  findBuildJob(jobId) {
    return clone(this.buildJobs.get(jobId));
  }

  listBuildJobs(filter = {}) {
    return Array.from(this.buildJobs.values())
      .filter((job) => !filter.project_id || job.project_id === filter.project_id)
      .filter((job) => !filter.user_id || job.user_id === filter.user_id)
      .sort((left, right) => right.created_at.localeCompare(left.created_at))
      .map(clone);
  }

  saveArtifact(artifact) {
    this.artifacts.set(artifact.artifact_id, clone(artifact));
    return clone(artifact);
  }

  listArtifacts(filter = {}) {
    return Array.from(this.artifacts.values())
      .filter((artifact) => !filter.project_id || artifact.project_id === filter.project_id)
      .filter((artifact) => !filter.build_job_id || artifact.build_job_id === filter.build_job_id)
      .map(clone);
  }

  saveFeedback(feedback) {
    this.feedback.set(feedback.feedback_id, clone(feedback));
    return clone(feedback);
  }

  findFeedback(feedbackId) {
    return clone(this.feedback.get(feedbackId));
  }

  listFeedback(filter = {}) {
    return Array.from(this.feedback.values())
      .filter((item) => !filter.project_id || item.project_id === filter.project_id)
      .filter((item) => !filter.user_id || item.user_id === filter.user_id)
      .map(clone);
  }

  saveTemplateFeedback(feedback) {
    this.templateFeedback.set(feedback.feedback_id, clone(feedback));
    return clone(feedback);
  }

  listTemplateFeedback(filter = {}) {
    return Array.from(this.templateFeedback.values())
      .filter((item) => !filter.template_id || item.template_id === filter.template_id)
      .filter((item) => !filter.user_id || item.user_id === filter.user_id)
      .map(clone);
  }

  saveConsent(consent) {
    this.consents.set(consent.consent_id, clone(consent));
    return clone(consent);
  }

  saveLearningProgress(progress) {
    this.learningProgress.set(progress.project_id, clone(progress));
    return clone(progress);
  }

  findLearningProgress(projectId) {
    return clone(this.learningProgress.get(projectId));
  }

  findConsent(consentId) {
    return clone(this.consents.get(consentId));
  }

  findFeedbackConsent(feedbackId) {
    for (const consent of this.consents.values()) {
      if (consent.feedback_id === feedbackId && !consent.revoked_at) return clone(consent);
    }
    return null;
  }

  listResourcePolicies() {
    return Array.from(this.resourcePolicies.values()).map(clone);
  }

  saveResourcePolicy(policy) {
    this.resourcePolicies.set(policy.plan_id, clone(policy));
    return clone(policy);
  }

  saveVersion(version) {
    if (this.versions.has(version.version_id)) throw new Error("PROJECT_VERSION_IMMUTABLE");
    this.versions.set(version.version_id, clone(version));
    return clone(version);
  }
  findVersion(versionId) { return clone(this.versions.get(versionId)); }
  listVersions(filter = {}) {
    return Array.from(this.versions.values())
      .filter((item) => !filter.project_id || item.project_id === filter.project_id)
      .sort((left, right) => right.created_at.localeCompare(left.created_at)).map(clone);
  }

  findRepositoryMigration(projectId) { return clone(this.repositoryMigrations.get(projectId)); }
  saveRepositoryMigration(entry) {
    this.repositoryMigrations.set(entry.project_id, clone(entry));
    return clone(entry);
  }

  findProjectAppSettings(projectId, accountId) {
    return clone(this.projectAppSettings.get(projectAppSettingsKey(projectId, accountId)));
  }

  compareAndSetProjectAppSettings(settings, expectedRevision) {
    const id = projectAppSettingsKey(settings.project_id, settings.account_id);
    const current = this.projectAppSettings.get(id);
    const currentRevision = current?.revision || 0;
    if (currentRevision !== expectedRevision) return { saved: false, current: clone(current) };
    this.projectAppSettings.set(id, clone(settings));
    return { saved: true, value: clone(settings) };
  }

  deleteProject(projectId) {
    const deleted = { sources: 0, build_jobs: 0, artifacts: 0, feedback: 0, consents: 0, learning_progress: 0, versions: 0, project_app_settings: 0 };
    for (const [id, source] of this.sources) if (source.project_id === projectId) { this.sources.delete(id); deleted.sources += 1; }
    for (const [id, job] of this.buildJobs) if (job.project_id === projectId) { this.buildJobs.delete(id); deleted.build_jobs += 1; }
    for (const [id, artifact] of this.artifacts) if (artifact.project_id === projectId) { this.artifacts.delete(id); deleted.artifacts += 1; }
    const feedbackIds = new Set();
    for (const [id, feedback] of this.feedback) if (feedback.project_id === projectId) { feedbackIds.add(feedback.feedback_id); this.feedback.delete(id); deleted.feedback += 1; }
    for (const [id, consent] of this.consents) if (feedbackIds.has(consent.feedback_id)) { this.consents.delete(id); deleted.consents += 1; }
    if (this.learningProgress.delete(projectId)) deleted.learning_progress += 1;
    for (const [id, version] of this.versions) if (version.project_id === projectId) { this.versions.delete(id); deleted.versions += 1; }
    for (const [id, settings] of this.projectAppSettings) if (settings.project_id === projectId) { this.projectAppSettings.delete(id); deleted.project_app_settings += 1; }
    this.projects.delete(projectId);
    return deleted;
  }
}

function key(projectId, sourcePath) {
  return `${projectId}:${sourcePath}`;
}

function projectAppSettingsKey(projectId, accountId) {
  return `${projectId}:${accountId}`;
}

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

module.exports = { InMemoryProjectRepository };
