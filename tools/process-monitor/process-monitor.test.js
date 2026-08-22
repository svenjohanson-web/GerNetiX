const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const control = require("./desktop-process-control");
const html = fs.readFileSync(path.join(__dirname, "public/desktop.html"), "utf8");
const client = fs.readFileSync(path.join(__dirname, "public/desktop-app.js"), "utf8");
const desktopMain = fs.readFileSync(path.join(__dirname, "desktop-main.js"), "utf8");
const desktopPreload = fs.readFileSync(path.join(__dirname, "desktop-preload.js"), "utf8");

test("monitor controls Identity and the isolated build worker locally while persisted backends stay on the VPS", async () => {
  assert.equal(control.services.find((item) => item.id === "identity-server").port, 4300);
  assert.equal(control.services.find((item) => item.id === "build-worker").port, 4400);
  assert.equal(control.services.length, 2);
  assert.deepEqual(control.services.filter((item) => item.local).map((item) => item.id), ["identity-server", "build-worker"]);
  assert.deepEqual(control.services.filter((item) => item.autoStart).map((item) => item.id), ["identity-server"]);
  const states = await control.processStates();
  assert.equal(states.length, 2);
  assert.deepEqual(states.map((item) => item.id), ["identity-server", "build-worker"]);
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

test("packaged monitor uses its bundled Electron executable in Node mode without relying on GUI PATH", () => {
  assert.equal(control.serviceNodeExecutable({ env:{ PATH:"/usr/bin:/bin" }, versions:{ electron:"37.10.3" }, execPath:"/Applications/GerNetiX Prozess-Monitor.app/Contents/MacOS/GerNetiX Prozess-Monitor" }), "/Applications/GerNetiX Prozess-Monitor.app/Contents/MacOS/GerNetiX Prozess-Monitor");
  assert.equal(control.serviceNodeExecutable({ env:{ GERNETIX_NODE_COMMAND:"C:\\Tools\\node.exe" }, versions:{ electron:"37.10.3" }, execPath:"ignored" }), "C:\\Tools\\node.exe");
  assert.equal(control.serviceNodeExecutable({ env:{}, versions:{}, execPath:"C:\\Program Files\\node.exe" }), "C:\\Program Files\\node.exe");
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
  assert.match(invocation.args[0],/tools[\\/]build-worker\.js$/);
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

test("build worker start opens Docker Desktop on macOS and waits for its API", async () => {
  const calls=[];
  let dockerChecks=0;
  const result=await control.ensureDockerReady({
    platform:"darwin",dockerCommand:"/usr/local/bin/docker",dockerReadyAttempts:3,delay:async()=>{},
    execFileAsync:async(file,args)=>{
      calls.push([file,...args]);
      if(file==="open")return {stdout:"",stderr:""};
      dockerChecks+=1;
      if(dockerChecks<3)throw new Error("docker socket missing");
      return {stdout:"27.5.1\n",stderr:""};
    },
  });
  assert.equal(result,"/usr/local/bin/docker");
  assert.deepEqual(calls[1],["open","-g","-a","Docker"]);
  assert.equal(dockerChecks,3);
});

test("build worker start reports a clear Docker Desktop readiness timeout", async () => {
  await assert.rejects(control.ensureDockerReady({
    platform:"darwin",dockerCommand:"/usr/local/bin/docker",dockerReadyAttempts:2,delay:async()=>{},
    execFileAsync:async(file)=>{if(file==="open")return {stdout:"",stderr:""};throw new Error("docker socket missing");},
  }),/Docker-API war nach zwei Minuten noch nicht bereit/);
});

test("monitor starts local Identity only in PostgreSQL Remote-Dev mode", () => {
  assert.match(html, /Prozess-Monitor/);
  assert.match(client, /setInterval\(\(\)=>load\(false\),10000\)/);
  assert.equal(control.services.find((item) => item.id === "identity-server").name, "Identity Dev-Server");
  assert.match(html, /Identity Dev-Server wird hier immer als eigener Prozess auf Port 4300 angezeigt/);
  assert.match(html, /<h2>Identity Dev-Server<\/h2>/);
  assert.match(html, /Build-Worker läuft bei Bedarf isoliert in Docker Desktop/);
  assert.match(html, /eine lokale Identity-SQLite wird nicht verwendet/);
  assert.match(html, />Dev-Server starten<\/button>/);
  assert.match(html, /Backend und Infrastruktur/);
  assert.match(client, /Dev-Server läuft mit PostgreSQL/);
  assert.match(client, /startLabel=worker\?"Worker starten":"Dev-Server starten"/);
  assert.match(client, /vpnToggle\.disabled=vpnBusy\|\|!vpnAvailable/);
  assert.match(client, /tunnelToggle\.disabled=tunnelBusy\|\|!tunnelAvailable/);
  assert.doesNotMatch(client, /vpnToggle\.disabled=busy\|\|/);
  assert.doesNotMatch(client, /tunnelToggle\.disabled=busy\|\|/);
  assert.match(desktopPreload, /processes:start-all/);
  assert.match(desktopMain, /processes:start-all/);
  assert.doesNotMatch(html, /Plattform öffnen/);
});

test("monitor exposes failed Identity dependencies as concrete degraded causes", () => {
  const health = {
    service: "identity-server",
    persistence_backend: "postgres",
    remote_dev: true,
    identity_db: { reachable: true },
    dependencies: {
      status: "degraded",
      unreachable: 1,
      items: [{ id: "project-server", name: "Project Server", reachable: false, error_code: "econnrefused", health_url: "http://127.0.0.1:4800/health", latency_ms: 12 }],
    },
  };
  assert.equal(control.isIdentityRemoteDevHealth(health), false);
  assert.match(control.identityHealthError(health), /Project Server/);
  assert.match(control.identityHealthError(health), /econnrefused/);
  assert.match(client, /Dev-Server läuft mit Abhängigkeitsfehlern/);
  assert.match(client, /Gestört/);
});

test("monitor reads VPS compose state through the established staging SSH configuration", async () => {
  const rows = control.parseComposePs([
    JSON.stringify({ Service: "mqtt-broker", Name: "gernetix-mqtt-broker-1", State: "running", Health: "healthy", Status: "Up 2 hours (healthy)" }),
    JSON.stringify({ Service: "build-deploy-server", Name: "gernetix-build-deploy-server-1", State: "running", Health: "unhealthy", Status: "Up 2 hours (unhealthy)" }),
    JSON.stringify({ Service: "runtime-postgres", Name: "gernetix-runtime-postgres-1", State: "exited", Health: "", Status: "Exited (1)" }),
  ].join("\n"));
  assert.equal(rows.length, 3);
  assert.equal(rows[0].id, "mqtt-broker");
  assert.equal(rows[0].healthy, true);
  assert.equal(rows[0].portLabel, "8883");
  assert.equal(rows[1].healthy, false);
  assert.equal(rows[1].portLabel, "4400");
  assert.equal(rows[2].name,"Zentrale Kontodatenbank (PostgreSQL)");
  assert.equal(rows[2].healthy,false);
  assert.match(desktopPreload, /listVps/);
  assert.match(desktopMain, /processes:list-vps/);
  assert.match(html, /Backend und Infrastruktur/);
  assert.match(client, /renderVps/);
  const remoteCommands = [];
  const remote = await control.remoteProcessStates({
    config:{ GERNETIX_STAGING_SSH:"gernetix-vps", GERNETIX_STAGING_MONITOR_SSH:"gernetix-monitor@gernetix-vps", GERNETIX_STAGING_DIR:"/opt/gernetix" },
    execFileAsync:async(_file,args)=>{const command=args.at(-1);remoteCommands.push(command);if(command.endsWith("account-database-status"))return {stdout:'{"status":"unavailable"}',stderr:""};return { stdout:[
      JSON.stringify({ Service:"identity-server", Name:"identity", State:"running", Health:"healthy" }),
      JSON.stringify({ Service:"project-postgres-migration", Name:"migration", State:"exited", Health:"" }),
      JSON.stringify({ Service:"project-server", Name:"project", State:"running", Health:"healthy" }),
    ].join("\n"), stderr:"" }}
  });
  assert.deepEqual(remoteCommands, [
    "sudo -n /usr/local/sbin/gernetix-monitor-diagnostic compose-ps",
    "sudo -n /usr/local/sbin/gernetix-monitor-diagnostic account-database-status",
  ]);
  assert.equal(remote.database.status,"unavailable");
  assert.ok(remote.items.some((item)=>item.id==="identity-server"&&item.healthy));
  assert.ok(remote.items.some((item)=>item.id==="project-server"&&item.healthy));
  assert.ok(remote.items.some((item)=>item.id==="runtime-postgres"&&!item.healthy&&item.status==="Kontodatenbank nicht erreichbar"));
  assert.ok(!remote.items.some((item)=>item.id.endsWith("-migration")));

  const unavailable = await control.remoteProcessStates({
    config:{ GERNETIX_STAGING_SSH:"gernetix-vps", GERNETIX_STAGING_MONITOR_SSH:"gernetix-monitor@gernetix-vps", GERNETIX_STAGING_DIR:"/opt/gernetix" },
    execFileAsync:async()=>{throw new Error("SSH unavailable");},
  });
  assert.equal(unavailable.stale, true);
  assert.ok(unavailable.error.includes("VPS nicht erreichbar"));
  assert.equal(unavailable.items.length, remote.items.length);
  assert.ok(unavailable.items.every((item)=>item.healthy===false&&item.state==="unknown"&&item.stale===true));
  assert.ok(unavailable.checkedAt);
  assert.ok(unavailable.lastSuccessfulAt);
  assert.match(client, /VPS-Status unbekannt/);
  assert.match(client, /status unknown/);
  assert.match(client, /Port.*portLabel/);
  assert.match(html, /VPS-Portweiterleitung \(SSH\)/);
  assert.match(html, /vpsCheckedAt/);
  assert.match(client,/Zentrale Kontodatenbank nicht erreichbar – Login nicht verfügbar/);
  assert.match(client,/PostgreSQL nicht erreichbar – Login nicht verfügbar/);
  assert.match(fs.readFileSync(path.join(__dirname,"../../infra/vps/security/gernetix-monitor-diagnostic"),"utf8"),/compose.*ps --all --format json/);
});

test("monitor checks and starts exactly the central account database through fixed VPS commands", async () => {
  let command="";
  const config={GERNETIX_STAGING_SSH:"operator@gernetix-vps",GERNETIX_STAGING_MONITOR_SSH:"gernetix-monitor@gernetix-vps"};
  const state=await control.remoteAccountDatabaseState({config,execFileAsync:async(_file,args)=>{command=args.at(-1);return {stdout:'{"status":"unavailable"}',stderr:""};}});
  assert.equal(command,"sudo -n /usr/local/sbin/gernetix-monitor-diagnostic account-database-status");
  assert.equal(state.reachable,false);
  const started=await control.startRemoteAccountDatabase({config,execFileAsync:async(_file,args)=>{command=args.at(-1);return {stdout:'{"status":"healthy"}',stderr:""};}});
  assert.equal(command,"sudo -n /usr/local/sbin/gernetix-monitor-diagnostic start-account-database");
  assert.equal(started.reachable,true);
  assert.match(desktopMain,/database:start-vps/);
  assert.match(desktopPreload,/startVpsDatabase/);
  assert.match(client,/Kontodatenbank starten/);
  assert.match(client,/startVpsDatabase/);
  const diagnostic=fs.readFileSync(path.join(__dirname,"../../infra/vps/security/gernetix-monitor-diagnostic"),"utf8");
  assert.match(diagnostic,/start-account-database[\s\S]*up -d runtime-postgres/);
  assert.doesNotMatch(diagnostic,/down -v|rm -rf|docker system prune/);
});

test("monitor reads interface statistics from central Operations PostgreSQL through the fixed diagnostic", async () => {
  assert.match(html, /data-view="statisticsView">Betrieb/);
  assert.match(html, /Ausgehende Schnittstellenaufrufe/);
  assert.match(client, /interfaceStatistics\(24\)/);
  assert.match(client, /renderStatistics/);
  assert.match(desktopPreload, /interfaceStatistics/);
  assert.match(desktopMain, /interfaces:statistics/);
  let remoteCommand = "";
  const statistics = await control.interfaceStatistics(24, {
    force:true,
    config:{ GERNETIX_STAGING_SSH:"gernetix-vps", GERNETIX_STAGING_MONITOR_SSH:"gernetix-monitor@gernetix-vps" },
    execFileAsync:async(_file,args)=>{
      remoteCommand=args.at(-1);
      return {stdout:JSON.stringify({hours:24,summary:{calls:3,failed:1,targets:1},items:[{source_service:"identity-server",target_service:"project-server",calls:3,failed:1,average_ms:12,maximum_ms:20,last_call:"2026-08-17T10:00:00.000Z"}]})};
    },
  });
  assert.equal(remoteCommand,"sudo -n /usr/local/sbin/gernetix-monitor-diagnostic interface-statistics");
  assert.equal(statistics.summary.calls,3);
  assert.equal(statistics.items[0].target_service,"project-server");
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
    config:{ GERNETIX_STAGING_SSH:"gernetix-vps", GERNETIX_STAGING_MONITOR_SSH:"gernetix-monitor@gernetix-vps", GERNETIX_STAGING_DIR:"/opt/gernetix" },
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
  assert.equal(remoteCommand, "sudo -n /usr/local/sbin/gernetix-monitor-diagnostic link-integrity");
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

test("monitor can restore PostgreSQL access by restoring VPN and SSH tunnel", async () => {
  const calls = [];
  let dbState = 0;
  // Der DB-Zustand wird einmal vor und einmal nach der Reparatur gelesen; den
  // Tunnel dazwischen beurteilt stagingTunnelState.
  const identityDbTunnelState = async () => {
    dbState += 1;
    if (dbState === 1) return { configured:true,identityDbConnected:false,vpnConnected:false,error:"VPN nicht verbunden." };
    return { configured:true,identityDbConnected:true,vpnConnected:true,error:"",identityDbPort:25432 };
  };
  const result = await control.restoreIdentityDbAccess({
    identityDbTunnelState,
    stagingTunnelState: async () => ({ configured:true,active:dbState > 1 }),
    setVpnConnected: async () => { calls.push("vpn"); return { connected:true }; },
    startStagingTunnel: async () => { calls.push("tunnel"); return { active:true }; },
  });
  assert.equal(result.identityDbConnected, true);
  assert.deepEqual(calls, ["vpn","tunnel"]);
  assert.equal(result.restored, true);
});

test("monitor skips PostgreSQL restore when access is already available", async () => {
  const calls = [];
  const result = await control.restoreIdentityDbAccess({
    identityDbTunnelState: async () => ({ configured:true,identityDbConnected:true,vpnConnected:true,error:"",identityDbPort:25432 }),
    setVpnConnected: async () => { calls.push("vpn"); },
    startStagingTunnel: async () => { calls.push("tunnel"); },
  });
  assert.equal(result.identityDbConnected, true);
  assert.equal(result.restored, false);
  assert.deepEqual(calls, []);
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

test("desktop monitor exposes PostgreSQL restore IPC and monitor action", () => {
  assert.match(desktopPreload, /postgresDbRestore/);
  assert.match(desktopMain, /postgres-db:restore/);
  assert.match(html, /id="fixPostgresAccess"/);
  assert.match(html, /id="postgresBanner"/);
  assert.match(html, /group-warning/);
  assert.match(client, /postgresDbRestore/);
  assert.match(client, /fixPostgresAccess/);
  assert.match(client, /renderPostgresAccessBanner/);
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
  assert.ok(definition.args.includes("127.0.0.1:4600:127.0.0.1:4600"));
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

test("Identity start waits out a slow bootstrap instead of killing it", async () => {
  // Ein Bootstrap ueber den VPS-Tunnel kann deutlich laenger als zehn Sekunden
  // brauchen. Wird er abgeschnitten, bleibt der Rueckstau, der ihn verlangsamt.
  let checks=0;
  const result=await control.startService("identity-server",{
    checkService:async()=>checks++>60
      ? {id:"identity-server",healthy:true,pid:222,persistenceBackend:"postgres",remoteDev:true}
      : {id:"identity-server",healthy:false,pid:null,identityModeMismatch:false},
    config:{GERNETIX_STAGING_SSH:"root@gernetix-vps"},
    pidForPort:async()=>111,
    vpnState:async()=>({supported:true,configured:true,connected:true}),
    startStagingTunnel:async()=>({active:true}),
    remoteIdentityEnvironment:()=>({IDENTITY_PERSISTENCE_BACKEND:"postgres"}),
    launchLoggedService:()=>({exitCode:null,killed:false,unref(){},kill(){throw new Error("Der Start wurde abgeschnitten.");}}),
    delay:async()=>{},
  });
  assert.equal(result.healthy,true);
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

test("monitor shows central Operations alerts without reading local runtime databases", async () => {
  assert.match(html, /id="runtimeAlerts"/);
  assert.match(html, /Auffaelligkeiten/);
  assert.match(client, /runtimeAlerts\(24\)/);
  assert.match(client, /renderAlerts/);
  assert.match(desktopPreload, /runtimeAlerts/);
  assert.match(desktopMain, /runtime:alerts/);
  const source=fs.readFileSync(path.join(__dirname,"desktop-process-control.js"),"utf8");
  assert.doesNotMatch(source,/node:sqlite|gernetix-services\.sqlite|gernetix-community\.sqlite/);
  const alerts = await control.operationsAlerts(24,{config:{}});
  assert.equal(Array.isArray(alerts.items),true);
  assert.equal(typeof alerts.summary.errors,"number");
});

test("monitor reads central user action failures through the fixed read-only diagnostic", async () => {
  assert.match(desktopMain, /operationsAlerts/);
  let remoteCommand = "";
  const remote = await control.remoteUserActionAlerts({
    force: true,
    hours: 24,
    config: { GERNETIX_STAGING_SSH: "gernetix-vps", GERNETIX_STAGING_MONITOR_SSH: "gernetix-monitor@gernetix-vps" },
    execFileAsync: async (_file, args) => {
      remoteCommand = args.at(-1);
      return { stdout: JSON.stringify({ summary: { recent_failures: [{
        action_id: "12345678-1234-4234-8234-123456789abc",
        action_type: "nexi.flash.usb.start",
        phase: "failed",
        reason_code: "local_dependency_unreachable",
        failed_span: "helper.status",
        last_seen_at: new Date().toISOString(),
      }] } }), stderr: "" };
    },
  });
  assert.equal(remoteCommand, "sudo -n /usr/local/sbin/gernetix-monitor-diagnostic user-action-alerts");
  assert.equal(remote.items[0].target_service, "nexi.flash.usb.start");
  assert.equal(remote.items[0].message, "local_dependency_unreachable · Action 12345678-1234…");
  assert.doesNotMatch(JSON.stringify(remote), /device_path|usb_id|hostname|raw_log/);
});

test("monitor reads the local Identity emergency trace with the full action id", async () => {
  let requestedUrl = "";
  const actionId = "2b303207-5483-4763-8cd6-b5799a1678a1";
  const result = await control.localUserActionDiagnostics({
    hours: 24,
    health: async (url) => {
      requestedUrl = url;
      return { statusCode: 200, body: { items: [{
        event_id: "11111111-1111-4111-8111-111111111111",
        occurred_at: new Date().toISOString(), action_id: actionId,
        action_type: "identity.login.passkey", span_type: "auth.verify",
        phase: "failed", reason_code: "identity_unreachable", delivery_state: "pending",
      }] } };
    },
  });
  assert.equal(requestedUrl, "http://127.0.0.1:4300/api/dev/local-action-diagnostics");
  assert.equal(result.items[0].action_id, actionId);
  assert.match(result.items[0].message, new RegExp(actionId));
  assert.match(client, /Vorgangs-ID/);
  assert.doesNotMatch(JSON.stringify(result), /account|message_detail|hostname|raw_log/);

  const merged = control.mergeRuntimeAlerts(result, {
    hours: 24,
    items: [{ ...result.items[0], event_id: "", source_service: "user_action" }],
  });
  assert.equal(merged.items.length, 1);
});

test("monitor shows all VPS protection rules with status and recommended action", async () => {
  assert.match(html, /VPS-Schutzregeln/);
  assert.match(html, /Empfohlene Massnahme/);
  assert.match(client, /renderSecurity/);
  assert.match(client, /securityRules/);
  assert.match(desktopPreload, /security:rules/);
  assert.match(desktopMain, /security:rules/);
  const diagnostic=fs.readFileSync(path.join(__dirname,"../../infra/vps/security/gernetix-monitor-diagnostic"),"utf8");
  const sshEntrypoint=fs.readFileSync(path.join(__dirname,"../../infra/vps/security/gernetix-monitor-ssh"),"utf8");
  const sudoers=fs.readFileSync(path.join(__dirname,"../../infra/vps/security/gernetix-monitor.sudoers"),"utf8");
  for(const source of [diagnostic,sshEntrypoint,sudoers]){
    assert.match(source,/interface-statistics/);
    assert.match(source,/account-database-status/);
    assert.match(source,/start-account-database/);
  }
  for(const port of [4300,4400,4600,4610,4700,4800,4900,4910,4920,5000,5200,5500,5600,5700,5800,14400])assert.match(diagnostic,new RegExp(String(port)));
  const checks = control.parseSecurityCheckOutput("firewall_protection=active\nweb_rate_limit=missing\n");
  assert.equal(checks.firewall_protection, "active");
  assert.equal(checks.web_rate_limit, "missing");
  const result = await control.securityRuleStates({
    config:{ GERNETIX_STAGING_SSH:"gernetix-vps", GERNETIX_STAGING_MONITOR_SSH:"gernetix-monitor@gernetix-vps" },
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
