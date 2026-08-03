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
      throw new ProjectServerError("repository_already_provisioned", "Das Projekt-Repository ist bereits initialisiert.", 409);
    }
    const commit = await this.git.initialize({
      remote_url: remoteUrl,
      branch: this.defaultBranch,
      message: input.message || "GerNetiX Projekt angelegt",
      changes: input.changes,
    });
    return {
      provider: "forgejo",
      organization: this.organization,
      repository_name: repositoryName,
      repository_id: repository.id === undefined ? "" : String(repository.id),
      clone_url: remoteUrl,
      default_branch: this.defaultBranch,
      head_sha: commit.head_sha,
      state: "active",
    };
  }

  async commitChanges(binding = {}, input = {}) {
    requireActiveBinding(binding);
    if (binding.organization !== this.organization) throw new ProjectServerError("repository_binding_invalid", "Repository-Bindung gehört nicht zur konfigurierten Organisation.", 500);
    return this.git.commit({
      remote_url: trustedCloneUrl(binding.clone_url, this.client.baseUrl),
      branch: binding.default_branch || this.defaultBranch,
      expected_head_sha: input.expected_head_sha,
      message: input.message,
      changes: input.changes,
    });
  }

  async tree(binding = {}, commitSha) {
    requireActiveBinding(binding);
    return this.git.tree({ remote_url: trustedCloneUrl(binding.clone_url, this.client.baseUrl), commit_sha: commitSha });
  }

  async archive(binding = {}) {
    requireActiveBinding(binding);
    await this.client.archiveRepository(binding.organization, binding.repository_name);
    return { ...binding, state: "archived" };
  }
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

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new ProjectServerError("missing_field", `${field} fehlt.`);
  return normalized;
}

module.exports = { ForgejoProjectRepositoryStore, repositoryNameForProject };
