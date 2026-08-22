"use strict";

class RepositoryAccountStorageMeter {
  constructor(repository, repositoryStore) {
    this.repository = repository;
    this.repositoryStore = repositoryStore;
  }

  async projectStorageBytes(projectId) {
    const project = await this.repository.findProject(projectId);
    if (!activeBinding(project)) return 0;
    return sourceBytes(await this.repositoryStore.readFiles(project.repository_binding, project.repository_binding.head_sha));
  }

  async accountStorageBytes(accountId) {
    let total = 0;
    for (const project of await this.repository.listProjects({ user_id: accountId })) {
      total += await this.projectStorageBytes(project.project_id);
    }
    return total;
  }

  async projectedAccountStorage(project, changes = []) {
    const accountBytes = await this.accountStorageBytes(project.user_id);
    const currentFiles = activeBinding(project)
      ? await this.repositoryStore.readFiles(project.repository_binding, project.repository_binding.head_sha)
      : [];
    const currentProjectBytes = sourceBytes(currentFiles);
    const projectedFiles = new Map(currentFiles.map((file) => [file.path, file]));
    for (const change of changes) {
      if (change.operation === "delete") projectedFiles.delete(change.path);
      else projectedFiles.set(change.path, change);
    }
    return {
      current_bytes: accountBytes,
      projected_bytes: accountBytes - currentProjectBytes + sourceBytes([...projectedFiles.values()]),
      measurement_source: "forgejo_repository_head",
    };
  }

  async projectedAccountStorageForReplacement(project, sources = []) {
    const accountBytes = await this.accountStorageBytes(project.user_id);
    const currentProjectBytes = await this.projectStorageBytes(project.project_id);
    return {
      current_bytes: accountBytes,
      projected_bytes: accountBytes - currentProjectBytes + sourceBytes(sources),
      measurement_source: "forgejo_repository_head",
    };
  }
}

function activeBinding(project) {
  return project?.repository_binding?.provider === "forgejo" && project.repository_binding.state === "active";
}

function sourceBytes(files = []) {
  return files.reduce((total, file) => {
    if (Number.isSafeInteger(file.size_bytes) && file.size_bytes >= 0) return total + file.size_bytes;
    if (file.content_base64 !== undefined) return total + Buffer.from(String(file.content_base64), "base64").length;
    return total + Buffer.byteLength(String(file.content ?? ""), "utf8");
  }, 0);
}

module.exports = { RepositoryAccountStorageMeter, sourceBytes };
