const assert = require("node:assert/strict");
const test = require("node:test");
const { applyProjectCommunicationSetup, defaultProjectCommunicationSetup, normalizeAccessPointNetwork } = require("./project-communication-setup");

const units = [
  { software_unit_id: "camera_sender", software_kind: "embedded_firmware", build_system: "platformio", build_config: { firmware_basis_id: "gernetix-runtime-basissoftware", basissoftware_configuration: {} } },
  { software_unit_id: "display_receiver", software_kind: "embedded_firmware", build_system: "platformio", build_config: { firmware_basis_id: "gernetix-runtime-basissoftware", basissoftware_configuration: {} } },
];

test("derives house WLAN roles and OTA capability for both firmware units", () => {
  const result = applyProjectCommunicationSetup(units, defaultProjectCommunicationSetup(units));
  const [camera, display] = result.software_units.map((unit) => unit.build_config.basissoftware_configuration);
  assert.equal(camera.wifi.mode, "station");
  assert.equal(camera.communication.role, "host");
  assert.equal(display.communication.role, "client");
  assert.equal(camera.communication.local_hostname, "gernetix-camera");
  assert.equal(display.communication.peer_hostname, "gernetix-camera");
  assert.equal(camera.communication.ota_available, true);
  assert.equal(display.communication.observer_access, true);
});

test("derives one access point and disables server OTA without hiding local observers", () => {
  const result = applyProjectCommunicationSetup(units, { mode: "device_access_point", host_software_unit_id: "camera_sender", access_point: { ipv4_address: "10.42.7.1", dhcp_start: "10.42.7.40", dhcp_end: "10.42.7.90" } });
  const [camera, display] = result.software_units.map((unit) => unit.build_config.basissoftware_configuration);
  assert.equal(camera.wifi.mode, "access_point");
  assert.equal(display.wifi.mode, "station");
  assert.equal(camera.communication.ota_available, false);
  assert.equal(camera.communication.observer_access, true);
  assert.equal(camera.communication.access_point_ipv4_address, "10.42.7.1");
  assert.equal(camera.communication.access_point_dhcp_end, "10.42.7.90");
  assert.equal(display.communication.access_point_ipv4_address, "10.42.7.1");
  assert.equal(display.communication.access_point_ssid, "GerNetiX-Camera");
  assert.equal(display.communication.access_point_password, "GerNetiX-Start");
});

test("repairs invalid or colliding DHCP ranges inside the selected private /24 network", () => {
  assert.deepEqual(normalizeAccessPointNetwork({
    ipv4_address: "192.168.77.150",
    dhcp_start: "192.168.77.100",
    dhcp_end: "192.168.77.199",
  }), {
    ssid: "GerNetiX-Camera",
    password: "GerNetiX-Start",
    ipv4_address: "192.168.77.150",
    subnet_mask: "255.255.255.0",
    dhcp_start: "192.168.77.20",
    dhcp_end: "192.168.77.99",
  });
});

test("derives BLE peer communication without WLAN OTA or observers", () => {
  const result = applyProjectCommunicationSetup(units, { mode: "ble_peer", host_software_unit_id: "camera_sender" });
  for (const unit of result.software_units) {
    const basis = unit.build_config.basissoftware_configuration;
    assert.equal(basis.wifi.enabled, false);
    assert.equal(basis.communication.transport, "ble_gatt");
    assert.equal(basis.communication.ota_available, false);
    assert.equal(basis.communication.observer_access, false);
  }
});
