"use strict";

const { createHash } = require("node:crypto");

// Temporary Strang-C read contract. The stub is removed once the Project Server
// owns all five read endpoints. It deliberately consumes only documented
// Project-Server responses: project.repository_binding, sources and versions;
// it emits the documented repository/tree shape. Browser responses never
// include Forgejo URLs or credentials.
const CONTRACT_VERSION = "project-repository-read-v1";
const MAX_PREVIEW_BYTES = 256 * 1024;
const MAX_DIFF_LINES = 800;

function createProjectRepositoryContractStub({ projectServerJson }) {
  if (typeof projectServerJson !== "function") throw new TypeError("projectServerJson is required");

  async function status(project) {
    const storedProject = await loadProject(project);
    const sourceList = await loadSourceList(project);
    const binding = publicBinding(storedProject.repository_binding);
    const headSha = validSha(binding?.head_sha) || snapshotSha(sourceList.items || []);
    return {
      contract_version: CONTRACT_VERSION,
      contract_stub: true,
      project_id: project.project_server_id,
      repository: {
        state: binding?.state || "contract_stub",
        provider: binding?.provider || "forgejo",
        default_branch: binding?.default_branch || "main",
        head_sha: headSha,
        read_only: true,
      },
    };
  }

  async function tree(project, commitSha = "") {
    const context = await repositoryContext(project);
    const resolved = resolveCommit(context, commitSha);
    return {
      commit_sha: resolved.commit_sha,
      paths: resolved.sources.map((source) => String(source.path || "")).filter(Boolean).sort(),
    };
  }

  async function file(project, sourcePath, commitSha = "") {
    const path = validatePath(sourcePath);
    const context = await repositoryContext(project);
    const resolved = resolveCommit(context, commitSha);
    let source = resolved.sources.find((item) => item.path === path);
    if (!source) throw contractError("repository_file_not_found", "Datei wurde in diesem Commit nicht gefunden.", 404);
    if (resolved.current && source.content === undefined) {
      source = await projectServerJson(sourcePathname(project, path), projectAccess(project));
    }
    return filePayload(resolved.commit_sha, source);
  }

  async function history(project) {
    const context = await repositoryContext(project);
    return {
      contract_version: CONTRACT_VERSION,
      items: historyItems(context),
    };
  }

  async function diff(project, commitSha) {
    const context = await repositoryContext(project, { withCurrentContent: true });
    const items = historyItems(context);
    const index = items.findIndex((item) => item.commit_sha === commitSha);
    if (index < 0) throw contractError("repository_commit_not_found", "Commit wurde für dieses Projekt nicht gefunden.", 404);
    const current = resolveCommit(context, commitSha);
    const parentSha = items[index].parent_commit_sha;
    const parent = parentSha ? resolveCommit(context, parentSha) : { sources: [] };
    return {
      contract_version: CONTRACT_VERSION,
      commit_sha: current.commit_sha,
      parent_commit_sha: parentSha || "",
      files: buildDiff(parent.sources, current.sources),
    };
  }

  async function repositoryContext(project, options = {}) {
    const [repositoryStatus, sourceList, versions] = await Promise.all([
      status(project),
      loadSourceList(project),
      projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/versions`, projectAccess(project)),
    ]);
    let currentSources = sourceList.items || [];
    if (options.withCurrentContent) {
      currentSources = await Promise.all(currentSources.map(async (source) => (
        source.content === undefined ? projectServerJson(sourcePathname(project, source.path), projectAccess(project)) : source
      )));
    }
    return {
      head_sha: repositoryStatus.repository.head_sha,
      current_sources: currentSources,
      versions: (versions.items || []).map((version) => ({ ...version, commit_sha: versionSha(version) })),
    };
  }

  function loadProject(project) {
    return projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}`, projectAccess(project));
  }

  function loadSourceList(project) {
    return projectServerJson(`/api/projects/${encodeURIComponent(project.project_server_id)}/sources`, projectAccess(project));
  }

  return { diff, file, history, status, tree };
}

function projectAccess(project) {
  const accountId = String(project.owner_user_id || project.user_id || "");
  if (!accountId) throw new Error("A server-authorized project owner is required for repository access.");
  return { internalAuth: { scopes: ["project.read"], delegation: { account_id: accountId, project_ids: [String(project.project_server_id)] } } };
}

function sourcePathname(project, path) {
  return `/api/projects/${encodeURIComponent(project.project_server_id)}/sources/${encodeURIComponent(path)}`;
}

function publicBinding(binding) {
  if (!binding || typeof binding !== "object") return null;
  return {
    provider: String(binding.provider || ""),
    state: String(binding.state || ""),
    default_branch: String(binding.default_branch || ""),
    head_sha: String(binding.head_sha || ""),
  };
}

function historyItems(context) {
  const versions = context.versions;
  const result = [{
    commit_sha: context.head_sha,
    parent_commit_sha: versions[0]?.commit_sha || "",
    message: "Aktueller Arbeitsstand",
    kind: "working_head",
    named_version_id: "",
    created_at: "",
  }];
  for (let index = 0; index < versions.length; index += 1) {
    const version = versions[index];
    if (version.commit_sha === context.head_sha) continue;
    result.push({
      commit_sha: version.commit_sha,
      parent_commit_sha: versions[index + 1]?.commit_sha || "",
      message: String(version.message || "Benannte GerNetiX-Version"),
      kind: String(version.commit_kind || "named_version"),
      named_version_id: String(version.version_id || ""),
      created_at: String(version.created_at || ""),
    });
  }
  return result;
}

function resolveCommit(context, requestedSha = "") {
  const commitSha = requestedSha || context.head_sha;
  if (!validSha(commitSha)) throw contractError("invalid_commit_sha", "Commit-SHA ist ungültig.", 400);
  if (commitSha === context.head_sha) return { commit_sha: commitSha, sources: context.current_sources, current: true };
  const version = context.versions.find((item) => item.commit_sha === commitSha);
  if (!version) throw contractError("repository_commit_not_found", "Commit wurde für dieses Projekt nicht gefunden.", 404);
  return { commit_sha: commitSha, sources: version.sources || [], current: false };
}

function filePayload(commitSha, source) {
  const content = String(source.content || "");
  const sizeBytes = Buffer.byteLength(content, "utf8");
  const binary = content.includes("\0") || /^application\/(?!json)/.test(String(source.content_type || ""));
  const tooLarge = sizeBytes > MAX_PREVIEW_BYTES;
  return {
    commit_sha: commitSha,
    path: String(source.path || ""),
    content_type: String(source.content_type || "text/plain"),
    size_bytes: sizeBytes,
    binary,
    truncated: tooLarge,
    content: binary || tooLarge ? "" : content,
  };
}

function buildDiff(previousSources, nextSources) {
  const previous = new Map(previousSources.map((source) => [source.path, source]));
  const next = new Map(nextSources.map((source) => [source.path, source]));
  const deleted = [...previous.keys()].filter((path) => !next.has(path));
  const added = [...next.keys()].filter((path) => !previous.has(path));
  const renamed = new Map();
  for (const oldPath of deleted) {
    const oldHash = sourceHash(previous.get(oldPath));
    const newPath = added.find((candidate) => !renamed.has(candidate) && sourceHash(next.get(candidate)) === oldHash);
    if (newPath) renamed.set(newPath, oldPath);
  }
  const paths = [...new Set([...previous.keys(), ...next.keys()])].sort();
  return paths.flatMap((path) => {
    if (!next.has(path) && [...renamed.values()].includes(path)) return [];
    const before = renamed.has(path) ? previous.get(renamed.get(path)) : previous.get(path);
    const after = next.get(path);
    if (before && after && sourceHash(before) === sourceHash(after) && !renamed.has(path)) return [];
    const binary = isBinarySource(before) || isBinarySource(after);
    const status = renamed.has(path) ? "renamed" : !before ? "added" : !after ? "deleted" : "modified";
    return [{
      path,
      previous_path: renamed.get(path) || "",
      status,
      binary,
      truncated: false,
      patch: binary ? "" : lineDiff(before?.content || "", after?.content || ""),
    }];
  });
}

function lineDiff(before, after) {
  const beforeLines = String(before).split("\n");
  const afterLines = String(after).split("\n");
  const lines = [`--- vorher`, `+++ nachher`];
  const length = Math.max(beforeLines.length, afterLines.length);
  for (let index = 0; index < length && lines.length < MAX_DIFF_LINES; index += 1) {
    if (beforeLines[index] === afterLines[index]) {
      lines.push(` ${beforeLines[index] || ""}`);
    } else {
      if (beforeLines[index] !== undefined) lines.push(`-${beforeLines[index]}`);
      if (afterLines[index] !== undefined) lines.push(`+${afterLines[index]}`);
    }
  }
  if (lines.length >= MAX_DIFF_LINES) lines.push("… Diff gekürzt …");
  return lines.join("\n");
}

function sourceHash(source) {
  if (!source) return "";
  const documentedHash = String(source.content_sha256 || "").toLowerCase();
  return /^[a-f0-9]{64}$/.test(documentedHash) ? documentedHash : digest(String(source.content || ""), "sha256");
}

function snapshotSha(sources) {
  const material = sources.map((source) => `${source.path}\0${sourceHash(source)}`).sort().join("\n");
  return digest(material || "empty-project", "sha1");
}

function versionSha(version) {
  const snapshot = String(version.snapshot_sha256 || "").toLowerCase();
  return /^[a-f0-9]{64}$/.test(snapshot) ? snapshot.slice(0, 40) : digest(JSON.stringify({
    id: version.version_id || "",
    parent: version.parent_version_id || "",
    sources: (version.sources || []).map((source) => [source.path, sourceHash(source)]),
  }), "sha1");
}

function digest(value, algorithm) {
  return createHash(algorithm).update(value).digest("hex");
}

function validSha(value) {
  const normalized = String(value || "").toLowerCase();
  return /^[a-f0-9]{40}$/.test(normalized) ? normalized : "";
}

function validatePath(value) {
  const path = String(value || "").replace(/\\/g, "/");
  if (!path || path.startsWith("/") || path.split("/").some((part) => !part || part === "." || part === ".." || part.toLowerCase() === ".git")) {
    throw contractError("invalid_repository_path", "Repository-Pfad ist ungültig.", 400);
  }
  return path;
}

function isBinarySource(source) {
  return Boolean(source && (String(source.content || "").includes("\0") || /^application\/(?!json)/.test(String(source.content_type || ""))));
}

function contractError(code, message, status) {
  const error = new Error(message);
  error.code = code;
  error.status = status;
  return error;
}

module.exports = {
  CONTRACT_VERSION,
  MAX_PREVIEW_BYTES,
  buildDiff,
  createProjectRepositoryContractStub,
  filePayload,
  validatePath,
};
