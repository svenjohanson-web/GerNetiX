"use strict";

const crypto = require("node:crypto");
const { ProjectServerError } = require("../errors");

class ForgejoProjectRepositoryStore {
  constructor(options = {}) {
    this.client = options.client;
    this.git = options.git;
    this.organization = String(options.organization || "gernetix-projects");
    this.defaultBranch = String(options.defaultBranch || "main");
    if (!this.client || !this.git) throw new Error("forgejo_store_dependencies_required");
  }

  async provisionProject(input = {}) {
    const projectId = required(input.project_id, "project_id");
    const repositoryName = repositoryNameForProject(projectId);
    const ensured = await this.client.ensureOrganizationRepository(this.organization, {
      name: repositoryName,
      description: `GerNetiX Projekt ${projectId}`,
      default_branch: this.defaultBranch,
    });
    const repository = ensured.repository || {};
    const remoteUrl = trustedCloneUrl(repository.clone_url, this.client.baseUrl);
    if (!ensured.created && !repository.empty) {
      const existingHead = await this.git.head({ remote_url: remoteUrl, branch: this.defaultBranch });
      const existingFiles = await this.git.readFiles({ remote_url: remoteUrl, commit_sha: existingHead.head_sha });
      if (!sameInitialTree(existingFiles, input.changes)) {
        throw new ProjectServerError("repository_already_provisioned", "Das Projekt-Repository ist bereits mit einem abweichenden Stand initialisiert.", 409);
      }
      return repositoryBinding(this.organization, repositoryName, repository, remoteUrl, this.defaultBranch, existingHead.head_sha);
    }
    const commit = await this.git.initialize({
      remote_url: remoteUrl,
      branch: this.defaultBranch,
      message: input.message || "GerNetiX Projekt angelegt",
      changes: input.changes,
    });
    return repositoryBinding(this.organization, repositoryName, repository, remoteUrl, this.defaultBranch, commit.head_sha);
  }

  async commitChanges(binding = {}, input = {}) {
    requireConfiguredBinding(binding, this.organization);
    return this.git.commit({
      remote_url: trustedCloneUrl(binding.clone_url, this.client.baseUrl),
      branch: binding.default_branch || this.defaultBranch,
      expected_head_sha: input.expected_head_sha,
      message: input.message,
      changes: input.changes,
    });
  }

  async tree(binding = {}, commitSha) {
    requireConfiguredBinding(binding, this.organization);
    return this.git.tree({ remote_url: trustedCloneUrl(binding.clone_url, this.client.baseUrl), commit_sha: commitSha });
  }

  async readFile(binding = {}, commitSha, repositoryPath) {
    requireConfiguredBinding(binding, this.organization);
    return this.git.readFile({
      remote_url: trustedCloneUrl(binding.clone_url, this.client.baseUrl),
      commit_sha: commitSha,
      path: repositoryPath,
    });
  }

  async readFiles(binding = {}, commitSha) {
    requireConfiguredBinding(binding, this.organization);
    return this.git.readFiles({ remote_url: trustedCloneUrl(binding.clone_url, this.client.baseUrl), commit_sha: commitSha });
  }

  async history(binding = {}, input = {}) {
    requireConfiguredBinding(binding, this.organization);
    return this.git.history({
      remote_url: trustedCloneUrl(binding.clone_url, this.client.baseUrl),
      branch: binding.default_branch || this.defaultBranch,
      commit_sha: input.commit_sha || binding.head_sha,
      limit: input.limit,
    });
  }

  async diff(binding = {}, commitSha) {
    requireConfiguredBinding(binding, this.organization);
    return this.git.diff({
      remote_url: trustedCloneUrl(binding.clone_url, this.client.baseUrl),
      branch: binding.default_branch || this.defaultBranch,
      commit_sha: commitSha,
    });
  }

  async restore(binding = {}, input = {}) {
    requireConfiguredBinding(binding, this.organization);
    return this.git.restore({
      remote_url: trustedCloneUrl(binding.clone_url, this.client.baseUrl),
      branch: binding.default_branch || this.defaultBranch,
      expected_head_sha: input.expected_head_sha,
      restore_commit_sha: input.restore_commit_sha,
      message: input.message,
    });
  }

  async archive(binding = {}) {
    requireConfiguredBinding(binding, this.organization);
    await this.client.archiveRepository(binding.organization, binding.repository_name);
    return { ...binding, state: "archived" };
  }
}

function repositoryBinding(organization, repositoryName, repository, remoteUrl, defaultBranch, headSha) {
  return {
    provider: "forgejo",
    organization,
    repository_name: repositoryName,
    repository_id: repository.id === undefined ? "" : String(repository.id),
    clone_url: remoteUrl,
    default_branch: defaultBranch,
    head_sha: headSha,
    state: "active",
  };
}

function sameInitialTree(files, changes) {
  if (!Array.isArray(changes) || changes.some((change) => change?.operation === "delete")) return false;
  const expected = new Map(changes.map((change) => [String(change?.path || ""), String(change?.content ?? "")]));
  if (expected.size !== changes.length || expected.size !== files.length) return false;
  return files.every((file) => expected.get(file.path) === file.content);
}

function repositoryNameForProject(projectId) {
  return `project-${crypto.createHash("sha256").update(String(projectId)).digest("hex").slice(0, 24)}`;
}

function trustedCloneUrl(value, baseUrl) {
  const cloneUrl = String(value || "");
  let parsed;
  let forgejo;
  try {
    parsed = new URL(cloneUrl);
    forgejo = new URL(baseUrl);
  } catch {
    throw new ProjectServerError("repository_clone_url_invalid", "Forgejo lieferte keine zulässige Clone-URL.", 502);
  }
  if (!["http:", "https:"].includes(parsed.protocol)
    || parsed.origin !== forgejo.origin
    || parsed.username
    || parsed.password
    || parsed.search
    || parsed.hash) {
    throw new ProjectServerError("repository_clone_url_invalid", "Forgejo lieferte keine zulässige Clone-URL.", 502);
  }
  return cloneUrl;
}

function requireActiveBinding(binding) {
  if (binding?.provider !== "forgejo" || binding?.state !== "active") throw new ProjectServerError("repository_not_active", "Projekt besitzt kein aktives Forgejo-Repository.", 409);
}

function requireConfiguredBinding(binding, organization) {
  requireActiveBinding(binding);
  if (binding.organization !== organization) throw new ProjectServerError("repository_binding_invalid", "Repository-Bindung gehört nicht zur konfigurierten Organisation.", 500);
}

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new ProjectServerError("missing_field", `${field} fehlt.`);
  return normalized;
}

module.exports = { ForgejoProjectRepositoryStore, repositoryNameForProject };
