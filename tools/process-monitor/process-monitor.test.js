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
  assert.match(client, /setInterval\(\(\)=>load\(false\),10000\)/);
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
  assert.match(html, /data-view="statisticsView">Betrieb/);
  assert.match(html, /Ausgehende Schnittstellenaufrufe/);
  assert.match(client, /interfaceStatistics\(24\)/);
  assert.match(client, /renderStatistics/);
  assert.match(desktopPreload, /interfaceStatistics/);
  assert.match(desktopMain, /interfaces:statistics/);
  const statistics = control.interfaceStatistics(24);
  assert.equal(Array.isArray(statistics.items), true);
  assert.equal(typeof statistics.summary.calls, "number");
});

test("desktop monitor uses the same operator navigation terminology", () => {
  assert.match(html, /Operator Console/);
  assert.match(html, /Desktop · lokale Steuerung/);
  assert.match(html, />Übersicht<\/button>/);
  assert.match(html, />Betrieb<\/button>/);
  assert.match(html, />Sicherheit<\/button>/);
  assert.match(client, /classList\.toggle\("is-active",active\)/);
});

test("monitor controls only the configured GerNetiX WireGuard tunnel", async () => {
  assert.match(html, /id="vpnToggle"/);
  assert.match(html, /GerNetiX VPN/);
  assert.match(client, /vpnStatus\(\)/);
  assert.match(client, /vpnConnect/);
  assert.match(client, /vpnDisconnect/);
  assert.match(desktopPreload, /vpn:status/);
  assert.match(desktopMain, /vpn:connect/);
  assert.match(desktopMain, /vpn:disconnect/);
  assert.equal(control.parseWindowsServiceState("STATE              : 4  RUNNING"), 4);
  assert.equal(control.parseWindowsServiceState("STATE              : 1  STOPPED"), 1);

  let serviceCode = 1;
  const calls = [];
  const run = async (file, args) => {
    calls.push([file, ...args]);
    if (args[0] === "start") serviceCode = 4;
    return { stdout:`STATE              : ${serviceCode}  ${serviceCode === 4 ? "RUNNING" : "STOPPED"}`, stderr:"" };
  };
  const initial = await control.vpnState({ platform:"win32", execFileAsync:run });
  assert.equal(initial.connected, false);
  const connected = await control.setVpnConnected(true, { platform:"win32", execFileAsync:run, delay:async()=>{}, maxAttempts:2 });
  assert.equal(connected.connected, true);
  assert.deepEqual(calls.find((call) => call[1] === "start"), ["sc.exe", "start", "WireGuardTunnel$gernetix-vps"]);
});

test("detects Windows listener PIDs independently of the localized state label", () => {
  assert.equal(control.pidFromWindowsNetstat("  TCP    127.0.0.1:4300    0.0.0.0:0    ABHÖREN    29384", 4300), 29384);
  assert.equal(control.pidFromWindowsNetstat("  TCP    127.0.0.1:4800    0.0.0.0:0    LISTENING    26300", 4800), 26300);
  assert.equal(control.pidFromWindowsNetstat("  TCP    127.0.0.1:4300    127.0.0.1:51000    ESTABLISHED    999", 4300), null);
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

test("monitor shows all VPS protection rules with status and recommended action", async () => {
  assert.match(html, /VPS-Schutzregeln/);
  assert.match(html, /Empfohlene Massnahme/);
  assert.match(client, /renderSecurity/);
  assert.match(client, /securityRules/);
  assert.match(desktopPreload, /security:rules/);
  assert.match(desktopMain, /security:rules/);
  const checks = control.parseSecurityCheckOutput("firewall_protection=active\nweb_rate_limit=missing\n");
  assert.equal(checks.firewall_protection, "active");
  assert.equal(checks.web_rate_limit, "missing");
  const result = await control.securityRuleStates({
    config:{ GERNETIX_STAGING_SSH:"root@gernetix-vps" },
    execFileAsync:async()=>({ stdout:[
      "firewall_protection=active",
      "ssh_wireguard_only=active",
      "web_rate_limit=missing",
      "root_login_disabled=missing"
    ].join("\n"), stderr:"" })
  });
  assert.ok(result.items.length >= 16);
  assert.equal(result.items.find((item)=>item.id==="firewall").status, "active");
  assert.equal(result.items.find((item)=>item.id==="web-rate").status, "pending");
  assert.equal(result.items.find((item)=>item.id==="root-login").status, "open");
  assert.ok(result.items.every((item)=>item.recommendation));
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
