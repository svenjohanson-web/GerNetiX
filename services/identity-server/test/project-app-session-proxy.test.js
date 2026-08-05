const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const { projectAppDeviceCompatibility } = require("../src/dev/server/project-routes");

const routes = fs.readFileSync(path.join(__dirname, "../src/dev/server/project-routes.js"), "utf8");

test("project app proxy derives account and project ownership from the Identity session", () => {
  assert.match(routes, /projects\\\/\(\[\^\/\]\+\)\\\/project-app/);
  assert.match(routes, /requireSessionProject\(session, decodeURIComponent\(match\[1\]\)\)/);
  assert.match(routes, /const accountId = projectServerUserId\(session\)/);
  assert.match(routes, /account_id: accountId/);
});

test("project app proxy forwards only the allowlisted runtime settings contract", () => {
  const start = routes.indexOf('for (const method of ["GET", "PUT"])');
  const end = routes.indexOf('registerProjectPattern("POST", /^\\/api\\/user-ide\\/projects', start);
  const projectAppBlock = routes.slice(start, end);
  assert.match(projectAppBlock, /manifest_version: body\.manifest_version/);
  assert.match(projectAppBlock, /expected_revision: body\.expected_revision/);
  assert.match(projectAppBlock, /values: body\.values/);
  assert.doesNotMatch(projectAppBlock, /\.\.\.body/);
});

test("project app device assignment accepts only devices owned by the active account", () => {
  assert.match(routes, /project-app\\\/devices/);
  assert.match(routes, /dependencies\.loadUserIdeDevices\(session\)/);
  assert.match(routes, /project_app_device_not_owned/);
  assert.match(routes, /body: \{ account_id: accountId, device_ids: requestedIds \}/);
  assert.doesNotMatch(routes, /project-app\/devices[\s\S]{0,1400}body: \{ \.\.\.body/);
});

test("Nexi device compatibility requires S3, audio driver, buttons and microphones", () => {
  const manifest = {
    hardware_requirements: {
      processor_variant: "ESP32-S3",
      supported_hardware_profile_ids: ["board.nexi"],
      features: [
        { label: "Audio-Treiber", capability_id: "capability.audio_output", board_feature: "speaker", require_driver: true },
        { label: "3 Bedientasten", capability_id: "capability.digital_input", board_feature: "buttons", require_included: true, min_count: 3 },
        { label: "2 Mikrofone", capability_id: "capability.audio_input", board_feature: "microphone", require_included: true, require_driver: true, min_count: 2 },
      ],
    },
  };
  const board = {
    hardware_item_id: "board.nexi",
    mcu_variant: "ESP32-S3",
    capability_ids: ["capability.audio_output", "capability.audio_input", "capability.digital_input"],
    default_instance_configuration: { board_features: {
      speaker: { enabled: true, driver: "es8311" },
      buttons: { enabled: true, included: true, count: 3 },
      microphone: { enabled: true, included: true, driver: "es7210", channels: 2 },
    } },
  };
  const compatible = projectAppDeviceCompatibility({
    project: { hardware_profile_id: "board.nexi" }, manifest,
    device: { device_id: "nexi-1", hardware_profile_id: "board.nexi" }, processorBoards: [board],
  });
  assert.deepEqual(compatible, { compatible: true, missing_requirements: [] });
  const withoutButtons = structuredClone(board);
  delete withoutButtons.default_instance_configuration.board_features.buttons;
  const incompatible = projectAppDeviceCompatibility({
    project: { hardware_profile_id: "board.nexi" }, manifest,
    device: { device_id: "nexi-2", hardware_profile_id: "board.nexi" }, processorBoards: [withoutButtons],
  });
  assert.equal(incompatible.compatible, false);
  assert.deepEqual(incompatible.missing_requirements, ["3 Bedientasten"]);

  const variants = [
    ["ESP32-S3", (item) => { item.mcu_variant = "ESP32-C3"; }],
    ["Audio-Treiber", (item) => { delete item.default_instance_configuration.board_features.speaker.driver; }],
    ["2 Mikrofone", (item) => { delete item.default_instance_configuration.board_features.microphone; }],
  ];
  for (const [expectedMissing, mutate] of variants) {
    const candidate = structuredClone(board);
    mutate(candidate);
    const report = projectAppDeviceCompatibility({
      project: { hardware_profile_id: "board.nexi" }, manifest,
      device: { device_id: `missing-${expectedMissing}`, hardware_profile_id: "board.nexi" }, processorBoards: [candidate],
    });
    assert.equal(report.compatible, false);
    assert.ok(report.missing_requirements.includes(expectedMissing));
  }
});
