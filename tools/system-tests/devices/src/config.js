const { isIP } = require("node:net");
const { DEFAULT_DEVICE_MAP } = require("./device-map");

const DEFAULTS = Object.freeze({
  brokerUrl: "mqtt://127.0.0.1:51883",
  deviceCount: 4,
  deviceMap: DEFAULT_DEVICE_MAP,
  durationMs: 60_000,
  telemetryIntervalMs: 1_000,
  connectionRampMs: 5_000,
  duplicateRate: 0,
  delayedRate: 0,
  delayedByMs: 2_000,
  heartbeatEvery: 30,
  maxReconnectAttempts: 5,
  reconnectBaseMs: 250,
  reconnectMaxMs: 5_000,
  connectTimeoutMs: 5_000,
  allowRemote: false,
});

function parseArgs(argv) {
  const values = {};
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--allow-remote") { values.allowRemote = true; continue; }
    if (item === "--help") { values.help = true; continue; }
    if (!item.startsWith("--")) throw new Error(`unexpected argument: ${item}`);
    const key = item.slice(2).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
    const value = argv[index + 1];
    if (value === undefined || value.startsWith("--")) throw new Error(`missing value for ${item}`);
    values[key] = value;
    index += 1;
  }
  return normalizeConfig(values);
}

function normalizeConfig(input = {}) {
  const config = {
    ...DEFAULTS,
    ...input,
    brokerUrl: String(input.brokerUrl || DEFAULTS.brokerUrl),
    deviceMap: String(input.deviceMap || DEFAULTS.deviceMap),
    allowRemote: input.allowRemote === true,
  };
  for (const key of ["deviceCount", "durationMs", "telemetryIntervalMs", "connectionRampMs", "delayedByMs", "heartbeatEvery", "maxReconnectAttempts", "reconnectBaseMs", "reconnectMaxMs", "connectTimeoutMs"]) {
    config[key] = integer(input[key] ?? DEFAULTS[key], key, key === "deviceCount" || key === "durationMs" || key === "telemetryIntervalMs" ? 1 : 0);
  }
  config.duplicateRate = rate(input.duplicateRate ?? DEFAULTS.duplicateRate, "duplicateRate");
  config.delayedRate = rate(input.delayedRate ?? DEFAULTS.delayedRate, "delayedRate");
  if (config.deviceCount > 10_000) throw new Error("deviceCount exceeds the safety limit of 10000");
  if (!config.deviceMap.trim()) throw new Error("deviceMap must be a non-empty path");
  if (config.reconnectBaseMs > config.reconnectMaxMs) throw new Error("reconnectBaseMs must not exceed reconnectMaxMs");
  if (Boolean(config.certFile) !== Boolean(config.keyFile)) throw new Error("certFile and keyFile must be provided together");
  validateBrokerUrl(config.brokerUrl, config.allowRemote);
  return config;
}

function validateBrokerUrl(value, allowRemote) {
  let url;
  try { url = new URL(value); }
  catch { throw new Error("brokerUrl must be a valid mqtt:// or mqtts:// URL"); }
  if (!new Set(["mqtt:", "mqtts:"]).has(url.protocol) || !url.hostname || url.username || url.password || (url.pathname && url.pathname !== "/")) {
    throw new Error("brokerUrl must be an mqtt:// or mqtts:// URL without embedded credentials or path");
  }
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1" || url.hostname === "[::1]" || isIP(url.hostname) && url.hostname.startsWith("127.");
  if (!local && !allowRemote) throw new Error("remote brokers require the explicit --allow-remote flag");
  if (!local && url.protocol !== "mqtts:") throw new Error("remote brokers require mqtts://");
  return url;
}

function integer(value, name, minimum) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < minimum) throw new Error(`${name} must be an integer >= ${minimum}`);
  return result;
}

function rate(value, name) {
  const result = Number(value);
  if (!Number.isFinite(result) || result < 0 || result > 1) throw new Error(`${name} must be between 0 and 1`);
  return result;
}

module.exports = { DEFAULTS, normalizeConfig, parseArgs, validateBrokerUrl };
