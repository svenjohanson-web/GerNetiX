#!/usr/bin/env node
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");

const MQTT_CREDENTIAL_CONTEXT = "gernetix:mqtt-broker-auth:v1";

function deriveMqttPassword(deviceSecret) {
  if (typeof deviceSecret !== "string" || deviceSecret.length === 0) {
    throw new Error("Device-Secret fehlt.");
  }
  return crypto.createHmac("sha256", deviceSecret).update(MQTT_CREDENTIAL_CONTEXT, "utf8").digest("hex");
}

function validDeviceId(deviceId) {
  return typeof deviceId === "string" && /^[A-Za-z0-9._-]{1,96}$/.test(deviceId);
}

function option(args, name, fallback = "") {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback;
}

function run(command, args) {
  const result = spawnSync(command, args, { stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} ist mit Exit-Code ${result.status} fehlgeschlagen.`);
}

function installCredential({ deviceId, password, composeFile, envFile }) {
  const composeArgs = ["compose"];
  if (envFile) composeArgs.push("--env-file", envFile);
  composeArgs.push("-f", composeFile, "exec", "-T", "mqtt-broker", "mosquitto_passwd", "-b", "/mosquitto/data/passwords", deviceId, password);
  run("docker", composeArgs);

  const reloadArgs = ["compose"];
  if (envFile) reloadArgs.push("--env-file", envFile);
  reloadArgs.push("-f", composeFile, "kill", "-s", "HUP", "mqtt-broker");
  run("docker", reloadArgs);
}

function main(args = process.argv.slice(2)) {
  const command = args[0] || "";
  const deviceId = option(args, "--device-id");
  if (!validDeviceId(deviceId)) throw new Error("--device-id muss 1 bis 96 sichere Zeichen enthalten.");
  if (!args.includes("--secret-stdin")) throw new Error("Device-Secret muss mit --secret-stdin ueber stdin geliefert werden.");
  const deviceSecret = fs.readFileSync(0, "utf8").trim();
  const password = deriveMqttPassword(deviceSecret);

  if (command === "derive") {
    process.stdout.write(`${password}\n`);
    return;
  }
  if (command !== "install") throw new Error("Usage: mqtt-device-credential.js derive|install --device-id <id> --secret-stdin [--compose-file <file>] [--env-file <file>]");

  installCredential({
    deviceId,
    password,
    composeFile: option(args, "--compose-file", "compose.vps.yaml"),
    envFile: option(args, "--env-file", ".env.vps"),
  });
  process.stdout.write(`MQTT-Zugang fuer ${deviceId} installiert; Broker-Konfiguration neu geladen.\n`);
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = { MQTT_CREDENTIAL_CONTEXT, deriveMqttPassword, validDeviceId };
