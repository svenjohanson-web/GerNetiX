const COMMUNICATION_MODES = ["infrastructure_wifi", "device_access_point", "ble_peer"];

function defaultProjectCommunicationSetup(softwareUnits = []) {
  const ids = embeddedUnitIds(softwareUnits);
  return normalizeProjectCommunicationSetup({
    mode: "infrastructure_wifi",
    host_software_unit_id: ids[0] || "",
    client_software_unit_ids: ids.slice(1),
    stream: { transport: "http_stream", port: 8080, path: "/camera/stream", host_name: "gernetix-camera" },
    access_point: defaultAccessPointNetwork(),
  }, softwareUnits);
}

function normalizeProjectCommunicationSetup(input = {}, softwareUnits = []) {
  const source = objectValue(input);
  const ids = embeddedUnitIds(softwareUnits);
  const mode = COMMUNICATION_MODES.includes(source.mode) ? source.mode : "infrastructure_wifi";
  const requestedHostId = safeId(source.host_software_unit_id);
  const hostId = !ids.length || ids.includes(requestedHostId) ? requestedHostId || ids[0] || "" : ids[0] || "";
  const requestedClients = uniqueStrings(source.client_software_unit_ids)
    .map(safeId).filter((id) => id && id !== hostId && (!ids.length || ids.includes(id)));
  const clientIds = requestedClients.length ? requestedClients : ids.filter((id) => id !== hostId);
  const stream = objectValue(source.stream);
  const accessPoint = normalizeAccessPointNetwork(source.access_point);
  return {
    schema_version: 2,
    mode,
    host_software_unit_id: hostId,
    client_software_unit_ids: clientIds,
    stream: {
      transport: mode === "ble_peer" ? "ble_gatt" : "http_stream",
      port: boundedInteger(stream.port, 1, 65535, 8080),
      path: safePath(stream.path) || "/camera/stream",
      host_name: safeHostName(stream.host_name) || "gernetix-camera",
    },
    access_point: accessPoint,
    capabilities: communicationCapabilities(mode),
  };
}

function applyProjectCommunicationSetup(softwareUnits = [], input = {}) {
  const setup = normalizeProjectCommunicationSetup(input, softwareUnits);
  return {
    setup,
    software_units: softwareUnits.map((unit) => {
      if (!unit?.build_config?.firmware_basis_id) return unit;
      const role = unit.software_unit_id === setup.host_software_unit_id ? "host" : "client";
      const basis = objectValue(unit.build_config.basissoftware_configuration);
      const wifi = objectValue(basis.wifi);
      return {
        ...unit,
        build_config: {
          ...unit.build_config,
          basissoftware_configuration: {
            ...basis,
            wifi: {
              ...wifi,
              enabled: setup.mode !== "ble_peer",
              mode: setup.mode === "device_access_point" && role === "host" ? "access_point" : "station",
              auto_reconnect: setup.mode === "infrastructure_wifi" || role === "client",
            },
            communication: {
              managed_by_project: true,
              topology: setup.mode,
              role,
              transport: setup.stream.transport,
              peer_software_unit_ids: role === "host" ? setup.client_software_unit_ids : [setup.host_software_unit_id].filter(Boolean),
              internet_access: setup.capabilities.internet_access,
              ota_available: setup.capabilities.ota_available,
              observer_access: setup.capabilities.observer_access,
              endpoint_port: setup.stream.port,
              endpoint_path: setup.stream.path,
              local_hostname: role === "host" ? setup.stream.host_name : `${unit.software_unit_id || "gernetix-client"}`.replaceAll("_", "-"),
              peer_hostname: role === "client" ? setup.stream.host_name : "",
              access_point_ssid: setup.mode === "device_access_point" ? setup.access_point.ssid : "",
              access_point_password: setup.mode === "device_access_point" ? setup.access_point.password : "",
              access_point_ipv4_address: setup.mode === "device_access_point" ? setup.access_point.ipv4_address : "",
              access_point_subnet_mask: setup.mode === "device_access_point" ? setup.access_point.subnet_mask : "",
              access_point_dhcp_start: setup.mode === "device_access_point" ? setup.access_point.dhcp_start : "",
              access_point_dhcp_end: setup.mode === "device_access_point" ? setup.access_point.dhcp_end : "",
            },
          },
        },
      };
    }),
  };
}

function defaultAccessPointNetwork(prefix = "192.168.50", gatewayOctet = 1) {
  const [startOctet, endOctet] = gatewayOctet >= 100 && gatewayOctet <= 199 ? [20, 99] : [100, 199];
  return {
    ssid: "GerNetiX-Camera",
    password: "GerNetiX-Start",
    ipv4_address: `${prefix}.${gatewayOctet}`,
    subnet_mask: "255.255.255.0",
    dhcp_start: `${prefix}.${startOctet}`,
    dhcp_end: `${prefix}.${endOctet}`,
  };
}

function normalizeAccessPointNetwork(input = {}) {
  const source = objectValue(input);
  const address = parsePrivateIpv4(source.ipv4_address) || [192, 168, 50, 1];
  if (address[3] === 0 || address[3] === 255) address[3] = 1;
  const prefix = address.slice(0, 3).join(".");
  const fallback = defaultAccessPointNetwork(prefix, address[3]);
  const start = parsePrivateIpv4(source.dhcp_start);
  const end = parsePrivateIpv4(source.dhcp_end);
  const sameSubnet = (candidate) => candidate && candidate.slice(0, 3).join(".") === prefix && candidate[3] > 0 && candidate[3] < 255;
  const validRange = sameSubnet(start) && sameSubnet(end)
    && start[3] <= end[3]
    && !(address[3] >= start[3] && address[3] <= end[3]);
  return {
    ssid: safeSsid(source.ssid) || "GerNetiX-Camera",
    password: source.password === undefined ? "GerNetiX-Start" : safeWifiPassword(source.password),
    ipv4_address: address.join("."),
    subnet_mask: "255.255.255.0",
    dhcp_start: validRange ? start.join(".") : fallback.dhcp_start,
    dhcp_end: validRange ? end.join(".") : fallback.dhcp_end,
  };
}

function parsePrivateIpv4(value) {
  const parts = String(value || "").trim().split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return null;
  const octets = parts.map(Number);
  if (octets.some((part) => part < 0 || part > 255)) return null;
  const privateNetwork = octets[0] === 10
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168);
  return privateNetwork ? octets : null;
}

function communicationCapabilities(mode) {
  if (mode === "device_access_point") return {
    internet_access: false,
    ota_available: false,
    observer_access: true,
    observer_note: "Ein Smartphone kann dem lokalen WLAN beitreten; GerNetiX-Server-OTA ist ohne Internet-Uplink nicht erreichbar.",
  };
  if (mode === "ble_peer") return {
    internet_access: false,
    ota_available: false,
    observer_access: false,
    observer_note: "Die initiale BLE-Variante ist eine direkte Verbindung zwischen genau diesen beiden Firmware-Zielen.",
  };
  return {
    internet_access: true,
    ota_available: true,
    observer_access: true,
    observer_note: "Boards und Smartphone befinden sich im selben Haus-WLAN; OTA setzt weiterhin provisionierte Inventar-Devices voraus.",
  };
}

function embeddedUnitIds(softwareUnits) {
  return (Array.isArray(softwareUnits) ? softwareUnits : [])
    .filter((unit) => unit?.build_system === "platformio" || unit?.software_kind === "embedded_firmware")
    .map((unit) => String(unit.software_unit_id || "").trim())
    .filter(Boolean);
}

function safePath(value) {
  const path = String(value || "").trim().slice(0, 160);
  return /^\/[A-Za-z0-9._~!$&'()*+,;=:@%\/-]*$/.test(path) ? path : "";
}

function safeId(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9_-]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
}

function safeHostName(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 63);
}

function safeSsid(value) {
  const ssid = String(value || "").trim();
  return ssid && Buffer.byteLength(ssid, "utf8") <= 32 ? ssid : "";
}

function safeWifiPassword(value) {
  const password = String(value || "");
  return password === "" || (Buffer.byteLength(password, "utf8") >= 8 && Buffer.byteLength(password, "utf8") <= 63) ? password : "";
}

function boundedInteger(value, minimum, maximum, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum ? number : fallback;
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean)));
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

module.exports = {
  COMMUNICATION_MODES,
  applyProjectCommunicationSetup,
  communicationCapabilities,
  defaultAccessPointNetwork,
  defaultProjectCommunicationSetup,
  normalizeAccessPointNetwork,
  normalizeProjectCommunicationSetup,
};
