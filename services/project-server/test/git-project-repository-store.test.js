"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const test = require("node:test");
const { createGitCommandRunner } = require("../src/repository-store/git-command-runner");
const { GitProjectRepositoryStore } = require("../src/repository-store/git-project-repository-store");

test("creates and updates a real repository atomically with an expected head", async (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-git-store-test-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const remote = path.join(root, "remote");
  run(["init", "--initial-branch", "main", remote]);
  run(["-C", remote, "config", "receive.denyCurrentBranch", "updateInstead"]);
  const fakeRemote = "https://forgejo.invalid/gernetix/project.git";
  const actualRunner = createGitCommandRunner({ gitBinary: "git" });
  const store = new GitProjectRepositoryStore({
    tempRoot: root,
    runGit: (args, options) => actualRunner(args.map((argument) => argument === fakeRemote ? remote : argument), options),
  });

  const initialized = await store.initialize({
    remote_url: fakeRemote,
    changes: [
      { path: "README.md", content: "# Projekt\n" },
      { path: "src/main.cpp", content: "void setup() {}\n" },
    ],
  });
  assert.match(initialized.head_sha, /^[a-f0-9]{40}$/);
  assert.equal(fs.readFileSync(path.join(remote, "src/main.cpp"), "utf8"), "void setup() {}\n");

  const committed = await store.commit({
    remote_url: fakeRemote,
    expected_head_sha: initialized.head_sha,
    message: "Main und README aktualisieren",
    changes: [
      { path: "src/main.cpp", content: "void setup() { /* neu */ }\n" },
      { path: "README.md", operation: "delete" },
    ],
  });
  assert.notEqual(committed.head_sha, initialized.head_sha);
  assert.equal(fs.existsSync(path.join(remote, "README.md")), false);
  assert.equal(fs.readFileSync(path.join(remote, "src/main.cpp"), "utf8"), "void setup() { /* neu */ }\n");
  assert.deepEqual(await store.tree({ remote_url: fakeRemote, commit_sha: committed.head_sha }), ["src/main.cpp"]);

  const noChange = await store.commit({
    remote_url: fakeRemote,
    expected_head_sha: committed.head_sha,
    changes: [{ path: "src/main.cpp", content: "void setup() { /* neu */ }\n" }],
  });
  assert.equal(noChange.no_change, true);
  assert.equal(noChange.head_sha, committed.head_sha);

  await assert.rejects(store.commit({
    remote_url: fakeRemote,
    expected_head_sha: initialized.head_sha,
    changes: [{ path: "src/main.cpp", content: "stale\n" }],
  }), (error) => error.code === "repository_head_conflict" && error.details.actual_head_sha === committed.head_sha);

  fs.mkdirSync(path.join(root, "outside"));
  fs.symlinkSync(path.join(root, "outside"), path.join(remote, "linked"));
  run(["-C", remote, "config", "user.name", "Test"]);
  run(["-C", remote, "config", "user.email", "test@example.invalid"]);
  run(["-C", remote, "add", "linked"]);
  run(["-C", remote, "commit", "-m", "symlink fixture"]);
  const symlinkHead = run(["-C", remote, "rev-parse", "HEAD"]).trim();
  await assert.rejects(store.commit({
    remote_url: fakeRemote,
    expected_head_sha: symlinkHead,
    changes: [{ path: "linked/escape.txt", content: "forbidden\n" }],
  }), (error) => error.code === "repository_symlink_forbidden");
  assert.equal(fs.existsSync(path.join(root, "outside", "escape.txt")), false);
});

test("rejects traversal duplicate paths and oversized files before invoking Git", async () => {
  const store = new GitProjectRepositoryStore({ runGit: async () => { throw new Error("must_not_run"); } });
  await assert.rejects(store.commit({ remote_url: "https://forgejo.invalid/a.git", expected_head_sha: "a".repeat(40), changes: [{ path: "../secret", content: "x" }] }), /Pfad/);
  await assert.rejects(store.commit({ remote_url: "https://forgejo.invalid/a.git", expected_head_sha: "a".repeat(40), changes: [{ path: "a.txt", content: "x" }, { path: "a.txt", operation: "delete" }] }), /nur einmal/);
  await assert.rejects(store.commit({ remote_url: "https://forgejo.invalid/a.git", expected_head_sha: "a".repeat(40), changes: [{ path: "a.txt", content: "x".repeat(1024 * 1024 + 1) }] }), /1 MiB/);
  await assert.rejects(store.commit({ remote_url: "https://user:secret@forgejo.invalid/a.git", expected_head_sha: "a".repeat(40), changes: [{ path: "a.txt", content: "x" }] }), /Remote/);
  await assert.rejects(store.commit({ remote_url: "https://forgejo.invalid/a.git", expected_head_sha: "a".repeat(40), changes: [{ path: ".GIT/config", content: "x" }] }), /Pfad/);
});

function run(args) {
  return execFileSync("git", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}
