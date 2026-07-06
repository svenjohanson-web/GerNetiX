const { SqliteSnapshotStore } = require("../../../shared");
const { FileBackedProjectRepository } = require("./file-backed-project-repository");

class SqliteBackedProjectRepository extends FileBackedProjectRepository {
  static create(sqlitePath) {
    return new SqliteBackedProjectRepository(new SqliteSnapshotStore(sqlitePath, "project-server", {
      defaultState: {
        projects: [],
        sources: [],
        buildJobs: [],
        artifacts: [],
        feedback: [],
        consents: [],
      },
    }));
  }
}

module.exports = { SqliteBackedProjectRepository };
