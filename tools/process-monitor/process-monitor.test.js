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

test("monitor treats every backend including Identity as a VPS service", async () => {
  assert.equal(control.services.find((item) => item.id === "identity-server").port, 4300);
  assert.equal(control.services.find((item) => item.id === "admin-tool").port, 4600);
  assert.equal(control.services.find((item) => item.id === "community-platform").port, 5200);
  assert.equal(control.services.find((item) => item.id === "telemetry-server").port, 5600);
  assert.equal(control.services.find((item) => item.id === "public-demo-server").port, 4920);
  assert.equal(control.services.find((item) => item.id === "community-ai-assistant").port, 5300);
  assert.equal(control.services.find((item) => item.id === "persistence-server").port, 5400);
  assert.equal(control.services.find((item) => item.id === "provisioning-tool").port, 4500);
  assert.equal(control.services.find((item) => item.id === "recovery-tool").port, 5100);
  assert.equal(control.services.find((item) => item.id === "admin-access-server").port, 4610);
  assert.equal(control.services.length, 17);
  assert.deepEqual(control.services.filter((item) => item.local).map((item) => item.id), []);
  assert.deepEqual(control.services.filter((item) => item.autoStart).map((item) => item.id), []);
  const states = await control.processStates();
  assert.deepEqual(states, []);
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

test("desktop app uses isolated IPC and keeps admin access outside the renderer", () => {
  assert.match(desktopMain, /new BrowserWindow/);
  assert.match(desktopMain, /contextIsolation: true/);
  assert.match(desktopPreload, /contextBridge\.exposeInMainWorld/);
  assert.doesNotMatch(client, /fetch\(|ADMIN_TOOL_ACCESS_TOKEN|OPERATIONS_POSTGRES/);
  assert.doesNotMatch(fs.readFileSync(path.join(__dirname, "desktop-process-control.js"), "utf8"), /require\("\.\.\/staging-deploy"\)/);
});

test("packaged Electron runtime starts services in Node mode", () => {
  const source = fs.readFileSync(path.join(__dirname, "desktop-process-control.js"), "utf8");
  assert.match(source, /ELECTRON_RUN_AS_NODE:"1"/);
});

test("monitor opens the canonical server platform instead of starting a local Identity", () => {
  assert.match(html, /Prozess-Monitor/);
  assert.match(client, /setInterval\(\(\)=>load\(false\),10000\)/);
  assert.match(html, /Die Plattform verwendet die einzige Identity auf dem VPS/);
  assert.match(html, />Plattform öffnen<\/button>/);
  assert.match(html, /Backend und Infrastruktur/);
  assert.match(client, /identity\?\.healthy\?"Server-Identity ist gesund"/);
  assert.match(desktopPreload, /openPlatform/);
  assert.match(desktopMain, /platform:open/);
  assert.doesNotMatch(html, /Identity starten|läuft lokal/);
  assert.doesNotMatch(client, /startAllLocal|data-action="start"|data-action="stop"/);
  assert.equal(control.platformEntryUrl({config:{GERNETIX_PRIVATE_PWA_URL:"https://pwa.gernetix.com/app/dashboard/"}}), "https://pwa.gernetix.com/app/dashboard/");
  assert.throws(() => control.platformEntryUrl({config:{GERNETIX_PRIVATE_PWA_URL:"http://127.0.0.1:4300/app/dashboard/"}}), /nur über HTTPS/);
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
  assert.match(html, /Backend und Infrastruktur/);
  assert.match(client, /renderVps/);
  let remoteCommand = "";
  const remote = await control.remoteProcessStates({
    config:{ GERNETIX_STAGING_SSH:"root@gernetix-vps", GERNETIX_STAGING_DIR:"/opt/gernetix" },
    execFileAsync:async(_file,args)=>{remoteCommand=args.at(-1);return { stdout:[
      JSON.stringify({ Service:"identity-server", Name:"identity", State:"running", Health:"healthy" }),
      JSON.stringify({ Service:"project-postgres-migration", Name:"migration", State:"exited", Health:"" }),
      JSON.stringify({ Service:"project-server", Name:"project", State:"running", Health:"healthy" }),
    ].join("\n"), stderr:"" }}
  });
  assert.match(remoteCommand, /docker compose --env-file \.env\.vps -f compose\.vps\.yaml ps --format json/);
  assert.deepEqual(remote.items.map((item)=>item.id), ["identity-server", "project-server"]);
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

test("monitor reads link integrity through the fixed Admin Tool diagnostic command", async () => {
  assert.match(html, /data-view="linksView">Links/);
  assert.match(html, /Operations-PostgreSQL/);
  assert.match(client, /renderLinkIntegrity/);
  assert.match(desktopPreload, /link-integrity:status/);
  assert.match(desktopMain, /link-integrity:status/);
  let remoteCommand = "";
  const result = await control.remoteLinkIntegrity({
    force:true,
    config:{ GERNETIX_STAGING_SSH:"root@gernetix-vps", GERNETIX_STAGING_DIR:"/opt/gernetix" },
    execFileAsync:async(_file,args)=>{
      remoteCommand=args.at(-1);
      return {stdout:JSON.stringify({
        access:{audit_event_id:"not-for-renderer"},
        summary:{total_targets:2,authenticated:1,healthy:1,broken:1},
        items:[
          {reference_id:"identity.home",target_url:"/",link_type:"internal",owner_domain:"Identity",access_scope:"public",occurrence_count:2,latest_check:{status:"healthy",http_status:200,checked_at:"2026-07-30T10:00:00.000Z",raw_secret:"hidden"}},
          {reference_id:"identity.dashboard",target_url:"/app/dashboard/",link_type:"internal",owner_domain:"Identity",access_scope:"authenticated",occurrence_count:1,latest_check:{status:"broken",http_status:404,checked_at:"2026-07-30T10:00:00.000Z"}},
        ],
      }),stderr:""};
    },
  });
  assert.match(remoteCommand, /docker compose --env-file \.env\.vps -f compose\.vps\.yaml exec -T admin-tool node \/app\/services\/admin-tool\/scripts\/read-link-integrity\.js/);
  assert.doesNotMatch(remoteCommand, /ADMIN_TOOL_ACCESS_TOKEN|postgres|password/i);
  assert.equal(result.summary.broken,1);
  assert.equal(result.items[1].access_scope,"authenticated");
  assert.equal(result.items[0].latest_check.raw_secret,undefined);
  assert.equal(result.access,undefined);
});

test("desktop monitor uses the same operator navigation terminology", () => {
  assert.match(html, /Operator Console/);
  assert.match(html, /Desktop · Serverbetrieb/);
  assert.match(html, />Übersicht<\/button>/);
  assert.match(html, />Betrieb<\/button>/);
  assert.match(html, />Links<\/button>/);
  assert.match(html, />Sicherheit<\/button>/);
  assert.match(client, /classList\.toggle\("is-active",active\)/);
});

test("closing the desktop window exits the macOS app instead of leaving it windowless", () => {
  assert.match(desktopMain, /let mainWindow = null/);
  assert.match(desktopMain, /mainWindow\.show\(\)/);
  assert.match(desktopMain, /app\.on\("activate", createWindow\)/);
  assert.match(desktopMain, /app\.on\("window-all-closed", \(\) => \{[\s\S]*app\.quit\(\)/);
  assert.doesNotMatch(desktopMain, /process\.platform !== "darwin"/);
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
  assert.ok(definition.args.includes("127.0.0.1:14600:127.0.0.1:4610"));
  assert.ok(definition.args.includes("127.0.0.1:14300:127.0.0.1:8080"));
  assert.ok(definition.args.includes("127.0.0.1:25432:127.0.0.1:25432"));
  assert.equal(definition.args.at(-1),"root@gernetix-vps");
  assert.match(desktopPreload,/tunnelStart/);
  assert.match(desktopMain,/tunnel:start/);
  assert.match(html,/VPS SSH-Tunnel/);
  assert.match(client,/renderTunnel/);
});

test("monitor rejects a partial SSH tunnel mixed with local domain services", async () => {
  const state=await control.stagingTunnelState({
    config:{
      GERNETIX_STAGING_SSH:"root@gernetix-vps",
      GERNETIX_STAGING_LOCAL_ADMIN_PORT:"14600",
      GERNETIX_STAGING_REMOTE_ADMIN_PORT:"4610",
      GERNETIX_STAGING_LOCAL_PLATFORM_PORT:"14300",
      GERNETIX_STAGING_REMOTE_PLATFORM_PORT:"8080",
      GERNETIX_STAGING_LOCAL_IDENTITY_DB_PORT:"25432",
      GERNETIX_STAGING_REMOTE_IDENTITY_DB_PORT:"25432"
    },
    pidForPort:async(port)=>port===4800?222:111
  });
  assert.equal(state.active,false);
  assert.match(state.error,/Portkonflikte/);
});

test("Identity cannot be started as a local desktop process", async () => {
  await assert.rejects(
    () => control.startService("identity-server"),
    /läuft auf dem VPS und kann hier nicht lokal gestartet werden/,
  );
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

test("desktop renderer exposes no local backend start path", async () => {
  const calls = [];
  const autoStartServices = control.services.filter((service) => service.autoStart);
  const result = await control.startAllServices({ startService: async (id) => {
    calls.push(id);
    return { id, healthy:false, error:"Start fehlgeschlagen" };
  }});
  assert.deepEqual(calls, autoStartServices.map((service) => service.id));
  assert.deepEqual(calls, []);
  assert.equal(result.items.length, 0);
  assert.equal(result.healthy, 0);
  assert.equal(result.failed, 0);
  assert.doesNotMatch(desktopPreload, /processes:start-all|processes:start|processes:stop/);
  assert.doesNotMatch(desktopMain, /processes:start-all|processes:start|processes:stop/);
  assert.doesNotMatch(html, /id="startAllLocal"/);
  assert.doesNotMatch(client, /gernetixProcesses\.startAll/);
});
