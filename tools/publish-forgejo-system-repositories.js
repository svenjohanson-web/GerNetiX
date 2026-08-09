"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { ForgejoClient } = require("../services/project-server/src/repository-store/forgejo-client");
const { GitProjectRepositoryStore } = require("../services/project-server/src/repository-store/git-project-repository-store");

const workspaceRoot = path.resolve(__dirname, "..");
const APPLY = process.argv.includes("--apply");
const DEFINITIONS = [
  definition("gernetix-runtime-basissoftware", "Basissoftware ESP32", "basissoftware", "gernetix-platform", "basissoftware-esp32", "basissoftware/esp32", "FORGEJO_ESP32_BASIS_COMMIT"),
  definition("gernetix-runtime-basissoftware-esp8266", "Basissoftware ESP8266", "basissoftware", "gernetix-platform", "basissoftware-esp8266", "basissoftware/esp8266", "FORGEJO_ESP8266_BASIS_COMMIT"),
  definition("gernetix-product-nexi", "Nexi", "product", "gernetix-products", "nexi", "projects/waveshare-voice-lab", "FORGEJO_NEXI_COMMIT"),
  definition("gernetix-product-flashbox", "FlashBox", "product", "gernetix-products", "flashbox", "firmware/gernetix-flashbox", "FORGEJO_FLASHBOX_COMMIT"),
  definition("gernetix-product-game-collection-esp8266", "Spielesammlung ESP8266 OLED", "product", "gernetix-products", "spielesammlung-esp8266-oled", "Demoanwendungen/Boards/hardware.processor_board.diymore_hw_364a_esp8266_oled/ein-tasten-spielesammlung/firmware", "FORGEJO_ESP8266_GAME_COLLECTION_COMMIT"),
  definition("gernetix-product-game-collection-esp32", "Spielesammlung ESP32-S3 Touch", "product", "gernetix-products", "spielesammlung-esp32-s3-touch", "Demoanwendungen/Boards/hardware.processor_board.esp32_s3_es3c28p/touch-spielesammlung/firmware", "FORGEJO_ESP32_GAME_COLLECTION_COMMIT"),
];

async function main() {
  const plans = DEFINITIONS.map((item) => ({ ...item, file_count: sourceFiles(item).length }));
  if (!APPLY) {
    process.stdout.write(`${JSON.stringify({ mode: "plan", repositories: plans }, null, 2)}\n`);
    return;
  }
  const baseUrl = required(process.env.FORGEJO_INTERNAL_URL, "FORGEJO_INTERNAL_URL");
  const provisionToken = required(process.env.FORGEJO_PROVISION_TOKEN, "FORGEJO_PROVISION_TOKEN");
  const runtimeToken = required(process.env.FORGEJO_RUNTIME_TOKEN, "FORGEJO_RUNTIME_TOKEN");
  const client = new ForgejoClient({ baseUrl, token: provisionToken });
  const git = new GitProjectRepositoryStore({ authToken: runtimeToken, timeoutMs: Number(process.env.PROJECT_GIT_TIMEOUT_MS || 120_000) });
  for (const organization of new Set(DEFINITIONS.map((item) => item.organization))) {
    await client.ensureOrganization(organization, { full_name: organization === "gernetix-platform" ? "GerNetiX Platform" : "GerNetiX Products" });
  }
  const published = [];
  for (const item of DEFINITIONS) published.push(await publishOne(client, git, item));
  process.stdout.write(`${JSON.stringify({ mode: "applied", repositories: published }, null, 2)}\n`);
}

async function publishOne(client, git, item) {
  const ensured = await client.ensureOrganizationRepository(item.organization, {
    name: item.repository_name,
    description: `${item.title} - systemverwaltete GerNetiX Quelle`,
    default_branch: "main",
  });
  const remoteUrl = String(ensured.repository?.clone_url || "");
  const changes = sourceFiles(item);
  if (ensured.created || ensured.repository?.empty) {
    const commit = await initializeInBatches(git, remoteUrl, item.title, changes);
    return publishedResult(item, commit.head_sha, "created", changes.length);
  }
  const head = await git.head({ remote_url: remoteUrl, branch: "main" });
  const existing = await git.readFiles({ remote_url: remoteUrl, commit_sha: head.head_sha, branch: "main", allow_binary: true });
  const pendingChanges = treeChanges(existing, changes);
  if (pendingChanges.length === 0) return publishedResult(item, head.head_sha, "unchanged", changes.length);
  const commit = await commitInBatches(git, remoteUrl, item.title, head.head_sha, pendingChanges, "Systemquelle abgeglichen");
  return publishedResult(item, commit.head_sha, "updated", changes.length);
}

async function initializeInBatches(git, remoteUrl, title, changes) {
  const batches = changeBatches(changes);
  let commit = await git.initialize({
    remote_url: remoteUrl,
    branch: "main",
    message: batchMessage("Initialer Import", title, 1, batches.length),
    changes: batches[0], allow_binary: true,
  });
  for (let index = 1; index < batches.length; index += 1) {
    commit = await git.commit({
      remote_url: remoteUrl,
      branch: "main",
      expected_head_sha: commit.head_sha,
      message: batchMessage("Initialer Import", title, index + 1, batches.length),
      changes: batches[index], allow_binary: true,
    });
  }
  return commit;
}

async function commitInBatches(git, remoteUrl, title, headSha, changes, prefix) {
  const batches = changeBatches(changes);
  let currentHead = headSha;
  let commit = null;
  for (let index = 0; index < batches.length; index += 1) {
    commit = await git.commit({
      remote_url: remoteUrl,
      branch: "main",
      expected_head_sha: currentHead,
      message: batchMessage(prefix, title, index + 1, batches.length),
      changes: batches[index], allow_binary: true,
    });
    currentHead = commit.head_sha;
  }
  return commit;
}

function changeBatches(changes) {
  const batches = [];
  for (let index = 0; index < changes.length; index += 100) batches.push(changes.slice(index, index + 100));
  return batches;
}

function batchMessage(prefix, title, number, total) {
  return total === 1 ? `${prefix}: ${title}` : `${prefix}: ${title} (${number}/${total})`;
}

function sourceFiles(item) {
  const prefix = `${item.source_root.replace(/\\/g, "/").replace(/\/$/, "")}/`;
  const files = listSourceFiles(path.resolve(workspaceRoot, item.source_root), item.source_root);
  const result = files.map((relativeWorkspacePath) => {
    const relativePath = relativeWorkspacePath.replace(/\\/g, "/");
    if (!relativePath.startsWith(prefix)) throw new Error(`system_repository_source_outside_root:${relativePath}`);
    const filePath = path.resolve(workspaceRoot, relativeWorkspacePath);
    const stat = fs.statSync(filePath);
    if (stat.size > 1024 * 1024) throw new Error(`system_repository_file_too_large:${relativePath}`);
    const buffer = fs.readFileSync(filePath);
    const content = buffer.toString("utf8");
    const binary = content.includes("\0") || Buffer.from(content, "utf8").compare(buffer) !== 0;
    return {
      operation: "upsert",
      path: relativePath.slice(prefix.length),
      ...(binary ? { content_base64: buffer.toString("base64") } : { content }),
    };
  });
  result.push({
    operation: "upsert",
    path: "gernetix/system-repository.json",
    content: `${JSON.stringify({ schema_version: 1, source_id: item.source_id, title: item.title, kind: item.kind, protected: true }, null, 2)}\n`,
  });
  return result.sort((left, right) => left.path.localeCompare(right.path));
}

function listSourceFiles(directory, relativeRoot) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if ([".git", ".pio", ".runtime", "node_modules", "managed_components", "Desktop", "g"].includes(entry.name)) continue;
    const relativePath = path.posix.join(relativeRoot.replace(/\\/g, "/"), entry.name);
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...listSourceFiles(absolutePath, relativePath));
    else if (entry.isFile()) files.push(relativePath);
  }
  return files;
}

function treeChanges(existing, changes) {
  const current = new Map((existing || []).map((item) => [item.path, contentSignature(item)]));
  const desired = new Map(changes.map((item) => [item.path, contentSignature(item)]));
  const pending = changes.filter((item) => current.get(item.path) !== contentSignature(item));
  for (const path of current.keys()) {
    if (!desired.has(path)) pending.push({ operation: "delete", path });
  }
  return pending.sort((left, right) => left.path.localeCompare(right.path));
}

function contentSignature(item) {
  return item.content_base64 === undefined ? `text:${item.content}` : `binary:${item.content_base64}`;
}

function publishedResult(item, commitSha, state, fileCount) {
  return { ...item, commit_sha: commitSha, state, file_count: fileCount, environment_variable: `${item.commit_environment}=${commitSha}` };
}

function definition(sourceId, title, kind, organization, repositoryName, sourceRoot, commitEnvironment) {
  return { source_id: sourceId, title, kind, organization, repository_name: repositoryName, source_root: sourceRoot, commit_environment: commitEnvironment };
}

function required(value, name) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${name}_required`);
  return normalized;
}

main().catch((error) => {
  process.stderr.write(`${error.message || error}\n`);
  process.exitCode = 1;
});
