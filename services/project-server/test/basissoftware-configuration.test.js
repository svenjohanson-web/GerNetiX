const assert = require("node:assert/strict");
const test = require("node:test");
const { createDefaultProjectServer } = require("../src");

test("persists basissoftware configuration independently for every firmware unit", async () => {
  const service = createDefaultProjectServer({ persistenceBackend: "memory" });
  const baseBuild = {
    platform: "espressif32", framework: "espidf", board: "esp32dev",
    firmware_basis_id: "gernetix-runtime-basissoftware", firmware_basis_variant: "full",
  };
  const created = await service.createProject({
    user_id: "basis-user",
    title: "Distributed IoT",
    active_software_unit_id: "camera",
    software_units: [
      { software_unit_id: "camera", title: "Camera", software_kind: "embedded_firmware", build_system: "platformio", source_root: "Komponenten/IoT-Device 1", build_config: { ...baseBuild, basissoftware_configuration: { wifi: { enabled: true }, mqtt: { publish_topics: ["camera/image"] } } } },
      { software_unit_id: "display", title: "Display", software_kind: "embedded_firmware", build_system: "platformio", source_root: "Komponenten/IoT-Device 2", build_config: { ...baseBuild, basissoftware_configuration: { wifi: { enabled: false }, mqtt: { subscriptions: ["camera/image"] } } } },
    ],
  });
  assert.equal(created.software_units[0].build_config.basissoftware_configuration.wifi.enabled, true);
  assert.equal(created.software_units[0].build_config.basissoftware_configuration.mqtt.enabled, false);
  assert.deepEqual(created.software_units[0].build_config.basissoftware_configuration.mqtt.publish_topics, ["camera/image"]);
  assert.equal(created.software_units[1].build_config.basissoftware_configuration.wifi.enabled, false);
  assert.equal(created.software_units[1].build_config.basissoftware_configuration.mqtt.enabled, false);
  assert.deepEqual(created.software_units[1].build_config.basissoftware_configuration.mqtt.subscriptions, ["camera/image"]);
});

test("persists the project-wide communication source of truth in the SQL project manifest", async () => {
  const service = createDefaultProjectServer({ persistenceBackend: "memory" });
  const created = await service.createProject({
    user_id: "communication-user",
    title: "Camera link",
    view_manifest: {
      communication_setup: {
        mode: "device_access_point",
        host_software_unit_id: "camera_sender",
        client_software_unit_ids: ["display_receiver"],
        stream: { port: 8080, path: "/camera/stream" },
        access_point: { ipv4_address: "10.42.7.1", dhcp_start: "10.42.7.40", dhcp_end: "10.42.7.90" },
      },
    },
  });
  assert.equal(created.view_manifest.communication_setup.mode, "device_access_point");
  assert.equal(created.view_manifest.communication_setup.host_software_unit_id, "camera_sender");
  assert.deepEqual(created.view_manifest.communication_setup.client_software_unit_ids, ["display_receiver"]);
  assert.equal(created.view_manifest.communication_setup.access_point.ipv4_address, "10.42.7.1");
});
