"use strict";

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { ProjectServerError } = require("../errors");
const { createGitCommandRunner } = require("./git-command-runner");

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const BRANCH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/;

class GitProjectRepositoryStore {
  constructor(options = {}) {
    this.runGit = options.runGit || createGitCommandRunner(options);
    this.tempRoot = options.tempRoot || os.tmpdir();
    this.authToken = String(options.authToken || "");
    this.authorName = options.authorName || "GerNetiX Project Server";
    this.authorEmail = options.authorEmail || "project-server@gernetix.invalid";
  }

  async initialize(input = {}) {
    const remoteUrl = validateRemoteUrl(input.remote_url);
    const branch = validateBranch(input.branch || "main");
    const changes = normalizeChanges(input.changes, { allowEmpty: false });
    return this.withWorkspace(async (workspace) => {
      await this.git(["init", "--initial-branch", branch], workspace);
      await this.configureIdentity(workspace);
      await this.git(["remote", "add", "origin", remoteUrl], workspace);
      await applyChanges(workspace, changes);
      await this.git(["add", "--all", "--", "."], workspace);
      await this.git(["commit", "--message", commitMessage(input.message, "GerNetiX Projekt angelegt")], workspace);
      const headSha = await this.revParse(workspace, "HEAD");
      try {
        await this.git(["push", "origin", `HEAD:refs/heads/${branch}`], workspace);
      } catch (error) {
        throw gitConflict(error, "repository_initialization_conflict", "Das Repository wurde bereits initialisiert.");
      }
      return { head_sha: headSha, branch, changed_paths: changes.map((change) => change.path), no_change: false };
    });
  }

  async commit(input = {}) {
    const remoteUrl = validateRemoteUrl(input.remote_url);
    const branch = validateBranch(input.branch || "main");
    const expectedHeadSha = validateSha(input.expected_head_sha, "expected_head_sha");
    const changes = normalizeChanges(input.changes, { allowEmpty: false });
    return this.withWorkspace(async (workspace) => {
      await this.git(["init"], workspace);
      await this.configureIdentity(workspace);
      await this.git(["remote", "add", "origin", remoteUrl], workspace);
      await this.git(["fetch", "--no-tags", "--depth", "1", "origin", `refs/heads/${branch}`], workspace);
      const actualHeadSha = await this.revParse(workspace, "FETCH_HEAD");
      if (actualHeadSha !== expectedHeadSha) {
        throw new ProjectServerError("repository_head_conflict", "Der Repository-Stand wurde zwischenzeitlich geändert.", 409, {
          expected_head_sha: expectedHeadSha,
          actual_head_sha: actualHeadSha,
        });
      }
      await this.git(["checkout", "--detach", "FETCH_HEAD"], workspace);
      await applyChanges(workspace, changes);
      await this.git(["add", "--all", "--", "."], workspace);
      if (await this.hasNoStagedChanges(workspace)) {
        return { head_sha: actualHeadSha, branch, changed_paths: [], no_change: true };
      }
      await this.git(["commit", "--message", commitMessage(input.message, "GerNetiX Projektdateien aktualisiert")], workspace);
      const headSha = await this.revParse(workspace, "HEAD");
      try {
        await this.git([
          "push",
          `--force-with-lease=refs/heads/${branch}:${expectedHeadSha}`,
          "origin",
          `HEAD:refs/heads/${branch}`,
        ], workspace);
      } catch (error) {
        throw gitConflict(error, "repository_head_conflict", "Der Repository-Stand wurde gleichzeitig geändert.", expectedHeadSha);
      }
      return { head_sha: headSha, branch, changed_paths: changes.map((change) => change.path), no_change: false };
    });
  }

  async tree(input = {}) {
    const remoteUrl = validateRemoteUrl(input.remote_url);
    const commitSha = validateSha(input.commit_sha, "commit_sha");
    return this.withWorkspace(async (workspace) => {
      await this.git(["init"], workspace);
      await this.git(["remote", "add", "origin", remoteUrl], workspace);
      await this.git(["fetch", "--no-tags", "origin"], workspace);
      let fetchedSha;
      try {
        fetchedSha = await this.revParse(workspace, `${commitSha}^{commit}`);
      } catch {
        throw new ProjectServerError("repository_commit_not_found", "Git-Commit wurde nicht gefunden.", 404);
      }
      if (fetchedSha !== commitSha) throw new ProjectServerError("repository_commit_not_found", "Git-Commit wurde nicht gefunden.", 404);
      const result = await this.git(["ls-tree", "-r", "--name-only", commitSha], workspace);
      return result.stdout.split(/\r?\n/).filter(Boolean).map(normalizeRepositoryPath).sort();
    });
  }

  async configureIdentity(workspace) {
    await this.git(["config", "user.name", this.authorName], workspace);
    await this.git(["config", "user.email", this.authorEmail], workspace);
  }

  async hasNoStagedChanges(workspace) {
    try {
      await this.git(["diff", "--cached", "--quiet"], workspace);
      return true;
    } catch (error) {
      if (error?.details?.exit_code === 1) return false;
      throw error;
    }
  }

  async revParse(workspace, reference) {
    const result = await this.git(["rev-parse", reference], workspace);
    return validateSha(result.stdout.trim(), "git_head_sha");
  }

  git(args, cwd) {
    return this.runGit(args, { cwd, authToken: this.authToken });
  }

  async withWorkspace(callback) {
    const workspace = await fs.mkdtemp(path.join(this.tempRoot, "gernetix-project-git-"));
    try {
      return await callback(workspace);
    } finally {
      await fs.rm(workspace, { recursive: true, force: true });
    }
  }
}

async function applyChanges(workspace, changes) {
  for (const change of changes) {
    const absolutePath = path.join(workspace, ...change.path.split("/"));
    const relative = path.relative(workspace, absolutePath);
    if (relative.startsWith("..") || path.isAbsolute(relative)) throw new ProjectServerError("invalid_source_path", "Repository-Pfad verlässt das Projekt.");
    await assertNoSymlinkPath(workspace, absolutePath);
    if (change.operation === "delete") {
      await fs.rm(absolutePath, { force: true });
      continue;
    }
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, change.content, "utf8");
  }
}

async function assertNoSymlinkPath(workspace, targetPath) {
  const relativeParts = path.relative(workspace, targetPath).split(path.sep).filter(Boolean);
  let current = workspace;
  for (const part of relativeParts) {
    current = path.join(current, part);
    try {
      const stat = await fs.lstat(current);
      if (stat.isSymbolicLink()) throw new ProjectServerError("repository_symlink_forbidden", "Projektänderungen über symbolische Links sind nicht erlaubt.");
    } catch (error) {
      if (error?.code === "ENOENT") return;
      throw error;
    }
  }
}

function normalizeChanges(input, options = {}) {
  if (!Array.isArray(input) || (!options.allowEmpty && input.length === 0)) {
    throw new ProjectServerError("repository_changes_required", "Mindestens eine Dateiänderung ist erforderlich.");
  }
  if (input.length > 100) throw new ProjectServerError("repository_change_limit_exceeded", "Ein Commit darf höchstens 100 Dateiänderungen enthalten.", 413);
  let totalBytes = 0;
  const paths = new Set();
  return input.map((raw) => {
    const operation = raw?.operation === "delete" ? "delete" : "upsert";
    const repositoryPath = normalizeRepositoryPath(raw?.path);
    if (paths.has(repositoryPath)) throw new ProjectServerError("duplicate_repository_path", "Ein Pfad darf pro Commit nur einmal vorkommen.");
    paths.add(repositoryPath);
    const content = operation === "upsert" ? String(raw?.content ?? "") : "";
    const bytes = Buffer.byteLength(content);
    if (bytes > 1024 * 1024) throw new ProjectServerError("repository_file_too_large", "Eine Projektdatei darf höchstens 1 MiB groß sein.", 413);
    totalBytes += bytes;
    if (totalBytes > 5 * 1024 * 1024) throw new ProjectServerError("repository_commit_too_large", "Ein Projektcommit darf höchstens 5 MiB Text enthalten.", 413);
    return { operation, path: repositoryPath, content };
  });
}

function normalizeRepositoryPath(value) {
  const normalized = String(value || "").replace(/\\/g, "/").replace(/^\.\//, "");
  if (!normalized || normalized.startsWith("/") || normalized.includes("\0") || normalized.split("/").some((part) => !part || part === "." || part === ".." || part.toLowerCase() === ".git")) {
    throw new ProjectServerError("invalid_source_path", "Repository-Pfad ist ungültig.");
  }
  if (Buffer.byteLength(normalized) > 512) throw new ProjectServerError("invalid_source_path", "Repository-Pfad ist zu lang.");
  return normalized;
}

function validateRemoteUrl(value) {
  const remoteUrl = String(value || "");
  let parsed;
  try { parsed = new URL(remoteUrl); } catch { throw new ProjectServerError("invalid_repository_remote", "Repository-Remote ist nicht zulässig.", 500); }
  const httpRemote = ["http:", "https:"].includes(parsed.protocol) && !parsed.username && !parsed.password;
  const sshRemote = parsed.protocol === "ssh:" && !parsed.password;
  if ((!httpRemote && !sshRemote) || parsed.search || parsed.hash) throw new ProjectServerError("invalid_repository_remote", "Repository-Remote ist nicht zulässig.", 500);
  return remoteUrl;
}

function validateBranch(value) {
  const branch = String(value || "");
  if (!BRANCH_PATTERN.test(branch) || branch.includes("..") || branch.includes("//") || branch.endsWith(".")) throw new ProjectServerError("invalid_repository_branch", "Repository-Branch ist ungültig.", 500);
  return branch;
}

function validateSha(value, field) {
  const sha = String(value || "").toLowerCase();
  if (!SHA_PATTERN.test(sha)) throw new ProjectServerError("invalid_repository_sha", `${field} muss ein vollständiger Git-SHA sein.`);
  return sha;
}

function commitMessage(value, fallback) {
  const message = String(value || fallback).trim().replace(/[\r\n]+/g, " ").slice(0, 200);
  return message || fallback;
}

function gitConflict(error, code, message, expectedHeadSha = "") {
  if (error instanceof ProjectServerError) return error;
  return new ProjectServerError(code, message, 409, {
    ...(expectedHeadSha ? { expected_head_sha: expectedHeadSha } : {}),
    git_error: error?.code || "git_command_failed",
  });
}

module.exports = {
  GitProjectRepositoryStore,
  normalizeChanges,
  normalizeRepositoryPath,
  validateSha,
};
