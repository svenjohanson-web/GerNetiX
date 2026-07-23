"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { SqlitePlatformDownloadRepository } = require("../src/repositories/sqlite-platform-download-repository");

test("publishes immutable platform downloads in SQLite and returns the current release", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-platform-download-"));
  const repository = new SqlitePlatformDownloadRepository(path.join(directory, "identity.sqlite"));
  try {
    const first = publish(repository, "0.2.0", "first");
    const second = publish(repository, "0.3.0", "second");

    assert.equal(first.sha256.length, 64);
    assert.equal(repository.listCurrent("serial-service")[0].version, "0.3.0");
    assert.equal(repository.getContent("serial-service", "0.2.0", "macos", "arm64").content_blob.toString(), "first");
    assert.equal(repository.listCurrent("serial-service", { visibility: "authenticated" })[0].version, "0.3.0");
    assert.equal(repository.listCurrent("serial-service", { visibility: "public" }).length, 0);
    publish(repository, "0.4.0", "public", "public");
    assert.equal(repository.listCurrent("serial-service", { visibility: "authenticated" })[0].version, "0.3.0");
    assert.equal(repository.listCurrent("serial-service", { visibility: "public" })[0].version, "0.4.0");
    assert.throws(() => publish(repository, "0.3.0", "changed"), { code: "download_release_already_exists" });
    assert.throws(() => publish(repository, "0.4.0", "bad", "owner_only"), { code: "invalid_download_visibility" });
    assert.equal(second.file_name, "GerNetiX-Serial-Service-mac-arm64.pkg");
  } finally {
    repository.close();
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

function publish(repository, version, content, visibility = "authenticated") {
  return repository.publish({
    download_id: "serial-service",
    version,
    platform: "macos",
    architecture: "arm64",
    label: "Für macOS",
    detail: "Installationspaket · Apple Silicon",
    file_name: "GerNetiX-Serial-Service-mac-arm64.pkg",
    content_type: "application/vnd.apple.installer+xml",
    visibility,
    content: Buffer.from(content),
  });
}
