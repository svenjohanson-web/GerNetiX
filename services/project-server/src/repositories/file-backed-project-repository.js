const path = require("node:path");
const { JsonFileStore } = require("../../../shared");
const { InMemoryProjectRepository } = require("./in-memory-project-repository");

class FileBackedProjectRepository extends InMemoryProjectRepository {
  constructor(store) {
    super(store.load());
    this.store = store;
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

  persist() {
    this.store.save({
      projects: Array.from(this.projects.values()),
      sources: Array.from(this.sources.values()),
      buildJobs: Array.from(this.buildJobs.values()),
      artifacts: Array.from(this.artifacts.values()),
      feedback: Array.from(this.feedback.values()),
      consents: Array.from(this.consents.values()),
    });
  }
}

function emptyState() {
  return {
    projects: [],
    sources: [],
    buildJobs: [],
    artifacts: [],
    feedback: [],
    consents: [],
  };
}

module.exports = { FileBackedProjectRepository };
