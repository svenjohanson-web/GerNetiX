"use strict";

const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { ProjectServerError } = require("../errors");
const { createGitCommandRunner } = require("./git-command-runner");

const SHA_PATTERN = /^[a-f0-9]{40}$/;
const BRANCH_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]{0,119}$/;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_READ_BYTES = 5 * 1024 * 1024;
const MAX_TREE_ENTRIES = 1000;

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
    const changes = normalizeChanges(input.changes, { allowEmpty: false, allowBinary: input.allow_binary === true });
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

  async importHistory(input = {}) {
    const remoteUrl = validateRemoteUrl(input.remote_url);
    const branch = validateBranch(input.branch || "main");
    if (!Array.isArray(input.commits) || input.commits.length === 0 || input.commits.length > 1000) {
      throw new ProjectServerError("repository_migration_commits_invalid", "Die Migrationshistorie muss zwischen 1 und 1000 Commits enthalten.");
    }
    return this.withWorkspace(async (workspace) => {
      await this.git(["init", "--initial-branch", branch], workspace);
      await this.configureIdentity(workspace);
      await this.git(["remote", "add", "origin", remoteUrl], workspace);
      let previousPaths = new Set();
      for (const rawCommit of input.commits) {
        const files = normalizeChanges(rawCommit.files, { allowEmpty: true, allowBinary: false, maxChanges: MAX_TREE_ENTRIES });
        const nextPaths = new Set(files.map((file) => file.path));
        const deletes = [...previousPaths].filter((entry) => !nextPaths.has(entry))
          .map((entry) => ({ operation: "delete", path: entry }));
        await applyChanges(workspace, [...deletes, ...files]);
        await this.git(["add", "--all", "--", "."], workspace);
        const identity = migrationIdentity(rawCommit);
        await this.git([
          "commit", "--allow-empty", "--message", migrationMessage(rawCommit.message),
        ], workspace, { env: identity.env });
        const headSha = await this.revParse(workspace, "HEAD");
        const expected = validateSha(rawCommit.expected_commit_oid, "expected_commit_oid");
        if (headSha !== expected) {
          throw new ProjectServerError("repository_migration_commit_mismatch", "Der erzeugte Git-Commit stimmt nicht mit dem freigegebenen Migrationsplan überein.", 409, {
            expected_commit_oid: expected,
            actual_commit_oid: headSha,
          });
        }
        previousPaths = nextPaths;
      }
      const headSha = await this.revParse(workspace, "HEAD");
      try {
        await this.git(["push", "origin", `HEAD:refs/heads/${branch}`], workspace);
      } catch (error) {
        throw gitConflict(error, "repository_migration_push_conflict", "Das Ziel-Repository wurde gleichzeitig verändert.");
      }
      return { head_sha: headSha, branch, commit_count: input.commits.length, no_change: false };
    });
  }

  async commit(input = {}) {
    const remoteUrl = validateRemoteUrl(input.remote_url);
    const branch = validateBranch(input.branch || "main");
    const expectedHeadSha = validateSha(input.expected_head_sha, "expected_head_sha");
    const changes = normalizeChanges(input.changes, { allowEmpty: false, allowBinary: input.allow_binary === true });
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

  async head(input = {}) {
    const remoteUrl = validateRemoteUrl(input.remote_url);
    const branch = validateBranch(input.branch || "main");
    return this.withFetchedBranch(remoteUrl, branch, async (workspace) => ({
      head_sha: await this.revParse(workspace, "FETCH_HEAD"), branch,
    }));
  }

  async tree(input = {}) {
    const remoteUrl = validateRemoteUrl(input.remote_url);
    const commitSha = validateSha(input.commit_sha, "commit_sha");
    const branch = input.branch ? validateBranch(input.branch) : "";
    return this.withFetchedCommit(remoteUrl, commitSha, async (workspace) => {
      const entries = await this.treeEntries(workspace, commitSha);
      for (const entry of entries) this.assertReadableTreeEntry(entry);
      return entries.map((entry) => entry.path);
    }, branch);
  }

  async readFile(input = {}) {
    const remoteUrl = validateRemoteUrl(input.remote_url);
    const commitSha = validateSha(input.commit_sha, "commit_sha");
    const branch = input.branch ? validateBranch(input.branch) : "";
    const repositoryPath = normalizeRepositoryPath(input.path);
    return this.withFetchedCommit(remoteUrl, commitSha, async (workspace) => {
      const entry = (await this.treeEntries(workspace, commitSha)).find((item) => item.path === repositoryPath);
      if (!entry) throw new ProjectServerError("repository_file_not_found", "Projektdatei wurde nicht gefunden.", 404);
      return this.readTreeEntry(workspace, entry);
    }, branch);
  }

  async readFiles(input = {}) {
    const remoteUrl = validateRemoteUrl(input.remote_url);
    const commitSha = validateSha(input.commit_sha, "commit_sha");
    const branch = input.branch ? validateBranch(input.branch) : "";
    return this.withFetchedCommit(remoteUrl, commitSha, async (workspace) => {
      return this.readTreeEntries(workspace, await this.treeEntries(workspace, commitSha), input.allow_binary === true);
    }, branch);
  }

  async history(input = {}) {
    const remoteUrl = validateRemoteUrl(input.remote_url);
    const branch = validateBranch(input.branch || "main");
    const commitSha = validateSha(input.commit_sha, "commit_sha");
    const limit = Math.max(1, Math.min(100, Number(input.limit) || 30));
    return this.withFetchedBranch(remoteUrl, branch, async (workspace) => {
      await this.assertCommit(workspace, commitSha);
      const result = await this.git([
        "log", `--max-count=${limit}`, "--date=iso-strict",
        "--format=%H%x1f%P%x1f%an%x1f%ae%x1f%aI%x1f%s%x1e", commitSha,
      ], workspace, { maxOutputBytes: 128 * 1024 });
      return result.stdout.split("\x1e").map((record) => record.trim()).filter(Boolean).map((record) => {
        const [sha, parents, authorName, authorEmail, authoredAt, subject] = record.split("\x1f");
        return {
          commit_sha: validateSha(sha, "commit_sha"),
          parent_shas: String(parents || "").split(" ").filter(Boolean).map((parent) => validateSha(parent, "parent_sha")),
          author_name: authorName || "",
          author_email: authorEmail || "",
          authored_at: authoredAt || "",
          message: subject || "",
        };
      });
    });
  }

  async diff(input = {}) {
    const remoteUrl = validateRemoteUrl(input.remote_url);
    const branch = validateBranch(input.branch || "main");
    const commitSha = validateSha(input.commit_sha, "commit_sha");
    return this.withFetchedBranch(remoteUrl, branch, async (workspace) => {
      await this.assertCommit(workspace, commitSha);
      const parentResult = await this.git(["rev-list", "--parents", "-n", "1", commitSha], workspace);
      const parentSha = parentResult.stdout.trim().split(" ")[1] || "";
      const args = parentSha
        ? ["diff", "--find-renames", "--name-status", "-z", parentSha, commitSha]
        : ["diff-tree", "--root", "--no-commit-id", "--name-status", "-r", "-z", commitSha];
      const result = await this.git(args, workspace, { maxOutputBytes: 1024 * 1024 });
      return { commit_sha: commitSha, parent_sha: parentSha, changes: parseNameStatus(result.stdout) };
    });
  }

  async restore(input = {}) {
    const remoteUrl = validateRemoteUrl(input.remote_url);
    const branch = validateBranch(input.branch || "main");
    const expectedHeadSha = validateSha(input.expected_head_sha, "expected_head_sha");
    const restoreCommitSha = validateSha(input.restore_commit_sha, "restore_commit_sha");
    return this.withFetchedBranch(remoteUrl, branch, async (workspace) => {
      const actualHeadSha = await this.revParse(workspace, "FETCH_HEAD");
      if (actualHeadSha !== expectedHeadSha) throw new ProjectServerError("repository_head_conflict", "Der Repository-Stand wurde zwischenzeitlich geändert.", 409, {
        expected_head_sha: expectedHeadSha, actual_head_sha: actualHeadSha,
      });
      await this.assertCommit(workspace, restoreCommitSha);
      try {
        await this.git(["merge-base", "--is-ancestor", restoreCommitSha, expectedHeadSha], workspace);
      } catch {
        throw new ProjectServerError("repository_restore_commit_invalid", "Wiederherstellung ist nur aus der linearen Historie dieses Branches zulässig.", 409);
      }
      await this.readTreeEntries(workspace, await this.treeEntries(workspace, restoreCommitSha));
      const currentTree = await this.revParse(workspace, `${expectedHeadSha}^{tree}`);
      const restoredTree = await this.revParse(workspace, `${restoreCommitSha}^{tree}`);
      if (currentTree === restoredTree) return { head_sha: actualHeadSha, branch, changed_paths: [], no_change: true, restored_from_commit_sha: restoreCommitSha };
      await this.git(["checkout", "--detach", expectedHeadSha], workspace);
      await this.configureIdentity(workspace);
      await this.git(["read-tree", restoreCommitSha], workspace);
      const diffResult = await this.git(["diff", "--cached", "--name-only", "-z", expectedHeadSha], workspace, { maxOutputBytes: 1024 * 1024 });
      const changedPaths = diffResult.stdout.split("\0").filter(Boolean).map(normalizeRepositoryPath).sort();
      await this.git(["commit", "--message", commitMessage(input.message, `Projektstand ${restoreCommitSha.slice(0, 12)} wiederhergestellt`)], workspace);
      const headSha = await this.revParse(workspace, "HEAD");
      try {
        await this.git(["push", `--force-with-lease=refs/heads/${branch}:${expectedHeadSha}`, "origin", `HEAD:refs/heads/${branch}`], workspace);
      } catch (error) {
        throw gitConflict(error, "repository_head_conflict", "Der Repository-Stand wurde gleichzeitig geändert.", expectedHeadSha);
      }
      return { head_sha: headSha, branch, changed_paths: changedPaths, no_change: false, restored_from_commit_sha: restoreCommitSha };
    });
  }

  async treeEntries(workspace, commitSha) {
    const result = await this.git(["ls-tree", "-r", "-z", "--long", commitSha], workspace, { binaryOutput: true, maxOutputBytes: 1024 * 1024 });
    const entries = decodeUtf8Buffer(result.stdout, "repository_tree_encoding_invalid").split("\0").filter(Boolean).map(parseTreeEntry).sort((left, right) => left.path.localeCompare(right.path));
    if (entries.length > MAX_TREE_ENTRIES) throw new ProjectServerError("repository_tree_too_large", "Ein Projekt darf höchstens 1000 Dateien enthalten.", 413);
    return entries;
  }

  async readTreeEntry(workspace, entry, allowBinary = false) {
    this.assertReadableTreeEntry(entry);
    const result = await this.git(["cat-file", "blob", entry.blob_sha], workspace, { binaryOutput: true, maxOutputBytes: MAX_FILE_BYTES + 1 });
    try { return { ...entry, content: decodeUtf8Text(result.stdout, entry.path) }; }
    catch (error) {
      if (!allowBinary || !["repository_binary_forbidden", "repository_encoding_invalid"].includes(error.code)) throw error;
      return { ...entry, content_base64: Buffer.from(result.stdout).toString("base64"), binary: true };
    }
  }

  assertReadableTreeEntry(entry) {
    if (entry.mode === "120000") throw new ProjectServerError("repository_symlink_forbidden", "Symbolische Links sind in Projekt-Repositories nicht erlaubt.", 409, { path: entry.path });
    if (entry.type !== "blob") throw new ProjectServerError("repository_entry_type_forbidden", "Nur reguläre Projektdateien sind zulässig.", 409, { path: entry.path });
    if (entry.size_bytes > MAX_FILE_BYTES) throw new ProjectServerError("repository_file_too_large", "Eine Projektdatei darf höchstens 1 MiB groß sein.", 413, { path: entry.path });
  }

  async readTreeEntries(workspace, entries, allowBinary = false) {
    let totalBytes = 0;
    const files = [];
    for (const entry of entries) {
      totalBytes += entry.size_bytes;
      if (totalBytes > MAX_READ_BYTES) throw new ProjectServerError("repository_read_too_large", "Der gelesene Projektstand überschreitet 5 MiB Text.", 413);
      files.push(await this.readTreeEntry(workspace, entry, allowBinary));
    }
    return files;
  }

  async withFetchedCommit(remoteUrl, commitSha, callback, branch = "") {
    return this.withWorkspace(async (workspace) => {
      await this.git(["init"], workspace);
      await this.git(["remote", "add", "origin", remoteUrl], workspace);
      await this.git(branch
        ? ["fetch", "--no-tags", "--depth", "1", "origin", `refs/heads/${branch}`]
        : ["fetch", "--no-tags", "origin"], workspace);
      await this.assertCommit(workspace, commitSha);
      return callback(workspace);
    });
  }

  async withFetchedBranch(remoteUrl, branch, callback) {
    return this.withWorkspace(async (workspace) => {
      await this.git(["init"], workspace);
      await this.git(["remote", "add", "origin", remoteUrl], workspace);
      await this.git(["fetch", "--no-tags", "origin", `refs/heads/${branch}`], workspace);
      return callback(workspace);
    });
  }

  async assertCommit(workspace, commitSha) {
    let fetchedSha;
    try { fetchedSha = await this.revParse(workspace, `${commitSha}^{commit}`); } catch { throw new ProjectServerError("repository_commit_not_found", "Git-Commit wurde nicht gefunden.", 404); }
    if (fetchedSha !== commitSha) throw new ProjectServerError("repository_commit_not_found", "Git-Commit wurde nicht gefunden.", 404);
  }

  async configureIdentity(workspace) {
    await this.git(["config", "core.autocrlf", "false"], workspace);
    await this.git(["config", "core.safecrlf", "true"], workspace);
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

  git(args, cwd, options = {}) {
    return this.runGit(args, { cwd, authToken: this.authToken, ...options });
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

function parseTreeEntry(value) {
  const match = String(value).match(/^(\d{6}) ([^ ]+) ([a-f0-9]{40}) +(-|\d+)\t([\s\S]+)$/);
  if (!match) throw new ProjectServerError("repository_tree_invalid", "Git lieferte einen ungültigen Projektbaum.", 502);
  const [, mode, type, blobSha, rawSize, rawPath] = match;
  const repositoryPath = normalizeRepositoryPath(rawPath);
  if (mode === "120000") throw new ProjectServerError("repository_symlink_forbidden", "Symbolische Links sind in Projekt-Repositories nicht erlaubt.", 409, { path: repositoryPath });
  if (type !== "blob" || rawSize === "-") throw new ProjectServerError("repository_entry_type_forbidden", "Nur reguläre Projektdateien sind zulässig.", 409, { path: repositoryPath });
  const sizeBytes = Number(rawSize);
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 0) throw new ProjectServerError("repository_tree_invalid", "Git lieferte eine ungültige Dateigröße.", 502);
  if (sizeBytes > MAX_FILE_BYTES) throw new ProjectServerError("repository_file_too_large", "Eine Projektdatei darf höchstens 1 MiB groß sein.", 413, { path: repositoryPath });
  return { path: repositoryPath, mode, type, blob_sha: blobSha, size_bytes: sizeBytes };
}

function decodeUtf8Text(buffer, repositoryPath) {
  if (!Buffer.isBuffer(buffer)) buffer = Buffer.from(buffer || "");
  if (buffer.includes(0)) throw new ProjectServerError("repository_binary_forbidden", "Binärdateien sind im Projektquellen-Repository nicht zulässig.", 415, { path: repositoryPath });
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buffer); } catch {
    throw new ProjectServerError("repository_encoding_invalid", "Projektdateien müssen gültiges UTF-8 enthalten.", 415, { path: repositoryPath });
  }
}

function decodeUtf8Buffer(buffer, code) {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buffer); } catch {
    throw new ProjectServerError(code, "Repository-Pfade müssen gültiges UTF-8 enthalten.", 415);
  }
}

function parseNameStatus(value) {
  const parts = String(value || "").split("\0").filter(Boolean);
  const changes = [];
  for (let index = 0; index < parts.length;) {
    const status = parts[index++];
    if (/^R\d+$/.test(status)) {
      changes.push({ status: "renamed", old_path: normalizeRepositoryPath(parts[index++]), path: normalizeRepositoryPath(parts[index++]) });
    } else {
      const statusMap = { A: "added", M: "modified", D: "deleted", T: "type_changed" };
      changes.push({ status: statusMap[status] || status.toLowerCase(), path: normalizeRepositoryPath(parts[index++]) });
    }
  }
  return changes;
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
    await fs.writeFile(absolutePath, change.content_base64 ? Buffer.from(change.content_base64, "base64") : change.content, change.content_base64 ? undefined : "utf8");
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
  const maxChanges = Number.isInteger(options.maxChanges) ? options.maxChanges : 100;
  if (input.length > maxChanges) throw new ProjectServerError("repository_change_limit_exceeded", `Ein Commit darf höchstens ${maxChanges} Dateiänderungen enthalten.`, 413);
  let totalBytes = 0;
  const paths = new Set();
  return input.map((raw) => {
    if (raw?.operation !== undefined && !["upsert", "delete"].includes(raw.operation)) {
      throw new ProjectServerError("repository_operation_invalid", "Dateioperation muss upsert oder delete sein.");
    }
    const operation = raw?.operation === "delete" ? "delete" : "upsert";
    const repositoryPath = normalizeRepositoryPath(raw?.path);
    if (paths.has(repositoryPath)) throw new ProjectServerError("duplicate_repository_path", "Ein Pfad darf pro Commit nur einmal vorkommen.");
    paths.add(repositoryPath);
    const binary = operation === "upsert" && raw?.content_base64 !== undefined;
    if (binary && !options.allowBinary) throw new ProjectServerError("repository_binary_forbidden", "Binary content is not permitted.", 415, { path: repositoryPath });
    const contentBase64 = binary ? String(raw.content_base64) : "";
    const binaryContent = binary ? Buffer.from(contentBase64, "base64") : null;
    if (binary && binaryContent.toString("base64") !== contentBase64) throw new ProjectServerError("repository_binary_invalid", "Binary content must use canonical base64.", 415, { path: repositoryPath });
    const content = operation === "upsert" && !binary ? String(raw?.content ?? "") : "";
    if (content.includes("\0")) throw new ProjectServerError("repository_binary_forbidden", "Binärdateien sind im Projektquellen-Repository nicht zulässig.", 415, { path: repositoryPath });
    const bytes = binary ? binaryContent.length : Buffer.byteLength(content);
    if (bytes > 1024 * 1024) throw new ProjectServerError("repository_file_too_large", "Eine Projektdatei darf höchstens 1 MiB groß sein.", 413);
    totalBytes += bytes;
    if (totalBytes > 5 * 1024 * 1024) throw new ProjectServerError("repository_commit_too_large", "Ein Projektcommit darf höchstens 5 MiB Text enthalten.", 413);
    return { operation, path: repositoryPath, content, ...(binary ? { content_base64: contentBase64 } : {}) };
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

function migrationIdentity(input = {}) {
  const name = String(input.author_name || "");
  const email = String(input.author_email || "");
  const timestamp = String(input.git_timestamp || "");
  if (!/^GerNetiX Migration [a-f0-9]{12}$/.test(name)
    || !/^migration\+[a-f0-9]{16}@invalid\.gernetix$/.test(email)
    || !/^\d+ \+0000$/.test(timestamp)) {
    throw new ProjectServerError("repository_migration_identity_invalid", "Die pseudonymisierte Migrationsidentität ist ungültig.");
  }
  return { env: {
    GIT_AUTHOR_NAME: name,
    GIT_AUTHOR_EMAIL: email,
    GIT_AUTHOR_DATE: timestamp,
    GIT_COMMITTER_NAME: name,
    GIT_COMMITTER_EMAIL: email,
    GIT_COMMITTER_DATE: timestamp,
  } };
}

function migrationMessage(value) {
  const message = String(value || "").replace(/\r\n?/g, "\n").trimEnd();
  if (!message || Buffer.byteLength(message) > 16 * 1024 || message.includes("\0")) {
    throw new ProjectServerError("repository_migration_message_invalid", "Die Migrations-Commitnachricht ist ungültig.");
  }
  return message;
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
