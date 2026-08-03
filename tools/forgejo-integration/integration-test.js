#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const { ForgejoClient } = require("../../services/project-server/src/repository-store/forgejo-client");
const { ForgejoProjectRepositoryStore } = require("../../services/project-server/src/repository-store/forgejo-project-repository-store");
const { GitProjectRepositoryStore } = require("../../services/project-server/src/repository-store/git-project-repository-store");

const baseUrl = required(process.env.FORGEJO_BASE_URL, "FORGEJO_BASE_URL");
const token = required(process.env.FORGEJO_TOKEN, "FORGEJO_TOKEN");
const statePath = required(process.env.TEST_STATE_PATH, "TEST_STATE_PATH");
const organization = "gernetix-integration";

async function main() {
  if (process.env.TEST_PHASE === "restart") {
    await verifyAfterRestart();
    return;
  }
  await runInitialPhase();
}

async function runInitialPhase() {
  const health = await fetch(`${baseUrl}/api/healthz`);
  assert.equal(health.ok, true, "Forgejo ist im internen Compose-Netz erreichbar");

  await ensureOrganization();
  const client = new ForgejoClient({ baseUrl, token });
  const git = new GitProjectRepositoryStore({ authToken: token });
  const store = new ForgejoProjectRepositoryStore({ client, git, organization });
  const binding = await store.provisionProject({
    project_id: "synthetic-project",
    message: "Synthetisches Integrationsprojekt anlegen",
    changes: [
      { path: "README.md", content: "# Synthetisches Projekt\n" },
      { path: "src/main.cpp", content: "void setup() {}\n" },
      { path: "docs/Grüße.md", content: "Grüße 🌍\n" },
      { path: "docs/empty.txt", content: "" },
    ],
  });
  assert.match(binding.head_sha, /^[a-f0-9]{40}$/);

  const repository = await client.getRepository(binding.organization, binding.repository_name);
  assert.equal(repository.private, true, "das synthetische Repository ist privat");
  const initialHistory = await store.history(binding, { commit_sha: binding.head_sha, limit: 2 });
  assert.equal(initialHistory.length, 1, "der Initialcommit ist die Wurzel der Git-Historie");
  assert.equal(initialHistory[0].commit_sha, binding.head_sha);
  assert.equal(initialHistory[0].message, "Synthetisches Integrationsprojekt anlegen");
  assert.equal((await store.readFile(binding, binding.head_sha, "docs/Grüße.md")).content, "Grüße 🌍\n");
  assert.equal((await store.readFile(binding, binding.head_sha, "docs/empty.txt")).content, "");

  const written = await store.commitChanges(binding, {
    expected_head_sha: binding.head_sha,
    message: "Dateien schreiben und ändern",
    changes: [
      { path: "src/main.cpp", content: "void setup() { /* geändert */ }\n" },
      { path: "docs/new.txt", content: "synthetisch\n" },
    ],
  });
  binding.head_sha = written.head_sha;
  assert.equal((await store.readFile(binding, binding.head_sha, "docs/new.txt")).content, "synthetisch\n");

  const renamed = await store.commitChanges(binding, {
    expected_head_sha: binding.head_sha,
    message: "Datei umbenennen",
    changes: [
      { path: "docs/new.txt", operation: "delete" },
      { path: "docs/renamed.txt", content: "synthetisch\n" },
    ],
  });
  binding.head_sha = renamed.head_sha;
  const renameDiff = await store.diff(binding, binding.head_sha);
  assert.deepEqual(renameDiff.changes, [{ status: "renamed", old_path: "docs/new.txt", path: "docs/renamed.txt" }]);

  const deleted = await store.commitChanges(binding, {
    expected_head_sha: binding.head_sha,
    message: "Datei löschen",
    changes: [{ path: "README.md", operation: "delete" }],
  });
  binding.head_sha = deleted.head_sha;
  assert.equal((await store.tree(binding, binding.head_sha)).includes("README.md"), false);

  await assert.rejects(store.commitChanges(binding, {
    expected_head_sha: written.head_sha,
    message: "Veralteten Head abweisen",
    changes: [{ path: "stale.txt", content: "darf nicht geschrieben werden\n" }],
  }), (error) => error.code === "repository_head_conflict"
    && error.details.expected_head_sha === written.head_sha
    && error.details.actual_head_sha === binding.head_sha);

  await fs.mkdir(path.dirname(statePath), { recursive: true });
  await fs.writeFile(statePath, JSON.stringify({ binding }, null, 2), { mode: 0o600 });
  process.stdout.write("OK initial: intern erreichbar, privat, Initialcommit, Lesen/Schreiben/Rename/Delete und Head-Konflikt\n");
}

async function verifyAfterRestart() {
  const state = JSON.parse(await fs.readFile(statePath, "utf8"));
  const client = new ForgejoClient({ baseUrl, token });
  const git = new GitProjectRepositoryStore({ authToken: token });
  const store = new ForgejoProjectRepositoryStore({ client, git, organization });
  const actualHead = await git.head({ remote_url: state.binding.clone_url, branch: state.binding.default_branch });
  assert.equal(actualHead.head_sha, state.binding.head_sha);
  const persisted = await store.readFile(state.binding, actualHead.head_sha, "docs/renamed.txt");
  assert.equal(persisted.content, "synthetisch\n");
  assert.equal((await client.getRepository(state.binding.organization, state.binding.repository_name)).private, true);
  process.stdout.write("OK restart: Repository, privater Status, Head und Dateiinhalt sind persistent\n");
}

async function ensureOrganization() {
  const response = await fetch(`${baseUrl}/api/v1/orgs`, {
    method: "POST",
    headers: { Authorization: `token ${token}`, "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ username: organization, full_name: "Synthetic integration organization", visibility: "private" }),
  });
  if (response.ok) return;
  if (response.status === 422) {
    const existing = await fetch(`${baseUrl}/api/v1/orgs/${organization}`, { headers: { Authorization: `token ${token}`, Accept: "application/json" } });
    assert.equal(existing.ok, true, "bestehende synthetische Organisation ist lesbar");
    return;
  }
  throw new Error(`organization_create_failed:${response.status}`);
}

function required(value, name) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new Error(`${name}_required`);
  return normalized;
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
