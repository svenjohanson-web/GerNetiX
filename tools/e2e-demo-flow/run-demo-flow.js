#!/usr/bin/env node
const { spawn } = require("node:child_process");
const path = require("node:path");

const root = path.resolve(__dirname, "..", "..");
const startServices = process.argv.includes("--start-services");

const services = [
  { name: "device-management-server", port: 4700, cwd: "services/device-management-server" },
  { name: "provisioning-tool", port: 4500, cwd: "services/provisioning-tool" },
  { name: "recovery-tool", port: 5100, cwd: "services/recovery-tool" },
  { name: "ai-usage-server", port: 5000, cwd: "services/ai-usage-server" },
  { name: "community-platform", port: 5200, cwd: "services/community-platform" },
  { name: "community-ai-assistant", port: 5300, cwd: "services/community-ai-assistant" },
];

const children = [];

main().catch(async (error) => {
  console.error(JSON.stringify({ status: "failed", error: error.message, details: error.details || {} }, null, 2));
  await stopChildren();
  process.exitCode = 1;
});

async function main() {
  if (startServices) {
    for (const service of services) startService(service);
    await wait(1500);
  }

  await assertHealth("device-management-server", "http://127.0.0.1:4700/health");
  await assertHealth("provisioning-tool", "http://127.0.0.1:4500/health");
  await assertHealth("recovery-tool", "http://127.0.0.1:5100/health");
  await assertHealth("ai-usage-server", "http://127.0.0.1:5000/health");
  await assertHealth("community-platform", "http://127.0.0.1:5200/health");
  await assertHealth("community-ai-assistant", "http://127.0.0.1:5300/health");

  const provisioning = await smokeProvisioning();
  const recovery = await smokeRecovery();
  const community = await smokeCommunityAi();

  await stopChildren();
  console.log(JSON.stringify({ status: "ok", provisioning, recovery, community }, null, 2));
}

function startService(service) {
  const child = spawn(process.execPath, ["src/dev-server.js"], {
    cwd: path.join(root, service.cwd),
    stdio: "ignore",
    windowsHide: true,
  });
  children.push(child);
}

async function assertHealth(name, url) {
  const response = await request("GET", url);
  if (response.status !== "ok") {
    const error = new Error(`${name} health check failed`);
    error.details = response;
    throw error;
  }
}

async function smokeProvisioning() {
  const serial = `GNX-E2E-${Date.now()}`;
  const session = await request("POST", "http://127.0.0.1:4500/api/provisioning-sessions", {
    serial_number: serial,
    hardware_profile_id: "hardware.processor_board.esp32_devkit",
    provisioning_batch_id: "batch-e2e",
    firmware_version: "0.1.0",
    provisioned_by: "e2e-demo-flow",
    capabilities: ["wifi", "ota"],
    flash: { requested: false },
  });
  await request("POST", `http://127.0.0.1:4500/api/provisioning-sessions/${session.session_id}`, {
    completed_by: "e2e-demo-flow",
    quality_check_state: "passed",
    one_time_device_secret: session.one_time_device_secret,
  });
  const status = await request("GET", `http://127.0.0.1:4700/api/device-management/devices/${session.device.device_id}/status`);
  return {
    device_id: session.device.device_id,
    authenticity_status: status.authenticity_status,
    lifecycle_state: status.lifecycle_state,
  };
}

async function smokeRecovery() {
  const session = await request("POST", "http://127.0.0.1:5100/api/recovery/sessions", {
    account_id: "demo-account",
    detection: {
      usb_path: "COM-E2E",
      vendor_id: "10c4",
      product_id: "ea60",
      serial_number: `REC-E2E-${Date.now()}`,
    },
  });
  const renewed = await request("POST", `http://127.0.0.1:5100/api/recovery/sessions/${session.recovery_session_id}/renew-credentials`, {});
  const registered = await request("POST", `http://127.0.0.1:5100/api/recovery/sessions/${session.recovery_session_id}/register-community-device`, {
    one_time_device_secret: renewed.one_time_device_secret,
    connectivity_status: "online",
    ota_status: "ready",
  });
  return {
    device_id: session.device_id,
    recovery_status: registered.status,
  };
}

async function smokeCommunityAi() {
  const result = await request("POST", "http://127.0.0.1:5300/api/community-ai/query", {
    account_id: "demo-account",
    question: "Warum hat mein ESP32 OTA Timeout?",
  });
  return {
    query_id: result.query_id,
    status: result.status,
    sources: result.sources.length,
  };
}

async function request(method, url, body = null) {
  const response = await fetch(url, {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(`${method} ${url} failed with ${response.status}`);
    error.details = payload;
    throw error;
  }
  return payload;
}

async function stopChildren() {
  for (const child of children) {
    if (!child.killed) child.kill();
  }
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
