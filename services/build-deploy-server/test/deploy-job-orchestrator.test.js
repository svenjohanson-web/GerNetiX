const assert = require("node:assert/strict");
const test = require("node:test");

const { DeployJobOrchestrator } = require("../src/modules/deploy-job-orchestrator");

test("reports every missing OTA chain prerequisite before the build", () => {
  const result = new DeployJobOrchestrator().preflight();
  assert.equal(result.ready, false);
  assert.deepEqual(result.blockers.map((item) => item.id), [
    "public_firmware_url",
    "mqtt_publish",
    "command_signature",
    "device_confirmation",
  ]);
});

test("signs, publishes and records an authorized OTA deploy", async () => {
  const published = [];
  const acknowledgements = [];
  const orchestrator = new DeployJobOrchestrator({
    publicBaseUrl: "https://build.example",
    mqttPublisher: { publish: async (...args) => published.push(args) },
    authorizationSigner: { keyId: "ota-test-1", sign: async ({ canonical }) => `signed:${canonical.length}` },
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
  assert.equal(published[0][2].retain, true);
  const command = JSON.parse(published[0][1]);
  assert.equal(command.deploy_id, "deploy_job-123");
  assert.equal(command.schema_version, "gernetix-ota-command-v1");
  assert.equal(command.signing_key_id, "ota-test-1");
  assert.ok(command.signature);
  assert.ok(command.expires_at > Math.floor(Date.now() / 1000));
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

test("signs and publishes a FlashBox job only to the selected helper topic", async () => {
  const published = [];
  const orchestrator = new DeployJobOrchestrator({
    publicBaseUrl: "https://build.gernetix.com",
    mqttPublisher: { publish: async (...args) => published.push(args) },
    authorizationSigner: { keyId: "flashbox-test-1", sign: async ({ canonical }) => `signed:${canonical.length}` },
  });

  const result = await orchestrator.maybeCreateFlashboxDelivery({
    job_id: "job-flashbox-1",
    mode: "build",
    device_id: "target-esp32-1",
    flashbox: {
      requested: true,
      flashbox_device_id: "flashbox-1",
      target_device_id: "target-esp32-1",
      target_hardware_profile_id: "hardware.esp32_s3",
      manifest_type: "project_firmware_flash",
    },
  }, {
    primary_firmware: {
      download_url: "/artifacts/job-flashbox-1/firmware.bin",
      sha256: "a".repeat(64),
      esp_image_sha256: "b".repeat(64),
      size_bytes: 123,
    },
    artifacts: {},
  });

  assert.equal(result.status, "published_waiting_flashbox");
  assert.equal(result.topic, "gernetix/devices/flashbox-1/flashbox/jobs");
  assert.equal(published.length, 1);
  assert.equal(published[0][0], "gernetix/devices/flashbox-1/flashbox/jobs");
  assert.equal(published[0][2].qos, 1);
  assert.equal(published[0][2].retain, true);
  const command = JSON.parse(published[0][1]);
  assert.equal(command.schema_version, "gernetix-flashbox-command-v1");
  assert.equal(command.flashbox_job_id, "flashbox_job-flashbox-1");
  assert.equal(command.target_device_id, "target-esp32-1");
  assert.equal(command.firmware_url, "https://build.gernetix.com/artifacts/job-flashbox-1/firmware.bin");
  assert.equal(command.artifact_sha256, "a".repeat(64));
  assert.equal(command.firmware_sha256, "b".repeat(64));
});

test("accepts FlashBox status only when its own MQTT status topic supplies the job id", async () => {
  const entries = new Map();
  const store = {
    record: async (entry) => entries.set(entry.deploy_id, entry),
    get: (id) => entries.get(id) || null,
    receive: async (_topic, payload) => {
      const detail = JSON.parse(payload);
      if (detail.flashbox_job_id) entries.set(detail.flashbox_job_id, detail);
    },
  };
  const orchestrator = new DeployJobOrchestrator({ acknowledgementStore: store });
  await store.receive("gernetix/devices/flashbox-1/status/flashbox", JSON.stringify({
    flashbox_job_id: "flashbox_job-1",
    status: "target_flash_succeeded",
  }));
  assert.equal(orchestrator.flashboxStatus("flashbox_job-1").status, "target_flash_succeeded");
});
