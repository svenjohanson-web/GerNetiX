const { SqliteStateStore } = require("../../../shared");
const { FileBackedProjectRepository } = require("./file-backed-project-repository");

class SqliteBackedProjectRepository extends FileBackedProjectRepository {
  static create(sqlitePath) {
    return new SqliteBackedProjectRepository(new SqliteStateStore(sqlitePath, "project-server", {
      defaultState: {
        projects: [],
        sources: [],
        buildJobs: [],
        artifacts: [],
        feedback: [],
        consents: [],
      },
      collectionMap: {
        projects: "projects",
        sources: "sources",
        buildJobs: "build_jobs",
        artifacts: "artifacts",
        feedback: "feedback",
        consents: "consents",
      },
    }));
  }
}

module.exports = { SqliteBackedProjectRepository };
