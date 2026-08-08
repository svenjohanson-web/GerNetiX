#!/usr/bin/env node
const fs = require("node:fs");
const { parseArgs } = require("./config");
const { DeviceMqttClient } = require("./mqtt-client");
const { DeviceSimulator } = require("./simulator");

const HELP = `GerNetiX MQTT device simulator

Usage: node src/cli.js [options]
  --broker-url URL             mqtt:// loopback or mqtts:// remote broker
  --device-count N             virtual devices (default: 10, max: 10000)
  --device-prefix PREFIX       unique device identity prefix
  --project-id ID              registered target project
  --duration-ms N              run duration (default: 60000)
  --telemetry-interval-ms N    interval per device
  --connection-ramp-ms N       spread initial connections over this duration
  --duplicate-rate 0..1        probability of an exact duplicate
  --delayed-rate 0..1          probability of a delayed measurement
  --delayed-by-ms N            delayed publish offset
  --max-reconnect-attempts N   bounded reconnect attempts per outage
  --allow-remote               explicit opt-in for remote mqtts:// brokers
  --ca-file PATH               trusted CA for MQTT TLS
  --cert-file PATH             shared test client certificate (if broker permits it)
  --key-file PATH              shared test client private key

The broker URL must not contain credentials. Reports contain aggregate counters only.
`;

async function main(argv = process.argv.slice(2)) {
  const config = parseArgs(argv);
  if (config.help) { process.stdout.write(HELP); return; }
  const tlsOptions = loadTlsOptions(config);
  const simulator = new DeviceSimulator({
    config,
    clientFactory: ({ deviceId }) => new DeviceMqttClient({
      url: config.brokerUrl,
      clientId: `gernetix-system-test-${deviceId}`,
      username: deviceId,
      connectTimeoutMs: config.connectTimeoutMs,
      tlsOptions,
    }),
  });
  simulator.on("deviceFailed", () => {});
  simulator.on("publishFailed", () => {});
  simulator.on("internalError", () => {});
  await simulator.start();
  const stop = () => {
    const summary = simulator.stop();
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  };
  const durationTimer = setTimeout(stop, config.durationMs);
  process.once("SIGINT", () => { clearTimeout(durationTimer); stop(); });
  process.once("SIGTERM", () => { clearTimeout(durationTimer); stop(); });
}

function loadTlsOptions(config) {
  const result = {};
  for (const [key, target] of [["caFile", "ca"], ["certFile", "cert"], ["keyFile", "key"]]) {
    if (config[key]) result[target] = fs.readFileSync(String(config[key]));
  }
  return result;
}

if (require.main === module) main().catch((error) => {
  process.stderr.write(`Device simulator configuration failed: ${error.message}\n`);
  process.exitCode = 1;
});

module.exports = { HELP, loadTlsOptions, main };
