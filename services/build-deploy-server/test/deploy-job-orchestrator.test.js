const assert = require("node:assert/strict");
const test = require("node:test");

const { DeployJobOrchestrator } = require("../src/modules/deploy-job-orchestrator");

test("queues authorized OTA deploy on the firmware subscriber topic", async () => {
  const result = await new DeployJobOrchestrator().maybeCreateDeploy({
    mode: "build_and_ota_flash",
    device_id: "device_123",
    deploy: { requested: true, authorized: true, device_id: "device_123" },
  }, {
    primary_firmware: { download_url: "https://build.example/firmware.bin", sha256: "abc", size_bytes: 123 },
    artifacts: {},
  });

  assert.equal(result.status, "queued_for_mqtt");
  assert.equal(result.topic, "gernetix/devices/device_123/ota");
});
