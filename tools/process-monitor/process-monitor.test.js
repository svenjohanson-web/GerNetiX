const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const control = require("./desktop-process-control");
const html = fs.readFileSync(path.join(__dirname, "public/desktop.html"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "public/desktop-app.js"), "utf8");
const desktopMain = fs.readFileSync(path.join(__dirname, "desktop-main.js"), "utf8");
const desktopPreload = fs.readFileSync(path.join(__dirname, "desktop-preload.js"), "utf8");

test("monitor exposes every managed platform service", () => {
  assert.equal(control.services.find((item) => item.id === "identity-server").port, 4300);
  assert.equal(control.services.find((item) => item.id === "admin-tool").port, 4600);
  assert.equal(control.services.length, 9);
});

test("desktop app uses isolated IPC and has no admin tool dependency", () => {
  assert.match(desktopMain, /new BrowserWindow/);
  assert.match(desktopMain, /contextIsolation: true/);
  assert.match(desktopPreload, /contextBridge\.exposeInMainWorld/);
  assert.doesNotMatch(desktopMain, /4600|admin-tool/);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, "desktop-process-control.js"), "utf8"), /require\("\.\.\/staging-deploy"\)/);
});

test("packaged Electron runtime starts services in Node mode", () => {
  const source = fs.readFileSync(path.join(__dirname, "desktop-process-control.js"), "utf8");
  assert.match(source, /ELECTRON_RUN_AS_NODE:"1"/);
});

test("monitor UI displays life status and start stop controls", () => {
  assert.match(html, /Prozess-Monitor/);
  assert.match(client, /item\.healthy\?"Läuft":"Gestoppt"/);
  assert.match(client, /data-action="start"/);
  assert.match(client, /data-action="stop"/);
  assert.match(client, /setInterval\(load,10000\)/);
});

test("monitor reads VPS compose state through the established staging SSH configuration", async () => {
  const rows = control.parseComposePs([
    JSON.stringify({ Service: "mqtt-broker", Name: "gernetix-mqtt-broker-1", State: "running", Health: "healthy", Status: "Up 2 hours (healthy)" }),
    JSON.stringify({ Service: "build-deploy-server", Name: "gernetix-build-deploy-server-1", State: "running", Health: "unhealthy", Status: "Up 2 hours (unhealthy)" }),
  ].join("\n"));
  assert.equal(rows.length, 2);
  assert.equal(rows[0].id, "mqtt-broker");
  assert.equal(rows[0].healthy, true);
  assert.equal(rows[1].healthy, false);
  assert.match(desktopPreload, /listVps/);
  assert.match(desktopMain, /processes:list-vps/);
  assert.match(html, /Container und OTA-Infrastruktur/);
  assert.match(client, /renderVps/);
});

test("monitor displays persisted external interface call statistics", () => {
  assert.match(html, /Schnittstellen-Statistik/);
  assert.match(html, /Ausgehende Schnittstellenaufrufe/);
  assert.match(client, /interfaceStatistics\(24\)/);
  assert.match(client, /renderStatistics/);
  assert.match(desktopPreload, /interfaceStatistics/);
  assert.match(desktopMain, /interfaces:statistics/);
  const statistics = control.interfaceStatistics(24);
  assert.equal(Array.isArray(statistics.items), true);
  assert.equal(typeof statistics.summary.calls, "number");
});

test("monitor shows runtime alerts from persisted system and interface failures", () => {
  assert.match(html, /id="runtimeAlerts"/);
  assert.match(html, /Auffaelligkeiten/);
  assert.match(client, /runtimeAlerts\(24\)/);
  assert.match(client, /renderAlerts/);
  assert.match(desktopPreload, /runtimeAlerts/);
  assert.match(desktopMain, /runtime:alerts/);
  const alerts = control.runtimeAlerts(24);
  assert.equal(Array.isArray(alerts.items), true);
  assert.equal(typeof alerts.summary.errors, "number");
});

test("all local services start in order and retain individual failures", async () => {
  const calls = [];
  const result = await control.startAllServices({ startService: async (id) => {
    calls.push(id);
    if (id === "hardware-shop") throw new Error("Start fehlgeschlagen");
    return { id, healthy:true };
  }});
  assert.deepEqual(calls, control.services.map((service) => service.id));
  assert.equal(result.items.length, control.services.length);
  assert.equal(result.healthy, control.services.length - 1);
  assert.equal(result.failed, 1);
  assert.equal(result.items.find((item) => item.id === "hardware-shop").error, "Start fehlgeschlagen");
  assert.match(desktopPreload, /processes:start-all/);
  assert.match(desktopMain, /processes:start-all/);
  assert.match(html, /id="startAllLocal"/);
  assert.match(client, /gernetixProcesses\.startAll/);
});
