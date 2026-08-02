"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { BuildDeployService } = require("../src/services/build-deploy-service");

function serviceFor(buildId, frames = []) {
  return new BuildDeployService({
    artifactStore: {
      async getArtifact(jobId, name) {
        assert.equal(jobId, "job-1");
        assert.equal(name, "firmware.elf");
        return { sha256: buildId, content_blob: Buffer.from("elf") };
      },
    },
    elfSymbolizer: {
      async symbolize(content, addresses) {
        assert.equal(content.toString(), "elf");
        assert.deepEqual(addresses, ["0x40001234"]);
        return frames;
      },
    },
  });
}

test("symbolization accepts only the exact ELF sha256 build id", async () => {
  const buildId = "a".repeat(64);
  const frames = [{ address: "0x40001234", resolved: true, function: "app_main", file: "src/main.cpp", line: 7 }];
  const result = await serviceFor(buildId, frames).symbolizeCrash("job-1", {
    build_id: buildId,
    addresses: ["0x40001234", "0x40001234", "not-an-address"],
  });
  assert.equal(result.status, "symbolized");
  assert.deepEqual(result.frames, frames);
});

test("a wrong ELF is reported as build_artifact_mismatch", async () => {
  await assert.rejects(
    serviceFor("b".repeat(64)).symbolizeCrash("job-1", {
      build_id: "a".repeat(64), addresses: ["0x40001234"],
    }),
    (error) => error.code === "build_artifact_mismatch" && error.status === 409,
  );
});
