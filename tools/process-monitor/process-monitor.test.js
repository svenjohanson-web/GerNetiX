const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { DatabaseSync } = require("node:sqlite");
const control = require("./desktop-process-control");
const html = fs.readFileSync(path.join(__dirname, "public/desktop.html"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "public/desktop-app.js"), "utf8");
const desktopMain = fs.readFileSync(path.join(__dirname, "desktop-main.js"), "utf8");
const desktopPreload = fs.readFileSync(path.join(__dirname, "desktop-preload.js"), "utf8");

test("monitor exposes every managed platform service", () => {
  assert.equal(control.services.find((item) => item.id === "identity-server").port, 4300);
  assert.equal(control.services.find((item) => item.id === "admin-tool").port, 4600);
  assert.equal(control.services.find((item) => item.id === "community-platform").port, 5200);
  assert.equal(control.services.length, 10);
});

test("desktop monitor reports Community SQLite counts without reading content", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-monitor-community-"));
  const runtime = path.join(root, ".runtime");
  const dbPath = path.join(runtime, "gernetix-community.sqlite");
  fs.mkdirSync(runtime);
  const db = new DatabaseSync(dbPath);
  try {
    db.exec(`
      CREATE TABLE community_questions (question_id TEXT, visibility TEXT, status TEXT);
      CREATE TABLE community_answers (answer_id TEXT, verification_state TEXT);
      CREATE TABLE community_knowledge_documents (document_id TEXT);
      INSERT INTO community_questions VALUES ('public-1', 'public', 'open');
      INSERT INTO community_questions VALUES ('private-1', 'private', 'answered');
      INSERT INTO community_answers VALUES ('answer-1', 'verified');
      INSERT INTO community_knowledge_documents VALUES ('document-1');
    `);
  } finally {
    db.close();
  }

  try {
    const summary = control.communityStorageSummary(root);
    assert.equal(summary.exists, true);
    assert.deepEqual(summary.questions, { total:2, public:1, private:1, open:1 });
    assert.deepEqual(summary.answers, { total:1, verified:1 });
    assert.equal(summary.knowledgeDocuments.total, 1);
    assert.equal(summary.path, path.join(".runtime", "gernetix-community.sqlite"));
  } finally {
    fs.rmSync(root, { recursive:true, force:true });
  }
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
  assert.match(client, /Community-Speicher/);
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

test("monitor controls only the configured macOS WireGuard network extension", async () => {
  const disconnected='* (Disconnected)   example-id VPN (com.wireguard.macos) "gernetix-vps-mac"';
  const connected='* (Connected)   example-id VPN (com.wireguard.macos) "gernetix-vps-mac"';
  assert.deepEqual(control.parseMacVpnState(disconnected), {configured:true,connected:false,transitional:false,state:"disconnected"});
  assert.deepEqual(control.parseMacVpnState(connected), {configured:true,connected:true,transitional:false,state:"connected"});
  let state=disconnected;
  const calls=[];
  const run=async(file,args)=>{
    calls.push([file,...args]);
    if(args[1]==="start")state=connected;
    return {stdout:args[1]==="list"?state:"",stderr:""};
  };
  const result=await control.setVpnConnected(true,{platform:"darwin",execFileAsync:run,delay:async()=>{},maxAttempts:2});
  assert.equal(result.connected,true);
  assert.deepEqual(calls.find((call)=>call[1]==="--nc"&&call[2]==="start"),["scutil","--nc","start","gernetix-vps-mac"]);
});

test("monitor defines a fixed SSH diagnostic tunnel from the staging configuration", () => {
  const definition=control.stagingTunnelDefinition({
    GERNETIX_STAGING_SSH:"root@gernetix-vps",
    GERNETIX_STAGING_LOCAL_ADMIN_PORT:"14600",
    GERNETIX_STAGING_REMOTE_ADMIN_PORT:"4610",
    GERNETIX_STAGING_LOCAL_PLATFORM_PORT:"14300",
    GERNETIX_STAGING_REMOTE_PLATFORM_PORT:"8080",
    GERNETIX_STAGING_LOCAL_IDENTITY_DB_PORT:"25432",
    GERNETIX_STAGING_REMOTE_IDENTITY_DB_PORT:"25432"
  });
  assert.deepEqual(definition.args.slice(0,7),["-N","-o","BatchMode=yes","-o","ExitOnForwardFailure=yes","-o","ServerAliveInterval=30"]);
  assert.ok(definition.args.includes("14600:127.0.0.1:4610"));
  assert.ok(definition.args.includes("14300:127.0.0.1:8080"));
  assert.ok(definition.args.includes("25432:127.0.0.1:25432"));
  assert.equal(definition.args.at(-1),"root@gernetix-vps");
  assert.match(desktopPreload,/tunnelStart/);
  assert.match(desktopMain,/tunnel:start/);
  assert.match(html,/VPS SSH-Tunnel/);
  assert.match(client,/renderTunnel/);
});

test("Identity starts only in remote-dev mode after the complete VPS tunnel is available", async () => {
  const config={
    GERNETIX_STAGING_SSH:"root@gernetix-vps",
    GERNETIX_STAGING_LOCAL_ADMIN_PORT:"14600",
    GERNETIX_STAGING_REMOTE_ADMIN_PORT:"4610",
    GERNETIX_STAGING_LOCAL_PLATFORM_PORT:"14300",
    GERNETIX_STAGING_REMOTE_PLATFORM_PORT:"8080",
    GERNETIX_STAGING_LOCAL_IDENTITY_DB_PORT:"25432",
    GERNETIX_STAGING_REMOTE_IDENTITY_DB_PORT:"25432"
  };
  let checks=0;
  let launched=null;
  const result=await control.startIdentityRemoteDev({
    config,
    pidForPort:async()=>123,
    checkService:async(item)=>({ ...item, healthy:++checks>1 }),
    remoteIdentityEnvironment:()=>({IDENTITY_REMOTE_DEV:"1",IDENTITY_PERSISTENCE_BACKEND:"postgres",ELECTRON_RUN_AS_NODE:"1"}),
    launchLoggedService:(item,env)=>{launched={item,env};return {exitCode:null,unref(){}};},
    delay:async()=>{}
  });
  assert.equal(result.healthy,true);
  assert.equal(launched.item.id,"identity-server");
  assert.equal(launched.env.IDENTITY_REMOTE_DEV,"1");
  assert.equal(launched.env.IDENTITY_PERSISTENCE_BACKEND,"postgres");
  assert.match(fs.readFileSync(path.join(__dirname,"desktop-process-control.js"),"utf8"),/Identity benötigt den verbundenen VPS SSH-Tunnel/);
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
