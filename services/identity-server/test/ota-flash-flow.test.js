const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const app = fs.readFileSync(path.join(__dirname, "..", "public", "app", "app.js"), "utf8");
const server = fs.readFileSync(path.join(__dirname, "..", "src", "dev-server.js"), "utf8");
const html = fs.readFileSync(path.join(__dirname, "..", "public", "app", "index.html"), "utf8");

test("OTA flow waits for the build and accepts only confirmed deploy states", () => {
  const otaFlow = app.slice(app.indexOf("async function startOtaFlash"), app.indexOf("async function refreshRecoveryDevices"));
  assert.match(otaFlow, /await waitForCompletedBuild\(build\)/);
  assert.match(otaFlow, /device\.connectivity_status !== "online"/);
  assert.match(otaFlow, /completed\.status !== "succeeded"/);
  assert.match(otaFlow, /\["rebooting", "confirmed", "delivered", "succeeded"\]\.includes\(completed\.flash_status\)/);
  assert.doesNotMatch(otaFlow, /queued_for_mqtt/);
  assert.doesNotMatch(otaFlow, /build\.status === "succeeded" \? "ok"/);
});

test("IDE can actively probe the allocated board and refresh OTA readiness", () => {
  assert.match(html, /id="checkOtaConnectivityButton"[^>]*>Online prüfen</);
  assert.match(app, /async function checkAllocatedDeviceConnectivity/);
  assert.match(app, /connectivity-check/);
  assert.match(server, /async function handleDeviceConnectivityCheck/);
  assert.match(server, /connectivity\/status/);
  assert.match(server, /reachable: true/);
});

test("OTA button requires an online and ready device", () => {
  assert.match(app, /otaButton\.disabled = !allocated \|\| allocated\.ota_status !== "ready" \|\| allocated\.connectivity_status !== "online"/);
  assert.match(app, /Das zugeordnete Device ist nicht online/);
  assert.match(server, /mode === "build_and_flash" && device\.connectivity_status !== "online"/);
  assert.match(server, /error: "device_not_online"/);
  assert.match(app, /OTA nicht verfügbar: Das Device ist nicht online/);
  assert.match(app, /actionReasonNode\.textContent = visibleReason/);
  assert.match(app, /actionReasonNode\.classList\.toggle\("hidden", !visibleReason\)/);
});

test("OTA checks the complete server pipeline and reports deploy status instead of USB status", () => {
  assert.match(server, /const otaPreflight = await otaBuildDeployJson\("\/api\/ota\/preflight"\)/);
  assert.match(server, /error: "ota_pipeline_not_ready"/);
  assert.match(server, /job\.mode === "build_and_flash"[\s\S]*?job\.result\?\.deploy\?\.status/);
  assert.match(server, /OTA_BUILD_DEPLOY_BASE_URL \|\| "https:\/\/build\.gernetix\.com"/);
  assert.match(server, /mode === "build_and_flash" \? otaBuildDeployJson : buildDeployJson/);
  assert.match(server, /projectJob\?\.mode === "build_and_flash" \? otaBuildDeployJson : buildDeployJson/);
  assert.match(app, /Build fertig\. OTA-Auftrag ist/);
  assert.match(app, /warte auf das Board/);
});
