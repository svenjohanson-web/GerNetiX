"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createProjectRepositoryRead } = require("../src/dev/project-repository-read");

const project = { project_server_id: "project-owned", owner_user_id: "account-owned" };
const headSha = "a".repeat(40);
const parentSha = "b".repeat(40);

test("uses the real Project Server repository endpoints for an active Forgejo binding", async () => {
  const calls = [];
  const read = createProjectRepositoryRead({
    projectServerJson: async (pathname) => {
      calls.push(pathname);
      if (pathname === "/api/projects/project-owned") return {
        repository_binding: {
          provider: "forgejo", state: "active", default_branch: "main", head_sha: headSha,
          organization: "must-not-leak", clone_url: "https://must-not-leak.invalid/repository.git",
        },
      };
      if (pathname === `/api/projects/project-owned/repository/tree?commit_sha=${headSha}`) return { commit_sha: headSha, paths: ["README.md"] };
      if (pathname === "/api/projects/project-owned/repository/history") return {
        commit_sha: headSha,
        items: [{ commit_sha: headSha, parent_shas: [parentSha], message: "Projekt geändert", authored_at: "2026-08-03T10:00:00Z" }],
      };
      if (pathname === `/api/projects/project-owned/repository/commits/${headSha}/diff`) return {
        commit_sha: headSha,
        parent_sha: parentSha,
        changes: [{ status: "renamed", old_path: "README.old.md", path: "README.md" }],
      };
      if (pathname === `/api/projects/project-owned/sources/README.md?commit_sha=${headSha}`) return {
        path: "README.md", content: "# Projekt\n", content_type: "text/markdown", size_bytes: 10, commit_sha: headSha,
      };
      throw new Error(`Unexpected path: ${pathname}`);
    },
  });

  const status = await read.status(project);
  assert.equal(status.contract_stub, false);
  assert.doesNotMatch(JSON.stringify(status), /organization|clone_url|must-not-leak/);
  assert.deepEqual(await read.tree(project, headSha), { commit_sha: headSha, paths: ["README.md"] });
  assert.equal((await read.file(project, "README.md", headSha)).content, "# Projekt\n");
  assert.deepEqual((await read.history(project)).items[0], {
    commit_sha: headSha,
    parent_commit_sha: parentSha,
    message: "Projekt geändert",
    kind: "git_commit",
    named_version_id: "",
    created_at: "2026-08-03T10:00:00Z",
  });
  assert.deepEqual((await read.diff(project, headSha)).files[0], {
    path: "README.md",
    previous_path: "README.old.md",
    status: "renamed",
    binary: false,
    truncated: true,
    patch: "",
  });
  assert.equal(calls.some((pathname) => pathname.endsWith("/versions")), false);
});

test("keeps the SQL/Git-Light read contract only as a transition for inactive bindings", async () => {
  const calls = [];
  const read = createProjectRepositoryRead({
    projectServerJson: async (pathname) => {
      calls.push(pathname);
      if (pathname === "/api/projects/project-owned") return { repository_binding: null };
      if (pathname === "/api/projects/project-owned/sources") return { items: [] };
      if (pathname === "/api/projects/project-owned/versions") return { items: [] };
      throw new Error(`Unexpected path: ${pathname}`);
    },
  });
  const status = await read.status(project);
  assert.equal(status.contract_stub, true);
  assert.equal(status.repository.state, "contract_stub");
  const history = await read.history(project);
  assert.equal(history.items[0].kind, "working_head");
  assert.equal(calls.some((pathname) => pathname.endsWith("/versions")), true);
});
