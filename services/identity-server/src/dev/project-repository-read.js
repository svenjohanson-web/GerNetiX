"use strict";

const {
  CONTRACT_VERSION,
  createProjectRepositoryContractStub,
  filePayload,
  validatePath,
} = require("./project-repository-contract-stub");

function createProjectRepositoryRead({ projectServerJson }) {
  if (typeof projectServerJson !== "function") throw new TypeError("projectServerJson is required");
  const fallback = createProjectRepositoryContractStub({ projectServerJson });

  async function status(project) {
    const storedProject = await loadProject(project);
    if (!activeBinding(storedProject.repository_binding)) return fallback.status(project);
    const binding = storedProject.repository_binding;
    return {
      contract_version: CONTRACT_VERSION,
      contract_stub: false,
      project_id: project.project_server_id,
      repository: {
        state: "active",
        provider: "forgejo",
        default_branch: String(binding.default_branch || "main"),
        head_sha: String(binding.head_sha || ""),
        read_only: true,
      },
    };
  }

  async function tree(project, commitSha = "") {
    if (!await usesForgejo(project)) return fallback.tree(project, commitSha);
    return projectServerJson(`${repositoryPath(project)}/tree${commitQuery(commitSha)}`);
  }

  async function file(project, sourcePath, commitSha = "") {
    if (!await usesForgejo(project)) return fallback.file(project, sourcePath, commitSha);
    const path = validatePath(sourcePath);
    const source = await projectServerJson(
      `/api/projects/${projectId(project)}/sources/${encodeURIComponent(path)}${commitQuery(commitSha)}`,
    );
    return filePayload(String(source.commit_sha || commitSha || ""), source);
  }

  async function history(project) {
    if (!await usesForgejo(project)) return fallback.history(project);
    const result = await projectServerJson(`${repositoryPath(project)}/history`);
    return {
      contract_version: CONTRACT_VERSION,
      items: (result.items || []).map((item) => ({
        commit_sha: String(item.commit_sha || ""),
        parent_commit_sha: String(item.parent_shas?.[0] || ""),
        message: String(item.message || "Git-Commit"),
        kind: "git_commit",
        named_version_id: "",
        created_at: String(item.authored_at || ""),
      })),
    };
  }

  async function diff(project, commitSha) {
    if (!await usesForgejo(project)) return fallback.diff(project, commitSha);
    const result = await projectServerJson(
      `${repositoryPath(project)}/commits/${encodeURIComponent(commitSha)}/diff`,
    );
    return {
      contract_version: CONTRACT_VERSION,
      commit_sha: String(result.commit_sha || commitSha || ""),
      parent_commit_sha: String(result.parent_sha || ""),
      files: (result.changes || []).map((change) => ({
        path: String(change.path || ""),
        previous_path: String(change.old_path || ""),
        status: String(change.status || "modified"),
        binary: binaryPath(change.path),
        truncated: true,
        patch: "",
      })),
    };
  }

  async function usesForgejo(project) {
    return activeBinding((await loadProject(project)).repository_binding);
  }

  function loadProject(project) {
    return projectServerJson(`/api/projects/${projectId(project)}`);
  }

  return { diff, file, history, status, tree };
}

function projectId(project) {
  return encodeURIComponent(String(project.project_server_id || ""));
}

function repositoryPath(project) {
  return `/api/projects/${projectId(project)}/repository`;
}

function commitQuery(commitSha) {
  return commitSha ? `?commit_sha=${encodeURIComponent(commitSha)}` : "";
}

function activeBinding(binding) {
  return Boolean(binding && binding.provider === "forgejo" && binding.state === "active");
}

function binaryPath(value) {
  return /\.(?:bin|elf|gif|ico|jpe?g|pdf|png|webp|zip)$/i.test(String(value || ""));
}

module.exports = { activeBinding, createProjectRepositoryRead };
