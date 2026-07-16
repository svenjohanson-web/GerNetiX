class InMemoryProjectRepository {
  constructor(seed = {}) {
    this.projects = new Map((seed.projects || []).map((item) => [item.project_id, clone(item)]));
    this.sources = new Map((seed.sources || []).map((item) => [key(item.project_id, item.path), clone(item)]));
    this.buildJobs = new Map((seed.buildJobs || []).map((item) => [item.build_job_id, clone(item)]));
    this.artifacts = new Map((seed.artifacts || []).map((item) => [item.artifact_id, clone(item)]));
    this.feedback = new Map((seed.feedback || []).map((item) => [item.feedback_id, clone(item)]));
    this.consents = new Map((seed.consents || []).map((item) => [item.consent_id, clone(item)]));
    this.resourcePolicies = new Map((seed.resourcePolicies || []).map((item) => [item.plan_id, clone(item)]));
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

  saveConsent(consent) {
    this.consents.set(consent.consent_id, clone(consent));
    return clone(consent);
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
}

function key(projectId, sourcePath) {
  return `${projectId}:${sourcePath}`;
}

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

module.exports = { InMemoryProjectRepository };
