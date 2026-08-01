const POWER_STATE_IDS = ["active", "modem_sleep", "light_sleep", "deep_sleep"];
const WAKE_SOURCE_IDS = ["timer", "gpio", "touch", "network"];

function normalizeBasissoftwareConfiguration(input = {}) {
  const source = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  const wifi = objectValue(source.wifi);
  const mqtt = objectValue(source.mqtt);
  const power = objectValue(source.power_manager);
  const communication = objectValue(source.communication);
  const rawStates = objectValue(power.states);
  return {
    schema_version: 1,
    wifi: {
      enabled: wifi.enabled !== false,
      mode: ["station", "access_point", "station_and_access_point"].includes(wifi.mode) ? wifi.mode : "station",
      auto_reconnect: wifi.auto_reconnect !== false,
    },
    mqtt: {
      enabled: mqtt.enabled === true,
      broker_url: safeLine(mqtt.broker_url, 240),
      port: positiveInteger(mqtt.port) || (mqtt.tls === false ? 1883 : 8883),
      tls: mqtt.tls !== false,
      client_id_template: safeLine(mqtt.client_id_template, 120) || "gernetix-{device}",
      publish_topics: topicList(mqtt.publish_topics),
      subscriptions: topicList(mqtt.subscriptions),
      qos: [0, 1, 2].includes(Number(mqtt.qos)) ? Number(mqtt.qos) : 1,
    },
    power_manager: {
      enabled: power.enabled === true,
      default_state: POWER_STATE_IDS.includes(power.default_state) ? power.default_state : "active",
      states: Object.fromEntries(POWER_STATE_IDS.map((stateId) => {
        const state = objectValue(rawStates[stateId]);
        const defaults = powerStateDefaults(stateId);
        return [stateId, {
          enabled: stateId === "active" || state.enabled === true || (state.enabled === undefined && defaults.enabled),
          enter_after_seconds: stateId === "active" ? 0 : nonNegativeInteger(state.enter_after_seconds, defaults.enter_after_seconds),
          wake_sources: stateId === "active" ? [] : uniqueStrings(state.wake_sources).filter((item) => WAKE_SOURCE_IDS.includes(item)),
        }];
      })),
    },
    communication: {
      managed_by_project: communication.managed_by_project === true,
      topology: ["infrastructure_wifi", "device_access_point", "ble_peer"].includes(communication.topology) ? communication.topology : "",
      role: ["host", "client"].includes(communication.role) ? communication.role : "",
      transport: ["http_stream", "ble_gatt"].includes(communication.transport) ? communication.transport : "",
      peer_software_unit_ids: uniqueStrings(communication.peer_software_unit_ids).slice(0, 16),
      internet_access: communication.internet_access === true,
      ota_available: communication.ota_available === true,
      observer_access: communication.observer_access === true,
      endpoint_port: positiveInteger(communication.endpoint_port),
      endpoint_path: safePath(communication.endpoint_path),
      local_hostname: safeHostname(communication.local_hostname),
      peer_hostname: safeHostname(communication.peer_hostname),
      access_point_ssid: safeLine(communication.access_point_ssid, 32),
      access_point_password: safeWifiPassword(communication.access_point_password),
      access_point_ipv4_address: safeIpv4(communication.access_point_ipv4_address),
      access_point_subnet_mask: safeIpv4(communication.access_point_subnet_mask),
      access_point_dhcp_start: safeIpv4(communication.access_point_dhcp_start),
      access_point_dhcp_end: safeIpv4(communication.access_point_dhcp_end),
    },
  };
}

function powerStateDefaults(stateId) {
  if (stateId === "active") return { enabled: true, enter_after_seconds: 0 };
  if (stateId === "modem_sleep") return { enabled: true, enter_after_seconds: 30 };
  if (stateId === "light_sleep") return { enabled: false, enter_after_seconds: 120 };
  return { enabled: false, enter_after_seconds: 900 };
}

function topicList(value) {
  return uniqueStrings(Array.isArray(value) ? value : String(value || "").split(/\r?\n/))
    .map((item) => safeLine(item, 240))
    .filter((item) => item && !item.includes("\0"))
    .slice(0, 32);
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).map((value) => String(value || "").trim()).filter(Boolean)));
}

function positiveInteger(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 && parsed <= 65535 ? parsed : 0;
}

function nonNegativeInteger(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 && parsed <= 86400 ? parsed : fallback;
}

function safeLine(value, length) {
  const normalized = String(value || "").trim();
  return /[\r\n]/.test(normalized) ? "" : normalized.slice(0, length);
}

function safePath(value) {
  const path = safeLine(value, 160);
  return /^\/[A-Za-z0-9._~!$&'()*+,;=:@%\/-]*$/.test(path) ? path : "";
}

function safeIpv4(value) {
  const parts = String(value || "").trim().split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part) || Number(part) > 255)) return "";
  return parts.map(Number).join(".");
}

function safeHostname(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 63);
}

function safeWifiPassword(value) {
  const password = String(value || "");
  return password === "" || (password.length >= 8 && password.length <= 63) ? password : "";
}

function objectValue(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

module.exports = { normalizeBasissoftwareConfiguration, POWER_STATE_IDS, WAKE_SOURCE_IDS };
