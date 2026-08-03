"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const {
  buildDryRunReport,
  canonicalJson,
} = require("./forgejo-migration-dry-run");
const expectedResults = require("./fixtures/forgejo-migration-dry-run/expected-results");
const { syntheticCases } = require("./fixtures/forgejo-migration-dry-run/synthetic-inventories");

for (const fixture of syntheticCases) {
  test(`synthetic Forgejo migration fixture: ${fixture.id}`, () => {
    const expected = expectedResults[fixture.id];
    assert.ok(expected, `expected result missing for ${fixture.id}`);
    assert.equal(fixture.inventory.source_kind, "synthetic_fixture");

    const firstReport = buildDryRunReport(structuredClone(fixture.inventory));
    const secondReport = buildDryRunReport(structuredClone(fixture.inventory));
    const firstBytes = `${canonicalJson(firstReport)}\n`;
    const secondBytes = `${canonicalJson(secondReport)}\n`;

    assert.equal(secondBytes, firstBytes, "repeated dry-runs must be byte-identical");
    assert.equal(sha256(firstBytes), expected.report, "complete report bytes changed");
    assert.equal(firstReport.source_fingerprint_sha256, expected.fingerprint);
    assert.equal(firstReport.summary.status, expected.blockers.length ? "blocked" : "ready");
    assert.equal(firstReport.write_gate.allowed, expected.blockers.length === 0);

    const project = firstReport.projects[0];
    assert.equal(firstReport.projects.length, 1);
    assert.equal(project.current.tree_oid, expected.tree);
    assert.equal(project.target_head_commit_oid, expected.head);
    assert.equal(project.current.repository_path_set_sha256, expected.pathSet);
    assert.equal(project.current.repository_file_set_sha256, expected.fileSet);

    const actualFiles = Object.fromEntries([
      ...project.current.files,
      ...project.current.projected_files,
    ].map((file) => [file.path, file.sha256]));
    assert.deepEqual(actualFiles, expected.files, "expected paths or content hashes changed");
    assert.deepEqual(project.commits.map((commit) => commit.commit_oid), expected.commits);
    assert.deepEqual(
      [...new Set(firstReport.issues.filter((entry) => entry.severity === "error").map((entry) => entry.code))].sort(),
      expected.blockers,
    );

    if (expected.commitTrees) {
      assert.deepEqual(project.commits.map((commit) => commit.tree_oid), expected.commitTrees);
    }
    if (["git-light-history", "build-artifact-reference"].includes(fixture.id)) {
      for (let index = 1; index < project.commits.length; index += 1) {
        assert.equal(project.commits[index].parent_commit_oid, project.commits[index - 1].commit_oid);
      }
    }
    if (expected.artifact) {
      assert.deepEqual(project.commits[0].binary_artifact_references, [expected.artifact]);
      assert.equal(project.commits[0].includes_binary, true);
    }
    if (expected.classifications) {
      const classifications = Object.fromEntries(project.current.files.map((file) => [file.path, file.classification]));
      for (const [filePath, classification] of Object.entries(expected.classifications)) {
        assert.equal(classifications[filePath], classification);
      }
    }

    assert.equal(firstBytes.includes("synthetic-owner-"), false, "raw synthetic account references must not leak");
    assert.equal(firstBytes.includes("not-a-real-token"), false, "synthetic secret content must not leak");
    assert.equal(firstBytes.includes("extern \"C\" void app_main"), false, "source content must not leak");
  });
}

test("fixture catalog covers every required migration shape", () => {
  assert.deepEqual(syntheticCases.map((fixture) => fixture.id), [
    "empty-project",
    "normal-esp32-project",
    "multiple-software-units",
    "unicode-and-empty-file",
    "complex-board-and-pins",
    "git-light-history",
    "build-artifact-reference",
    "blocking-sources",
    "blocking-history-and-artifact",
  ]);

  const unicodeFixture = syntheticCases.find((fixture) => fixture.id === "unicode-and-empty-file");
  const emptyFile = unicodeFixture.inventory.sources.find((source) => source.path === "src/absichtlich-leer.cpp");
  assert.equal(emptyFile.content, "");
  assert.equal(emptyFile.content_sha256, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");

  const emptyProject = syntheticCases.find((fixture) => fixture.id === "empty-project");
  assert.deepEqual(emptyProject.inventory.sources, []);
  assert.deepEqual(emptyProject.inventory.versions, []);
});

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}
