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

test("monitor controls Identity and the isolated build worker locally while persisted backends stay on the VPS", async () => {
  assert.equal(control.services.find((item) => item.id === "identity-server").port, 4300);
  assert.equal(control.services.find((item) => item.id === "admin-tool").port, 4600);
  assert.equal(control.services.find((item) => item.id === "community-platform").port, 5200);
  assert.equal(control.services.find((item) => item.id === "telemetry-server").port, 5600);
  assert.equal(control.services.find((item) => item.id === "public-demo-server").port, 4920);
  assert.equal(control.services.find((item) => item.id === "community-ai-assistant").port, 5300);
  assert.equal(control.services.find((item) => item.id === "persistence-server").port, 5400);
  assert.equal(control.services.find((item) => item.id === "device-voice-orchestrator").port, 5800);
  assert.equal(control.services.find((item) => item.id === "provisioning-tool").port, 4500);
  assert.equal(control.services.find((item) => item.id === "recovery-tool").port, 5100);
  assert.equal(control.services.find((item) => item.id === "admin-access-server").port, 4610);
  assert.equal(control.services.find((item) => item.id === "build-worker").port, 4400);
  assert.equal(control.services.length, 19);
  assert.deepEqual(control.services.filter((item) => item.local).map((item) => item.id), ["identity-server", "build-worker"]);
  assert.deepEqual(control.services.filter((item) => item.autoStart).map((item) => item.id), ["identity-server"]);
  const states = await control.processStates();
  assert.equal(states.length, 2);
  assert.deepEqual(states.map((item) => item.id), ["identity-server", "build-worker"]);
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

test("desktop monitor starts the Docker build worker through the dedicated helper", async () => {
  let checkCount = 0;
  let invocation = null;
  const result = await control.startBuildWorker({
    checkService:async(item) => ({...item, healthy:checkCount++ > 0}),
    execFileAsync:async(file,args,options) => { invocation={file,args,options}; return {stdout:"",stderr:""}; },
    delay:async()=>{},
  });
  assert.equal(result.healthy,true);
  assert.equal(invocation.file,process.execPath);
  assert.match(invocation.args[0],/tools\/build-worker\.js$/);
  assert.equal(invocation.args[1],"start");
  assert.equal(invocation.options.env.ELECTRON_RUN_AS_NODE,"1");
  assert.ok(invocation.options.env.GERNETIX_DOCKER_COMMAND);
});

test("desktop monitor reads the local worker from Docker health on macOS", async () => {
  let invocation;
  const result=await control.dockerBuildWorkerHealth({dockerCommand:"/usr/local/bin/docker",execFileAsync:async(file,args)=>{invocation={file,args};return {stdout:"healthy\n"};}});
  assert.equal(result.statusCode,200);
  assert.equal(invocation.file,"/usr/local/bin/docker");
  assert.deepEqual(invocation.args.slice(0,2),["inspect","--format"]);
});

test("desktop monitor resolves Docker Desktop even with a restricted GUI PATH", () => {
  const result=control.dockerExecutable({
    env:{PATH:"/usr/bin:/bin"},
    platform:"darwin",
    existsSync:(candidate)=>candidate==="/Applications/Docker.app/Contents/Resources/bin/docker",
  });
  assert.equal(result,"/Applications/Docker.app/Contents/Resources/bin/docker");
});

test("monitor starts local Identity only in PostgreSQL Remote-Dev mode", () => {
  assert.match(html, /Prozess-Monitor/);
  assert.match(client, /setInterval\(\(\)=>load\(false\),10000\)/);
  assert.match(html, /Identity-Prozess läuft lokal auf Port 4300/);
  assert.match(html, /<h2>Lokale Prozesse<\/h2>/);
  assert.match(html, /Build-Worker läuft bei Bedarf isoliert in Docker Desktop/);
  assert.match(html, /eine lokale Identity-SQLite wird nicht verwendet/);
  assert.match(html, />Identity starten<\/button>/);
  assert.match(html, /Backend und Infrastruktur/);
  assert.match(client, /Läuft lokal mit PostgreSQL/);
  assert.match(desktopPreload, /processes:start-all/);
  assert.match(desktopMain, /processes:start-all/);
  assert.doesNotMatch(html, /Plattform öffnen/);
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
  assert.match(html, /Desktop · lokale Entwicklung/);
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
    GERNETIX_STAGING_REMOTE_IDENTITY_DB_HOST:"10.77.0.1",
    GERNETIX_STAGING_REMOTE_IDENTITY_DB_PORT:"25432"
  });
  assert.deepEqual(definition.args.slice(0,7),["-N","-o","BatchMode=yes","-o","ExitOnForwardFailure=yes","-o","ServerAliveInterval=30"]);
  assert.ok(definition.args.includes("127.0.0.1:14600:127.0.0.1:4610"));
  assert.ok(definition.args.includes("127.0.0.1:14300:127.0.0.1:8080"));
  assert.ok(definition.args.includes("127.0.0.1:14400:127.0.0.1:14400"));
  assert.ok(definition.args.includes("127.0.0.1:4920:127.0.0.1:4920"));
  assert.ok(definition.args.includes("127.0.0.1:25432:10.77.0.1:25432"));
  assert.equal(definition.args.at(-1),"root@gernetix-vps");
  assert.match(desktopPreload,/tunnelStart/);
  assert.match(desktopMain,/tunnel:start/);
  assert.match(html,/VPS SSH-Tunnel/);
  assert.match(client,/renderTunnel/);
});

test("monitor detaches the SSH tunnel so it survives the desktop starter", async () => {
  let launchOptions=null;
  let unrefCalled=false;
  const child={exitCode:null,killed:false,once(){},unref(){unrefCalled=true;}};
  let checks=0;
  const result=await control.startStagingTunnel({
    config:{GERNETIX_STAGING_SSH:"root@gernetix-vps"},
    platform:"linux",
    pidForLoopbackPort:async()=>checks++>10?95959:null,
    spawn:(_command,_args,options)=>{launchOptions=options;return child;},
    delay:async()=>{},
    maxAttempts:4,
  });
  assert.equal(result.active,true);
  assert.equal(launchOptions.detached,true);
  assert.equal(unrefCalled,true);
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

test("tunnel state ignores a worker on the same port outside loopback", async () => {
  const state=await control.stagingTunnelState({
    config:{GERNETIX_STAGING_SSH:"root@gernetix-vps"},
    pidForLoopbackPort:async()=>95959,
  });
  assert.equal(state.active,true);
  assert.equal(state.error,"");
});

test("Identity starts locally only after the PostgreSQL tunnel is available", async () => {
  let checks=0;
  let launchedEnvironment=null;
  const result=await control.startService("identity-server",{
    checkService:async()=>checks++===0
      ? {id:"identity-server",healthy:false,pid:null,identityModeMismatch:false}
      : {id:"identity-server",healthy:true,pid:123,persistenceBackend:"postgres",remoteDev:true},
    config:{
      GERNETIX_STAGING_SSH:"root@gernetix-vps",
      GERNETIX_STAGING_LOCAL_ADMIN_PORT:"14600",
      GERNETIX_STAGING_REMOTE_ADMIN_PORT:"4610",
      GERNETIX_STAGING_LOCAL_PLATFORM_PORT:"14300",
      GERNETIX_STAGING_REMOTE_PLATFORM_PORT:"8080",
      GERNETIX_STAGING_LOCAL_IDENTITY_DB_PORT:"25432",
      GERNETIX_STAGING_REMOTE_IDENTITY_DB_PORT:"25432",
    },
    pidForPort:async()=>111,
    vpnState:async()=>({supported:true,configured:true,connected:true}),
    remoteIdentityEnvironment:()=>({IDENTITY_RUNTIME_LOCATION:"local-development",IDENTITY_REMOTE_DEV:"1",IDENTITY_PERSISTENCE_BACKEND:"postgres"}),
    launchLoggedService:(_item,environment)=>{launchedEnvironment=environment;return {exitCode:null,unref(){}};},
    delay:async()=>{},
  });
  assert.equal(result.healthy,true);
  assert.equal(launchedEnvironment.IDENTITY_PERSISTENCE_BACKEND,"postgres");
  assert.equal(launchedEnvironment.IDENTITY_RUNTIME_LOCATION,"local-development");
});

test("Identity start restores VPN and PostgreSQL tunnel automatically", async () => {
  let checks=0;
  const actions=[];
  const result=await control.startService("identity-server",{
    checkService:async()=>checks++===0
      ? {id:"identity-server",healthy:false,pid:null,identityModeMismatch:false}
      : {id:"identity-server",healthy:true,pid:321,persistenceBackend:"postgres",remoteDev:true},
    config:{GERNETIX_STAGING_SSH:"root@gernetix-vps"},
    pidForPort:async()=>null,
    vpnState:async()=>({supported:true,configured:true,connected:false}),
    setVpnConnected:async()=>{actions.push("vpn");return {connected:true};},
    startStagingTunnel:async()=>{actions.push("tunnel");return {active:true};},
    remoteIdentityEnvironment:()=>({IDENTITY_RUNTIME_LOCATION:"local-development",IDENTITY_REMOTE_DEV:"1",IDENTITY_PERSISTENCE_BACKEND:"postgres"}),
    launchLoggedService:()=>({exitCode:null,unref(){}}),
    delay:async()=>{},
  });
  assert.equal(result.healthy,true);
  assert.deepEqual(actions,["vpn","tunnel"]);
});

test("failed Identity start does not leave an orphan process", async () => {
  let killed=false;
  await assert.rejects(control.startService("identity-server",{
    checkService:async()=>({id:"identity-server",healthy:false,pid:null,identityModeMismatch:false}),
    config:{GERNETIX_STAGING_SSH:"root@gernetix-vps"},
    pidForPort:async()=>111,
    vpnState:async()=>({supported:true,configured:true,connected:true}),
    remoteIdentityEnvironment:()=>({IDENTITY_PERSISTENCE_BACKEND:"postgres"}),
    launchLoggedService:()=>({exitCode:null,killed:false,unref(){},kill(){killed=true;}}),
    delay:async()=>{},
  }),/wurde nicht gestartet/);
  assert.equal(killed,true);
});

test("detects Windows listener PIDs independently of the localized state label", () => {
  assert.equal(control.pidFromWindowsNetstat("  TCP    127.0.0.1:4300    0.0.0.0:0    ABHÖREN    29384", 4300), 29384);
  assert.equal(control.pidFromWindowsNetstat("  TCP    127.0.0.1:4800    0.0.0.0:0    LISTENING    26300", 4800), 26300);
  assert.equal(control.pidFromWindowsNetstat("  TCP    127.0.0.1:4300    127.0.0.1:51000    ESTABLISHED    999", 4300), null);
  assert.equal(control.pidFromWindowsNetstat("  TCP    10.77.0.5:4400    0.0.0.0:0    LISTENING    100\n  TCP    127.0.0.1:4400    0.0.0.0:0    LISTENING    200",4400,"127.0.0.1"),200);
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

test("bulk start launches only the local PostgreSQL-backed Identity", async () => {
  const calls = [];
  const autoStartServices = control.services.filter((service) => service.autoStart);
  const result = await control.startAllServices({ startService: async (id) => {
    calls.push(id);
    return { id, healthy:true };
  }});
  assert.deepEqual(calls, autoStartServices.map((service) => service.id));
  assert.deepEqual(calls, ["identity-server"]);
  assert.equal(result.items.length, 1);
  assert.equal(result.healthy, 1);
  assert.equal(result.failed, 0);
  assert.match(desktopPreload, /processes:start-all/);
  assert.match(desktopMain, /processes:start-all/);
  assert.match(html, /id="startAllLocal"/);
  assert.match(client, /gernetixProcesses\.startAll/);
  assert.match(client, /setInterval\(\(\)=>loadAccessState\(\),2000\)/);
});
