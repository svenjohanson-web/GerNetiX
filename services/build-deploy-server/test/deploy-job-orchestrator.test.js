const assert = require("node:assert/strict");
const test = require("node:test");

const { DeployJobOrchestrator } = require("../src/modules/deploy-job-orchestrator");

test("reports every missing OTA chain prerequisite before the build", () => {
  const result = new DeployJobOrchestrator().preflight();
  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers.map((item) => item.id), [
    "public_firmware_url",
    "mqtt_publish",
    "command_authorization",
    "device_confirmation",
  ]);
});

test("signs, publishes and records an authorized OTA deploy", async () => {
  const published = [];
  const acknowledgements = [];
  const orchestrator = new DeployJobOrchestrator({
    publicBaseUrl: "https://build.example",
    mqttPublisher: { publish: async (...args) => published.push(args) },
    authorizationSigner: { sign: async ({ canonical }) => `signed:${canonical.length}` },
    acknowledgementStore: { record: async (entry) => acknowledgements.push(entry) },
  });
  assert.equal(orchestrator.preflight().ready, true);
  const result = await orchestrator.maybeCreateDeploy({
    job_id: "job-123",
    mode: "build_and_flash",
    device_id: "device_123",
    deploy: { requested: true, authorized: true, device_id: "device_123" },
  }, {
    primary_firmware: { download_url: "https://build.example/firmware.bin", sha256: "abc", size_bytes: 123 },
    artifacts: {},
  });

  assert.equal(result.status, "published");
  assert.equal(result.topic, "gernetix/devices/device_123/ota");
  assert.equal(result.firmware_url, "https://build.example/firmware.bin");
  assert.equal(published.length, 1);
  assert.equal(published[0][2].qos, 1);
  assert.equal(JSON.parse(published[0][1]).deploy_id, "deploy_job-123");
  assert.deepEqual(acknowledgements.map((item) => item.status), ["publishing", "published"]);
});

test("uses the embedded ESP image digest for compatibility while retaining the artifact hash", async () => {
  const published = [];
  const orchestrator = new DeployJobOrchestrator({
    publicBaseUrl: "https://build.gernetix.com",
    mqttPublisher: { publish: async (topic, payload) => published.push({ topic, command: JSON.parse(payload) }) },
    authorizationSigner: { sign: async () => "a".repeat(64) },
    acknowledgementStore: { record: async () => {}, get: () => null },
  });
  const result = await orchestrator.maybeCreateDeploy(
    { job_id: "job-compat", mode: "build_and_flash", device_id: "device-1", deploy: { requested: true, authorized: true, device_id: "device-1" } },
    { primary_firmware: { download_url: "https://build.gernetix.com/artifacts/job-compat/firmware.bin", sha256: "b".repeat(64), esp_image_sha256: "c".repeat(64), size_bytes: 123 } },
  );
  assert.equal(published[0].command.sha256, "c".repeat(64));
  assert.equal(result.firmware_sha256, "c".repeat(64));
  assert.equal(result.artifact_sha256, "b".repeat(64));
});
