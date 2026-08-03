"use strict";

// Transitional storage meter: the SQL source cache is used until Forgejo can
// provide authoritative repository sizes (including history and LFS). Keeping
// this behind one interface prevents quota enforcement from depending on the
// current cache representation.
class SqlCacheAccountStorageMeter {
  constructor(repository) {
    this.repository = repository;
  }

  async accountStorageBytes(accountId) {
    let bytes = 0;
    for (const project of await this.repository.listProjects({ user_id: accountId })) {
      bytes += await this.projectStorageBytes(project.project_id);
    }
    return bytes;
  }

  async projectStorageBytes(projectId) {
    return sourceBytes(await this.repository.listSources(projectId));
  }

  async projectedAccountStorage(project, changes = []) {
    const currentAccountBytes = await this.accountStorageBytes(project.user_id);
    const currentSources = await this.repository.listSources(project.project_id);
    const projectedSources = new Map(currentSources.map((source) => [source.path, source]));
    for (const change of changes) {
      if (change.operation === "delete") projectedSources.delete(change.path);
      else projectedSources.set(change.path, { path: change.path, content: String(change.content || "") });
    }
    return {
      current_bytes: currentAccountBytes,
      projected_bytes: currentAccountBytes - sourceBytes(currentSources) + sourceBytes([...projectedSources.values()]),
      measurement_source: "sql_source_cache",
    };
  }

  async projectedAccountStorageForReplacement(project, sources = []) {
    const currentAccountBytes = await this.accountStorageBytes(project.user_id);
    const currentProjectBytes = await this.projectStorageBytes(project.project_id);
    return {
      current_bytes: currentAccountBytes,
      projected_bytes: currentAccountBytes - currentProjectBytes + sourceBytes(sources),
      measurement_source: "sql_source_cache",
    };
  }
}

function sourceBytes(sources) {
  return sources.reduce((sum, source) => sum + Buffer.byteLength(source.content || "", "utf8"), 0);
}

module.exports = { SqlCacheAccountStorageMeter };
