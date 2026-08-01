const assert = require("node:assert/strict");
const test = require("node:test");
const { normalizeBasissoftwareConfiguration } = require("./basissoftware-configuration");

test("normalizes the initial WLAN MQTT and power-manager contract without secrets", () => {
  const config = normalizeBasissoftwareConfiguration({
    wifi: { enabled: false, mode: "invalid", password: "must-not-survive" },
    mqtt: { enabled: true, port: 70000, publish_topics: ["a", "a", "b"], subscriptions: "commands/#\nupdates" },
    power_manager: { enabled: true, default_state: "deep_sleep", states: { deep_sleep: { enabled: true, enter_after_seconds: 1200, wake_sources: ["timer", "invalid"] } } },
  });
  assert.equal(config.wifi.enabled, false);
  assert.equal(config.wifi.mode, "station");
  assert.equal(Object.hasOwn(config.wifi, "password"), false);
  assert.equal(config.mqtt.port, 8883);
  assert.deepEqual(config.mqtt.publish_topics, ["a", "b"]);
  assert.deepEqual(config.mqtt.subscriptions, ["commands/#", "updates"]);
  assert.equal(config.power_manager.default_state, "deep_sleep");
  assert.deepEqual(config.power_manager.states.deep_sleep.wake_sources, ["timer"]);
});

test("keeps only validated project-derived communication metadata", () => {
  const result = normalizeBasissoftwareConfiguration({
    communication: {
      managed_by_project: true,
      topology: "device_access_point",
      role: "host",
      transport: "http_stream",
      peer_software_unit_ids: ["display_receiver", "display_receiver"],
      observer_access: true,
      endpoint_port: 8080,
      endpoint_path: "/camera/stream",
      local_hostname: "GerNetiX Camera",
      peer_hostname: "GERNETIX-CAMERA",
      access_point_ipv4_address: "10.42.7.1",
      access_point_subnet_mask: "255.255.255.0",
      access_point_dhcp_start: "10.42.7.40",
      access_point_dhcp_end: "10.42.7.90",
      secret: "must disappear",
    },
  });
  assert.deepEqual(result.communication.peer_software_unit_ids, ["display_receiver"]);
  assert.equal(result.communication.endpoint_path, "/camera/stream");
  assert.equal(result.communication.local_hostname, "gernetix-camera");
  assert.equal(result.communication.peer_hostname, "gernetix-camera");
  assert.equal(result.communication.access_point_ipv4_address, "10.42.7.1");
  assert.equal(result.communication.secret, undefined);
});
