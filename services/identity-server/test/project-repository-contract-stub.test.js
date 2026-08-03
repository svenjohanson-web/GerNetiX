"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const {
  MAX_PREVIEW_BYTES,
  buildDiff,
  createProjectRepositoryContractStub,
  filePayload,
  validatePath,
} = require("../src/dev/project-repository-contract-stub");

const project = { project_server_id: "project-owned" };
const currentSources = [
  { path: "README.md", content: "Hallo 🌍\n", content_type: "text/markdown" },
  { path: "src/main.cpp", content: "int main() { return 0; }\n", content_type: "text/x-c++src" },
];
const version = {
  version_id: "version-1",
  snapshot_sha256: "b".repeat(64),
  message: "Erster Stand",
  commit_kind: "snapshot",
  created_at: "2026-08-03T10:00:00.000Z",
  sources: [
    { path: "README.old.md", content: "Hallo 🌍\n", content_type: "text/markdown" },
    { path: "src/main.cpp", content: "int main() { return 1; }\n", content_type: "text/x-c++src" },
  ],
};

function createStub() {
  const calls = [];
  const projectServerJson = async (pathname) => {
    calls.push(pathname);
    if (pathname === "/api/projects/project-owned") return {
      project_id: "project-owned",
      repository_binding: {
        provider: "forgejo",
        state: "active",
        default_branch: "main",
        head_sha: "a".repeat(40),
        remote_url: "https://token:secret@forgejo.internal/project.git",
        runtime_token: "do-not-leak",
      },
    };
    if (pathname === "/api/projects/project-owned/sources") return { items: currentSources.map(({ content, ...source }) => source) };
    if (pathname === "/api/projects/project-owned/versions") return { items: [version] };
    if (pathname.endsWith("/sources/README.md")) return currentSources[0];
    if (pathname.endsWith("/sources/src%2Fmain.cpp")) return currentSources[1];
    throw new Error(`Unexpected path: ${pathname}`);
  };
  return { calls, stub: createProjectRepositoryContractStub({ projectServerJson }) };
}

test("returns the documented read contract without Forgejo URLs or credentials", async () => {
  const { stub } = createStub();
  const status = await stub.status(project);
  assert.deepEqual(status.repository, {
    state: "active",
    provider: "forgejo",
    default_branch: "main",
    head_sha: "a".repeat(40),
    read_only: true,
  });
  assert.equal(status.contract_stub, true);
  assert.doesNotMatch(JSON.stringify(status), /remote_url|runtime_token|secret|forgejo\.internal/i);

  const tree = await stub.tree(project, "a".repeat(40));
  assert.deepEqual(tree, { commit_sha: "a".repeat(40), paths: ["README.md", "src/main.cpp"] });
  const file = await stub.file(project, "README.md", "a".repeat(40));
  assert.equal(file.content, "Hallo 🌍\n");
  assert.equal(file.binary, false);
});

test("rejects foreign commit identifiers and unsafe file paths inside the selected project", async () => {
  const { stub } = createStub();
  await assert.rejects(stub.tree(project, "c".repeat(40)), { code: "repository_commit_not_found", status: 404 });
  await assert.rejects(stub.file(project, "../secret", "a".repeat(40)), { code: "invalid_repository_path", status: 400 });
  assert.throws(() => validatePath(".git/config"), { code: "invalid_repository_path" });
});

test("history and diff distinguish working head, named version, rename and modification", async () => {
  const { stub } = createStub();
  const history = await stub.history(project);
  assert.equal(history.items[0].kind, "working_head");
  assert.equal(history.items[1].commit_sha, "b".repeat(40));
  const diff = await stub.diff(project, "a".repeat(40));
  assert.deepEqual(diff.files.map((file) => [file.status, file.previous_path, file.path]), [
    ["renamed", "README.old.md", "README.md"],
    ["modified", "", "src/main.cpp"],
  ]);
  assert.match(diff.files[1].patch, /-int main\(\) \{ return 1; \}/);
  assert.match(diff.files[1].patch, /\+int main\(\) \{ return 0; \}/);
});

test("file previews identify binary and oversized content without returning it", () => {
  const binary = filePayload("a".repeat(40), { path: "firmware.bin", content_type: "application/octet-stream", content: "\0abc" });
  assert.equal(binary.binary, true);
  assert.equal(binary.content, "");
  const large = filePayload("a".repeat(40), { path: "large.txt", content_type: "text/plain", content: "x".repeat(MAX_PREVIEW_BYTES + 1) });
  assert.equal(large.truncated, true);
  assert.equal(large.content, "");
  assert.deepEqual(buildDiff([{ path: "a.txt", content: "same" }], [{ path: "a.txt", content: "same" }]), []);
});
