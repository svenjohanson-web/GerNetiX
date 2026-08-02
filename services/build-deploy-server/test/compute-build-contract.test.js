"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createFirmwareBuildComputeJob } = require("../src");

test("maps a build package to a provider-neutral immutable ComputeJob", () => {
  const input = { job_id: "build-42", mode: "build", project_id: "project-a", created_at: "2026-08-02T08:00:00.000Z", build_package: { files: { "src/main.cpp": "void setup() {}", "platformio.ini": "[env:test]" } } };
  const first = createFirmwareBuildComputeJob(input, { account_id: "account-a" });
  const reordered = createFirmwareBuildComputeJob({ ...input, build_package: { files: { "platformio.ini": "[env:test]", "src/main.cpp": "void setup() {}" } } }, { account_id: "account-a" });
  assert.equal(first.input_revision, reordered.input_revision);
  assert.equal(first.execution_class, "trusted_system");
  assert.equal(first.requirements.network_policy, "artifact_api_only");
  assert.deepEqual(first.requirements.cpu_arch, ["amd64", "arm64"]);
});

test("never delegates USB, OTA or FlashBox actions to elastic build workers", () => {
  const base = { job_id: "unsafe", project_id: "project-a", build_package: {} };
  for (const input of [
    { ...base, mode: "build_and_usb_flash" },
    { ...base, mode: "build_and_flash" },
    { ...base, mode: "build", flashbox: { requested: true } },
  ]) assert.throws(() => createFirmwareBuildComputeJob(input, { account_id: "account-a" }), { code: "compute_job_not_build_only" });
});

test("requires tenant ownership before delegation", () => {
  assert.throws(() => createFirmwareBuildComputeJob({ job_id: "build", mode: "build", build_package: {} }), { code: "compute_job_tenant_missing" });
});
