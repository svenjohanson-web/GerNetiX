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
