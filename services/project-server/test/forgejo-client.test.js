"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { ForgejoClient } = require("../src/repository-store/forgejo-client");
const { ForgejoProjectRepositoryStore, repositoryNameForProject } = require("../src/repository-store/forgejo-project-repository-store");

test("provisions a private repository with separated REST and Git adapters", async () => {
  const calls = [];
  const client = new ForgejoClient({
    baseUrl: "http://forgejo:3000",
    token: "provision-secret",
    fetch: async (url, options) => {
      calls.push({ url, options });
      if (options.method === "GET") return response(404, {});
      return response(201, { id: 42, clone_url: "http://forgejo:3000/gernetix-projects/project.git", empty: true });
    },
  });
  let gitInput;
  const store = new ForgejoProjectRepositoryStore({
    client,
    git: { initialize: async (input) => { gitInput = input; return { head_sha: "a".repeat(40) }; } },
    organization: "gernetix-projects",
  });

  const binding = await store.provisionProject({ project_id: "project-1", changes: [{ path: "README.md", content: "Hallo" }] });
  assert.equal(binding.state, "active");
  assert.equal(binding.head_sha, "a".repeat(40));
  assert.equal(gitInput.remote_url, "http://forgejo:3000/gernetix-projects/project.git");
  assert.equal(calls[1].options.headers.Authorization, "token provision-secret");
  assert.equal(JSON.parse(calls[1].options.body).private, true);
  assert.equal(JSON.parse(calls[1].options.body).auto_init, false);
  assert.notEqual(repositoryNameForProject("project-1"), repositoryNameForProject("project-2"));
});

test("retries safe reads once but never retries repository creation", async () => {
  let reads = 0;
  const client = new ForgejoClient({
    baseUrl: "https://forgejo.invalid",
    fetch: async (_url, options) => {
      if (options.method === "GET") {
        reads += 1;
        if (reads === 1) throw new Error("temporary");
        return response(200, { id: 1 });
      }
      throw new Error("write-failed");
    },
  });
  assert.equal((await client.getRepository("org", "repo")).id, 1);
  assert.equal(reads, 2);
  await assert.rejects(client.createOrganizationRepository("org", { name: "repo" }), (error) => error.code === "forgejo_unavailable");
});

test("resumes provisioning idempotently when the exact initial tree already exists", async () => {
  const client = {
    baseUrl: "http://forgejo:3000",
    ensureOrganizationRepository: async () => ({
      created: false,
      repository: { id: 42, clone_url: "http://forgejo:3000/gernetix-projects/project.git", empty: false },
    }),
  };
  const git = {
    head: async () => ({ head_sha: "a".repeat(40), branch: "main" }),
    readFiles: async () => [{ path: "README.md", content: "Hallo", size_bytes: 5, blob_sha: "b".repeat(40) }],
    initialize: async () => { throw new Error("must_not_initialize_twice"); },
  };
  const store = new ForgejoProjectRepositoryStore({ client, git, organization: "gernetix-projects" });
  const binding = await store.provisionProject({ project_id: "project-1", changes: [{ path: "README.md", content: "Hallo" }] });
  assert.equal(binding.head_sha, "a".repeat(40));
  await assert.rejects(store.provisionProject({ project_id: "project-1", changes: [{ path: "README.md", content: "Anders" }] }), (error) => error.code === "repository_already_provisioned");
});

function response(status, payload) {
  return { status, ok: status >= 200 && status < 300, json: async () => payload };
}
