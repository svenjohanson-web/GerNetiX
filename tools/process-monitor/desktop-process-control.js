const http = require("node:http");
const path = require("node:path");
const { execFile, spawn } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs");

const execFileAsync = promisify(execFile);
const VPN_SERVICE_NAME = "WireGuardTunnel$gernetix-vps";
const MACOS_VPN_SERVICE_NAME = "gernetix-vps-mac";
const REMOTE_DEV_SERVICE_FORWARDS = [[4400,4400],[4700,4700],[4800,4800],[4900,4900],[4920,4920],[5001,5000],[5200,5200],[5500,5500],[5600,5600],[5800,5800]];
const SECURITY_CACHE_MS = 60000;
const VPS_SERVICE_PORTS = Object.freeze({
  "runtime-postgres": "5432 intern · lokal 25432 per Tunnel",
  forgejo: "3000 intern",
  "project-server": "4800",
  "compute-control-plane": "5700",
  "build-deploy-server": "4400",
  "build-router": "4400 intern · lokal 14400 per Tunnel",
  "public-demo-server": "4920",
  "device-management-server": "4700",
  "telemetry-server": "5600",
  "hardware-catalog": "4910",
  "hardware-shop": "4900",
  "ai-usage-server": "5000",
  "device-voice-orchestrator": "5800",
  "community-platform": "5200",
  "ai-context-server": "5500",
  "admin-tool": "4600",
  "admin-access-server": "4610 · lokal 14600 per Tunnel",
  "identity-server": "4300",
  "mqtt-broker": "8883",
  "private-dns": "53 TCP/UDP",
  nginx: "8080 intern · lokal 14300 per Tunnel / 80 ACME",
  "nginx-tls": "443",
  certbot: "80/443 ACME",
});
const VPS_SERVICE_LABELS = Object.freeze({
  "runtime-postgres": "Zentrale Kontodatenbank (PostgreSQL)", forgejo: "Forgejo", "project-server": "Project Server",
  "compute-control-plane": "Compute Control Plane", "build-deploy-server": "Build & Deploy Server",
  "build-router": "Build Router", "public-demo-server": "Oeffentlicher Demo-Katalog",
  "device-management-server": "Device Management Server", "telemetry-server": "Telemetry Server",
  "hardware-catalog": "Hardware Catalog", "hardware-shop": "Hardware Shop", "ai-usage-server": "AI Usage Server",
  "device-voice-orchestrator": "Device Voice Orchestrator", "community-platform": "Community Platform",
  "ai-context-server": "AI Context Server", "admin-tool": "Admin Tool", "admin-access-server": "Admin Access Server",
  "identity-server": "Identity Server", "mqtt-broker": "MQTT Broker", "private-dns": "Private DNS",
  nginx: "Nginx ACME", "nginx-tls": "Nginx TLS", certbot: "Certbot",
});
let workspaceRoot = process.env.GERNETIX_WORKSPACE || path.resolve(__dirname, "../..");
let securityCache = null;
let linkIntegrityCache = null;
let userActionAlertsCache = null;
let interfaceStatisticsCache = null;
let stagingTunnel = null;
let stagingTunnelError = "";
let lastRemoteProcessItems = [];
let lastRemoteProcessSuccessAt = "";
const services = [
  service("identity-server", "Identity Server", 4300, {}, {local:true}),
  service("build-worker", "Lokaler Build-Worker", 4400, {}, {local:true,autoStart:false,kind:"docker-build-worker"}),
];

function service(id, name, port, environment={}, options={}) { const local=options.local===true; return { id, name, port, cwd:path.join(workspaceRoot,"services",id), healthUrl:`http://127.0.0.1:${port}/health`, environment, local, autoStart:local&&options.autoStart!==false,kind:options.kind||"node-service" }; }
function monitorSshTarget(config) { return assertSafeSshTarget(config.GERNETIX_STAGING_MONITOR_SSH || config.GERNETIX_STAGING_SSH || ""); }
function configureWorkspace(root) { workspaceRoot=path.resolve(root); for(const item of services)item.cwd=path.join(workspaceRoot,"services",item.id); }
function byId(id) { const item=services.find((entry)=>entry.id===id); if(!item) throw new Error("Unbekannter GerNetiX-Dienst."); return item; }
function isIdentityRemoteDevHealth(body){return body?.service==="identity-server"&&body?.persistence_backend==="postgres"&&body?.remote_dev===true;}
async function check(item) {
  try {
    const workerConfig=item.kind==="docker-build-worker"?loadBuildWorkerConfig():null;
    const response=workerConfig?await dockerBuildWorkerHealth():await health(item.healthUrl),statusCode=response.statusCode,pid=item.kind==="docker-build-worker"?null:await pidForPort(item.port);
    const statusHealthy=statusCode>=200&&statusCode<300;
    const identityModeMismatch=item.id==="identity-server"&&statusHealthy&&!isIdentityRemoteDevHealth(response.body);
    const persistenceUnavailable=item.id==="identity-server"&&response.body?.dependencies?.postgres?.status==="unavailable";
    return {...item,healthy:statusHealthy&&!identityModeMismatch,statusCode,pid,
      persistenceBackend:response.body?.persistence_backend||"",remoteDev:response.body?.remote_dev===true,
      identityModeMismatch,persistenceUnavailable,error:persistenceUnavailable?"Zentrale PostgreSQL-Kontodatenbank nicht erreichbar. Anmeldung ist nicht verfuegbar.":identityModeMismatch?"Falscher Identity-Modus: Port 4300 verwendet nicht Remote-Dev mit PostgreSQL.":"",
      ...(workerConfig?{workerId:workerConfig.BUILD_WORKER_ID,bindAddress:workerConfig.BUILD_WORKER_BIND_ADDRESS,coordinationBackend:response.body?.coordination?.backend||response.body?.coordination_backend||"postgres"}:{})};
  }
  catch(error){ return {...item,healthy:false,statusCode:0,pid:item.kind==="docker-build-worker"?null:await pidForPort(item.port),error:error.message}; }
}
async function processStates(){ return Promise.all(services.filter((item)=>item.local).map(check)); }
function dockerExecutable(options={}){
  const env=options.env||process.env,platform=options.platform||process.platform,existsSync=options.existsSync||fs.existsSync;
  if(String(env.GERNETIX_DOCKER_COMMAND||"").trim())return env.GERNETIX_DOCKER_COMMAND.trim();
  if(platform==="darwin"){
    const candidates=["/usr/local/bin/docker","/opt/homebrew/bin/docker","/Applications/Docker.app/Contents/Resources/bin/docker"];
    return candidates.find((candidate)=>existsSync(candidate))||"docker";
  }
  return "docker";
}
async function dockerBuildWorkerHealth(options={}){
  const run=options.execFileAsync||execFileAsync;
  const {stdout}=await run(options.dockerCommand||dockerExecutable(options),["inspect","--format","{{.State.Health.Status}}","gernetix-build-worker-build-worker-1"],{windowsHide:true,timeout:5000});
  const state=String(stdout||"").trim();
  if(state!=="healthy")throw new Error(state?`Docker-Healthstatus: ${state}`:"Build-Worker-Container wurde nicht gefunden.");
  return {statusCode:200,body:{service:"build-deploy-server",coordination_backend:"postgres"}};
}
async function dockerDaemonReady(options={}){
  const run=options.execFileAsync||execFileAsync;
  try{
    await run(options.dockerCommand||dockerExecutable(options),["info","--format","{{.ServerVersion}}"],{windowsHide:true,timeout:5000,maxBuffer:256*1024});
    return true;
  }catch{return false;}
}
async function ensureDockerReady(options={}){
  const dockerCommand=options.dockerCommand||dockerExecutable(options);
  if(await dockerDaemonReady({...options,dockerCommand}))return dockerCommand;
  const platform=options.platform||process.platform,run=options.execFileAsync||execFileAsync;
  if(platform!=="darwin")throw new Error("Docker Engine ist nicht erreichbar. Bitte Docker Desktop starten und den Build-Worker erneut versuchen.");
  try{
    await run("open",["-g","-a","Docker"],{windowsHide:true,timeout:10000});
  }catch{
    throw new Error("Docker Desktop konnte nicht geoeffnet werden. Bitte Docker Desktop installieren oder manuell starten.");
  }
  const wait=options.delay||delay,attempts=options.dockerReadyAttempts||120;
  for(let index=0;index<attempts;index+=1){
    if(await dockerDaemonReady({...options,dockerCommand}))return dockerCommand;
    await wait(1000);
  }
  throw new Error("Docker Desktop wurde geoeffnet, aber die Docker-API war nach zwei Minuten noch nicht bereit.");
}
async function interfaceStatistics(hours=24,options={}){
  return remoteInterfaceStatistics({...options,hours});
}
async function operationsAlerts(hours=24,options={}){
  return remoteUserActionAlerts({...options,hours});
}
async function remoteInterfaceStatistics(options={}){
  if(!options.force&&!options.execFileAsync&&interfaceStatisticsCache?.expiresAt>Date.now())return interfaceStatisticsCache.value;
  const hours=Math.max(1,Math.min(168,Number(options.hours)||24)),config=options.config||loadStagingConfig();
  if(!config.GERNETIX_STAGING_SSH)return {hours,items:[],summary:{calls:0,failed:0,targets:0},error:"Schnittstellen-Operations sind fuer Staging nicht konfiguriert."};
  const host=monitorSshTarget(config),run=options.execFileAsync||execFileAsync;
  const command="sudo -n /usr/local/sbin/gernetix-monitor-diagnostic interface-statistics";
  let value;
  try{
    const {stdout}=await run("ssh",["-o","BatchMode=yes","-o","ConnectTimeout=5",host,command],{windowsHide:true,timeout:15000,maxBuffer:1024*1024});
    const payload=JSON.parse(String(stdout||"{}"));
    const items=(Array.isArray(payload.items)?payload.items:[]).map((item)=>({
      source_service:String(item.source_service||""),target_service:String(item.target_service||""),
      calls:Number(item.calls||0),failed:Number(item.failed||0),average_ms:Number(item.average_ms||0),
      maximum_ms:Number(item.maximum_ms||0),last_call:item.last_call||null,
    }));
    value={hours:Number(payload.hours||hours),host,items,summary:{
      calls:Number(payload.summary?.calls||0),failed:Number(payload.summary?.failed||0),targets:Number(payload.summary?.targets||items.length),
    }};
  }catch(error){value={hours,host,items:[],summary:{calls:0,failed:0,targets:0},error:`Schnittstellen-Operations nicht lesbar: ${remoteError(error)}`};}
  if(!options.execFileAsync)interfaceStatisticsCache={expiresAt:Date.now()+SECURITY_CACHE_MS,value};
  return value;
}
async function remoteUserActionAlerts(options={}){
  if(!options.force&&!options.execFileAsync&&userActionAlertsCache?.expiresAt>Date.now())return userActionAlertsCache.value;
  const hours=Math.max(1,Number(options.hours)||24),config=options.config||loadStagingConfig();
  if(!config.GERNETIX_STAGING_SSH)return {hours,items:[],summary:{total:0,errors:0,warnings:0},error:"Nutzeraktions-Operations sind fuer Staging nicht konfiguriert."};
  const host=monitorSshTarget(config),run=options.execFileAsync||execFileAsync;
  const command="sudo -n /usr/local/sbin/gernetix-monitor-diagnostic user-action-alerts";
  let value;
  try{
    const {stdout}=await run("ssh",["-o","BatchMode=yes","-o","ConnectTimeout=5",host,command],{windowsHide:true,timeout:15000,maxBuffer:1024*1024});
    const payload=JSON.parse(String(stdout||"{}")),since=Date.now()-hours*3600000;
    const items=(payload?.summary?.recent_failures||[]).filter((item)=>new Date(item.last_seen_at).getTime()>=since).map((item)=>({
      occurred_at:item.last_seen_at,severity:item.phase==="timed_out"?"warning":"error",kind:"user_action",
      source_service:"user_action",target_service:String(item.action_type||""),route:String(item.failed_span||"action"),
      event_type:`user_action_${item.phase||"failed"}`,
      message:`${String(item.reason_code||"unknown_client_failure")} · Action ${String(item.action_id||"").slice(0,13)}…`,
    }));
    value={hours,host,items,summary:{total:items.length,errors:items.filter((item)=>item.severity==="error").length,warnings:items.filter((item)=>item.severity==="warning").length}};
  }catch(error){value={hours,host,items:[],summary:{total:0,errors:0,warnings:0},error:`Nutzeraktions-Operations nicht lesbar: ${remoteError(error)}`};}
  if(!options.execFileAsync)userActionAlertsCache={expiresAt:Date.now()+SECURITY_CACHE_MS,value};
  return value;
}
async function remoteProcessStates(options={}) {
  const config=options.config||loadStagingConfig();
  if(!config.GERNETIX_STAGING_SSH)return {configured:false,items:[],error:"VPS nicht konfiguriert: .env.staging.local fehlt oder enthält kein GERNETIX_STAGING_SSH."};
  const host=monitorSshTarget(config);
  const remoteDir=String(config.GERNETIX_STAGING_DIR||"/opt/gernetix");
  if(!remoteDir.startsWith("/")||/[\r\n]/.test(remoteDir))throw new Error("Ungültiges GERNETIX_STAGING_DIR.");
  const run=options.execFileAsync||execFileAsync;
  const command="sudo -n /usr/local/sbin/gernetix-monitor-diagnostic compose-ps";
  try {
    const {stdout}=await run("ssh",["-o","BatchMode=yes","-o","ConnectTimeout=5",host,command],{windowsHide:true,timeout:12000,maxBuffer:2*1024*1024});
    const checkedAt=new Date().toISOString();
    const database=await remoteAccountDatabaseState({...options,config,host,execFileAsync:run});
    const items=applyAccountDatabaseState(completeVpsServiceStates(parseComposePs(stdout).filter(isVisibleVpsService)),database);
    lastRemoteProcessItems=items;
    lastRemoteProcessSuccessAt=checkedAt;
    return {configured:true,host,items,database,checkedAt,lastSuccessfulAt:checkedAt,stale:false,error:""};
  } catch(error) {
    const checkedAt=new Date().toISOString();
    const knownItems=lastRemoteProcessItems.length
      ? lastRemoteProcessItems
      : Object.keys(VPS_SERVICE_PORTS).map((id)=>({id,name:VPS_SERVICE_LABELS[id]||id,portLabel:vpsServicePortLabel(id)}));
    const items=knownItems.map((item)=>({...item,healthy:false,state:"unknown",health:"",status:"Status nicht aktuell",stale:true,scope:"vps"}));
    return {configured:true,host,items,database:{status:"unknown",reachable:false},checkedAt,lastSuccessfulAt:lastRemoteProcessSuccessAt,stale:true,error:remoteError(error)};
  }
}

async function remoteAccountDatabaseState(options={}) {
  const config=options.config||loadStagingConfig();
  if(!config.GERNETIX_STAGING_SSH)return {status:"unknown",reachable:false,error:"VPS nicht konfiguriert."};
  const host=options.host||monitorSshTarget(config),run=options.execFileAsync||execFileAsync;
  const command="sudo -n /usr/local/sbin/gernetix-monitor-diagnostic account-database-status";
  try{
    const {stdout}=await run("ssh",["-o","BatchMode=yes","-o","ConnectTimeout=5",host,command],{windowsHide:true,timeout:12000,maxBuffer:256*1024});
    const payload=JSON.parse(String(stdout||"{}"));
    const reachable=payload.status==="healthy";
    return {status:reachable?"healthy":"unavailable",reachable,checkedAt:new Date().toISOString(),error:""};
  }catch(error){
    return {status:"unknown",reachable:false,checkedAt:new Date().toISOString(),error:`Kontodatenbankstatus nicht lesbar: ${remoteErrorDetail(error)}`};
  }
}

function applyAccountDatabaseState(items,database){
  return items.map((item)=>item.id!=="runtime-postgres"?item:{
    ...item,
    containerHealthy:item.healthy,
    accountDatabaseStatus:database.status,
    accountDatabaseReachable:database.reachable,
    healthy:item.healthy&&database.reachable,
    status:database.status==="unavailable"?"Kontodatenbank nicht erreichbar":database.status==="unknown"?"Kontodatenbankstatus unbekannt":item.status,
  });
}

async function startRemoteAccountDatabase(options={}){
  const config=options.config||loadStagingConfig();
  if(!config.GERNETIX_STAGING_SSH)throw new Error("VPS nicht konfiguriert: .env.staging.local fehlt oder enthält kein GERNETIX_STAGING_SSH.");
  const host=monitorSshTarget(config),run=options.execFileAsync||execFileAsync;
  const command="sudo -n /usr/local/sbin/gernetix-monitor-diagnostic start-account-database";
  try{
    const {stdout}=await run("ssh",["-o","BatchMode=yes","-o","ConnectTimeout=5",host,command],{windowsHide:true,timeout:90000,maxBuffer:256*1024});
    const payload=JSON.parse(String(stdout||"{}"));
    if(payload.status!=="healthy")throw new Error("Die zentrale Kontodatenbank meldet nach dem Start keinen gesunden Zustand.");
    return {status:"healthy",reachable:true,checkedAt:new Date().toISOString()};
  }catch(error){
    throw new Error(`Zentrale Kontodatenbank konnte nicht gestartet werden: ${remoteErrorDetail(error)}`);
  }
}

function isVisibleVpsService(item) {
  return !/(?:-migration|-provisioning|-postgres-access)$/.test(item.id);
}

function completeVpsServiceStates(items) {
  const current=new Map(items.map((item)=>[item.id,item]));
  return Object.keys(VPS_SERVICE_PORTS).map((id)=>current.get(id)||{
    id,name:VPS_SERVICE_LABELS[id]||id,portLabel:vpsServicePortLabel(id),container:"",
    state:"stopped",health:"",status:"Nicht gestartet",healthy:false,scope:"vps",expected:true,
  });
}

function vpsServicePortLabel(id) {
  return VPS_SERVICE_PORTS[id] || "";
}

async function remoteLinkIntegrity(options={}) {
  if (!options.force && !options.execFileAsync && linkIntegrityCache?.expiresAt > Date.now()) return linkIntegrityCache.value;
  const config=options.config||loadStagingConfig();
  if(!config.GERNETIX_STAGING_SSH)return {
    configured:false,
    summary:emptyLinkIntegritySummary(),
    items:[],
    error:"Link-Integrität nicht konfiguriert: GERNETIX_STAGING_SSH fehlt.",
  };
  const host=monitorSshTarget(config);
  const remoteDir=String(config.GERNETIX_STAGING_DIR||"/opt/gernetix");
  if(!remoteDir.startsWith("/")||/[\r\n]/.test(remoteDir))throw new Error("Ungültiges GERNETIX_STAGING_DIR.");
  const run=options.execFileAsync||execFileAsync;
  const command="sudo -n /usr/local/sbin/gernetix-monitor-diagnostic link-integrity";
  let value;
  try {
    const {stdout}=await run("ssh",["-o","BatchMode=yes","-o","ConnectTimeout=5",host,command],{windowsHide:true,timeout:20000,maxBuffer:5*1024*1024});
    value=presentLinkIntegrity(JSON.parse(String(stdout||"{}")),host);
  } catch(error) {
    const message=String(error.stderr||error.message||error).trim().split(/\r?\n/).slice(-1)[0];
    const detail=error instanceof SyntaxError?"Die Link-Integritätsantwort des VPS ist ungültig.":`Link-Integrität nicht lesbar: ${message}`;
    value={configured:true,host,summary:emptyLinkIntegritySummary(),items:[],error:detail};
  }
  if(!options.execFileAsync)linkIntegrityCache={expiresAt:Date.now()+SECURITY_CACHE_MS,value};
  return value;
}

function emptyLinkIntegritySummary(){
  return {total_targets:0,internal:0,external:0,authenticated:0,healthy:0,redirected:0,restricted:0,broken:0,unreachable:0,not_checked:0};
}

function presentLinkIntegrity(payload,host){
  const summary={...emptyLinkIntegritySummary(),...(payload?.summary||{})};
  const items=(Array.isArray(payload?.items)?payload.items:[]).map((item)=>({
    reference_id:String(item.reference_id||""),
    target_url:String(item.target_url||""),
    link_type:String(item.link_type||""),
    owner_domain:String(item.owner_domain||""),
    access_scope:String(item.access_scope||""),
    source_service:String(item.source_service||""),
    occurrence_count:Number(item.occurrence_count||0),
    updated_at:item.updated_at||null,
    latest_check:item.latest_check?{
      status:String(item.latest_check.status||"not_checked"),
      http_status:Number(item.latest_check.http_status||0),
      access_profile:String(item.latest_check.access_profile||""),
      checked_at:item.latest_check.checked_at||null,
    }:null,
  }));
  return {configured:true,host,checkedAt:new Date().toISOString(),summary,items,error:""};
}

function parsePort(value, label) {
  const port=Number(value);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error(`${label} ist kein gueltiger TCP-Port.`);
  return port;
}

function parseForwardHost(value,label){
  const host=String(value||"").trim(),parts=host.split(".").map(Number);
  const privateIpv4=parts.length===4&&parts.every((part)=>Number.isInteger(part)&&part>=0&&part<=255)
    &&(parts[0]===10||(parts[0]===172&&parts[1]>=16&&parts[1]<=31)||(parts[0]===192&&parts[1]===168));
  if(host!=="127.0.0.1"&&!privateIpv4)throw new Error(`${label} muss Loopback oder eine private IPv4-Adresse sein.`);
  return host;
}

function stagingTunnelDefinition(config=loadStagingConfig()) {
  const host=assertSafeSshTarget(config.GERNETIX_STAGING_SSH||"");
  const adminPort=parsePort(config.GERNETIX_STAGING_LOCAL_ADMIN_PORT||14600,"Lokaler Admin-Port");
  const remoteAdminPort=parsePort(config.GERNETIX_STAGING_REMOTE_ADMIN_PORT||4610,"Remote-Admin-Port");
  const platformPort=parsePort(config.GERNETIX_STAGING_LOCAL_PLATFORM_PORT||14300,"Lokaler Plattform-Port");
  const remotePlatformPort=parsePort(config.GERNETIX_STAGING_REMOTE_PLATFORM_PORT||8080,"Remote-Plattform-Port");
  const identityDbPort=parsePort(config.GERNETIX_STAGING_LOCAL_IDENTITY_DB_PORT||25432,"Lokaler Identity-PostgreSQL-Port");
  const remoteIdentityDbHost=parseForwardHost(config.GERNETIX_STAGING_REMOTE_IDENTITY_DB_HOST||"10.77.0.1","Remote-Identity-PostgreSQL-Host");
  const remoteIdentityDbPort=parsePort(config.GERNETIX_STAGING_REMOTE_IDENTITY_DB_PORT||25432,"Remote-Identity-PostgreSQL-Port");
  const buildRouterPort=parsePort(config.GERNETIX_STAGING_LOCAL_BUILD_ROUTER_PORT||14400,"Lokaler Build-Router-Port");
  const remoteBuildRouterHost=parseForwardHost(config.GERNETIX_STAGING_REMOTE_BUILD_ROUTER_HOST||"127.0.0.1","Remote-Build-Router-Host");
  const remoteBuildRouterPort=parsePort(config.GERNETIX_STAGING_REMOTE_BUILD_ROUTER_PORT||14400,"Remote-Build-Router-Port");
  const forwards=[[platformPort,remotePlatformPort,"127.0.0.1"],[adminPort,remoteAdminPort,"127.0.0.1"],[identityDbPort,remoteIdentityDbPort,remoteIdentityDbHost],[buildRouterPort,remoteBuildRouterPort,remoteBuildRouterHost],...REMOTE_DEV_SERVICE_FORWARDS.map(([local,remote])=>[local,remote,"127.0.0.1"])];
  return {host,adminPort,platformPort,identityDbPort,remoteIdentityDbHost,forwards,args:["-N","-o","BatchMode=yes","-o","ExitOnForwardFailure=yes","-o","ServerAliveInterval=30","-o","ServerAliveCountMax=3",...forwards.flatMap(([local,remote,remoteHost])=>["-L",`127.0.0.1:${local}:${remoteHost}:${remote}`]),host]};
}

async function stagingTunnelState(options={}) {
  const config=options.config||loadStagingConfig();
  if(!config.GERNETIX_STAGING_SSH)return {configured:false,active:false,owned:false,error:"VPS nicht konfiguriert: .env.staging.local fehlt oder enthält kein GERNETIX_STAGING_SSH."};
  let definition;
  try { definition=stagingTunnelDefinition(config); }
  catch(error) { return {configured:false,active:false,owned:false,error:error.message}; }
  const findPid=options.pidForLoopbackPort||options.pidForPort||pidForLoopbackPort;
  const listenerPids=await Promise.all(definition.forwards.map(([localPort])=>findPid(localPort)));
  const distinctPids=new Set(listenerPids.filter(Boolean));
  const owned=Boolean(stagingTunnel&&!stagingTunnel.killed&&stagingTunnel.exitCode===null);
  const active=listenerPids.every(Boolean)&&distinctPids.size===1;
  const mixedListeners=distinctPids.size>1;
  return {configured:true,active,owned,adminPort:definition.adminPort,platformPort:definition.platformPort,identityDbPort:definition.identityDbPort,adminUrl:`http://127.0.0.1:${definition.adminPort}/admin/`,platformUrl:`http://127.0.0.1:${definition.platformPort}/app/dashboard/`,error:stagingTunnelError||(mixedListeners?"Lokale Portkonflikte verhindern einen eindeutigen VPS SSH-Tunnel. Bitte die betroffenen lokalen Dienste zuerst beenden.":(!active&&owned?"SSH-Diagnosetunnel wird aufgebaut.":""))};
}

async function startStagingTunnel(options={}) {
  const config=options.config||loadStagingConfig();
  const definition=stagingTunnelDefinition(config);
  const current=await stagingTunnelState({...options,config});
  if(current.active)return current;
  const vpn=await vpnState(options);
  if(vpn.supported&&vpn.configured&&!vpn.connected)throw new Error("Der GerNetiX-VPN muss vor dem SSH-Diagnosetunnel verbunden sein.");
  const launch=options.spawn||spawn;
  stagingTunnelError="";
  const child=launch("ssh",definition.args,{cwd:workspaceRoot,detached:true,windowsHide:true,stdio:"ignore"});
  stagingTunnel=child;
  child.unref?.();
  child.once("error",(error)=>{stagingTunnelError=`SSH-Diagnosetunnel konnte nicht gestartet werden: ${error.message}`;});
  child.once("exit",(code,signal)=>{if(stagingTunnel===child&&code!==0&&signal!=="SIGTERM")stagingTunnelError=`SSH-Diagnosetunnel wurde beendet (${code===null?signal:`Exit-Code ${code}`}).`;});
  const wait=options.delay||delay;
  const attempts=options.maxAttempts||32;
  for(let index=0;index<attempts;index+=1){
    const state=await stagingTunnelState({...options,config});
    if(state.active)return state;
    if(child.exitCode!==null)break;
    await wait(250);
  }
  if(child.exitCode!==null&&child.exitCode!==0)throw new Error(stagingTunnelError||"SSH-Diagnosetunnel konnte nicht aufgebaut werden.");
  throw new Error("SSH-Diagnosetunnel wurde nicht rechtzeitig aufgebaut.");
}

async function stopStagingTunnel(options={}) {
  const current=await stagingTunnelState(options);
  if(!current.active)return current;
  if(!stagingTunnel||stagingTunnel.killed||stagingTunnel.exitCode!==null)throw new Error("Der aktive SSH-Diagnosetunnel wurde nicht vom Prozess-Monitor gestartet und wird deshalb nicht beendet.");
  stagingTunnelError="";
  stagingTunnel.kill("SIGTERM");
  const wait=options.delay||delay;
  const attempts=options.maxAttempts||20;
  for(let index=0;index<attempts;index+=1){
    const state=await stagingTunnelState(options);
    if(!state.active)return state;
    await wait(150);
  }
  throw new Error("SSH-Diagnosetunnel wurde nicht rechtzeitig beendet.");
}
function parseSecurityCheckOutput(output) {
  const checks = {};
  for (const line of String(output || "").split(/\r?\n/)) {
    const match = line.trim().match(/^([a-z0-9_]+)=(active|missing)$/);
    if (match) checks[match[1]] = match[2];
  }
  return checks;
}

function localSecurityReadiness() {
  const read = (relativePath) => {
    try { return fs.readFileSync(path.join(workspaceRoot, relativePath), "utf8"); } catch { return ""; }
  };
  const nginx = `${read("infra/vps/nginx/default.conf")}\n${read("infra/vps/nginx/tls.conf")}`;
  const mqtt = read("infra/vps/mosquitto/mosquitto.conf");
  const firewall = read("infra/vps/security/firewall.nft");
  return {
    firewall:firewall.includes('policy drop') && firewall.includes('iifname "wg0" tcp dport 22 accept'),
    web:nginx.includes("zone=gernetix_web_per_ip:10m rate=10r/s"),
    auth:nginx.includes("zone=gernetix_auth_per_ip:10m rate=5r/m"),
    build:nginx.includes("zone=gernetix_build_per_ip:10m rate=30r/s"),
    mqttTls:mqtt.includes("allow_anonymous false") && mqtt.includes("require_certificate true") && mqtt.includes("use_identity_as_username true") && mqtt.includes("acl_file"),
    mqttRate:firewall.includes("meter mqtt_tls_ipv4") && firewall.includes("meter mqtt_tls_ipv6"),
    mqttResources:mqtt.includes("max_connections 2048") && mqtt.includes("max_packet_size 131072")
  };
}

function securityRule(id, name, category, location, expected, check, localReady, recommendation) {
  return { id, name, category, location, expected, check, localReady:Boolean(localReady), recommendation };
}

function securityRuleDefinitions(ready) {
  return [
    securityRule("firewall", "Host-Firewall mit Default-Drop", "Netzwerk", "VPS / nftables", "Eingehend standardmaessig sperren; nur HTTP, HTTPS, MQTT-TLS und WireGuard freigeben.", "firewall_protection", ready.firewall, "Firewall bei jedem Deployment validieren und aktiv lassen."),
    securityRule("ssh-vpn", "SSH nur ueber WireGuard", "Zugang", "VPS / nftables + WireGuard", "Port 22 darf nur am Interface wg0 angenommen werden.", "ssh_wireguard_only", ready.firewall, "VPN-Notfallzugang getrennt testen und oeffentlichen SSH-Fallback gesperrt lassen."),
    securityRule("ssh-password", "SSH ohne Passwortanmeldung", "Zugang", "VPS / OpenSSH", "Nur hinterlegte Public Keys; Passwortanmeldung deaktiviert.", "ssh_password_disabled", false, "SSH-Konfiguration nach Updates erneut pruefen."),
    securityRule("fail2ban", "Fail2ban fuer SSH", "Angriffsschutz", "VPS / Fail2ban", "5 Versuche in 10 Minuten; Sperre fuer 1 Stunde.", "fail2ban_sshd", false, "Ban-Ereignisse zentral melden und Jail aktiv lassen."),
    securityRule("web-rate", "Web-Rate-Limit", "Angriffsschutz", "VPS / Nginx", "10 Anfragen pro Sekunde und IP, Burst 40; Ablehnung mit HTTP 429.", "web_rate_limit", ready.web, "Nach Aktivierung legitime Browseraufrufe und 429-Rate beobachten."),
    securityRule("auth-rate", "Login- und Registrierungs-Limit", "Angriffsschutz", "VPS / Nginx", "5 Versuche pro Minute und IP, Burst 5.", "auth_rate_limit", ready.auth, "Nach Aktivierung Fehlanmeldungen und verteilte Angriffe beobachten."),
    securityRule("build-rate", "Build-Download-Limit", "Angriffsschutz", "VPS / Nginx", "30 Anfragen pro Sekunde und IP, Burst 100 fuer gemeinsam genutzte NAT-Ausgaenge.", "build_rate_limit", ready.build, "Bei groesseren Device-Flotten die Grenze anhand realer OTA-Last pruefen."),
    securityRule("mqtt-tls", "MQTT nur mit mTLS und ACL", "Device-Sicherheit", "VPS / Mosquitto :8883", "Keine anonymen Devices; Client-Zertifikat und Zertifikats-CN begrenzen jedes Device auf seine Topics.", "mqtt_tls_auth", ready.mqttTls, "Device-Zertifikate bei Verdacht widerrufen beziehungsweise erneuern und ACL-Fehler alarmieren."),
    securityRule("mqtt-rate", "MQTT-Verbindungsrate", "Angriffsschutz", "VPS / nftables Forward", "60 neue TLS-Verbindungen pro Minute und Quell-IP, Burst 30, getrennt fuer IPv4 und IPv6.", "mqtt_connection_rate", ready.mqttRate, "Nach Aktivierung Drops messen und bei legitimen NAT-Flotten vorsichtig nachjustieren."),
    securityRule("mqtt-resources", "MQTT-Ressourcengrenzen", "Device-Sicherheit", "VPS / Mosquitto", "Maximal 2048 Verbindungen, 128 KiB Pakete und begrenzte Warteschlangen.", "mqtt_resource_limits", ready.mqttResources, "Broker-Auslastung und abgewiesene Pakete ueberwachen."),
    securityRule("admin-loopback", "Admin Tool nur auf Loopback", "Service-Isolation", "VPS / Docker", "Port 4600 nur auf 127.0.0.1; Zugriff ueber VPN-SSH-Tunnel.", "admin_loopback", false, "Keine oeffentliche Portfreigabe fuer das Admin Tool hinzufuegen."),
    securityRule("private-services", "Domaenendienste nicht oeffentlich", "Service-Isolation", "VPS / Docker-Netze", "Alle internen App- und Routing-Ports von 4300 bis 5800 sowie 14400 duerfen nicht an 0.0.0.0 oder [::] lauschen.", "services_private", false, "Compose-Portfreigaben bei jeder Architektur-Aenderung pruefen."),
    securityRule("root-login", "Direkten Root-Login abschalten", "Offene Haertung", "VPS / OpenSSH", "Administration ausschliesslich als sven mit sudo.", "root_login_disabled", false, "sven/sudo in einer zweiten Sitzung testen und danach PermitRootLogin no setzen."),
    securityRule("backups", "Externe verschluesselte Backups", "Offene Haertung", "Getrenntes Backup-Ziel", "Fuehrende SQL-Datenbanken ausserhalb des VPS sichern und Restore testen.", "", false, "Backup-Ziel, Zeitplan, RPO/RTO und automatisierten Restore-Test einrichten."),
    securityRule("alerting", "Zentrale Sicherheitsalarmierung", "Offene Haertung", "Admin Tool / Betriebsmonitor", "Bans, ungewoehnliche Logins, Container- und Backupfehler aktiv melden.", "", false, "Alarmkanal mit Testereignis und nachvollziehbarer Quittierung einrichten."),
    securityRule("log-retention", "Definierte Log-Aufbewahrung", "Offene Haertung", "VPS / externer Logspeicher", "SSH-, Nginx-, MQTT-, Audit- und Containerlogs vor Rotation sichern.", "", false, "Aufbewahrungsdauer, Speicherziel und Zugriffsschutz festlegen.")
  ];
}

function presentSecurityRules(definitions, checks, reachable) {
  const labels = { active:"Aktiv", pending:"Vorbereitet", open:"Offen", unverified:"Nicht geprueft" };
  const items = definitions.map((rule) => {
    let status = "open";
    if (rule.check && checks[rule.check] === "active") status = "active";
    else if (rule.check && !reachable) status = "unverified";
    else if (rule.check && rule.localReady) status = "pending";
    return { ...rule, status, statusLabel:labels[status] };
  });
  return { items, summary:{ total:items.length, active:items.filter((item)=>item.status==="active").length, pending:items.filter((item)=>item.status==="pending").length, open:items.filter((item)=>item.status==="open").length, unverified:items.filter((item)=>item.status==="unverified").length } };
}

async function securityRuleStates(options={}) {
  if (!options.force && !options.execFileAsync && securityCache?.expiresAt > Date.now()) return securityCache.value;
  const config = options.config || loadStagingConfig();
  const definitions = securityRuleDefinitions(localSecurityReadiness());
  if (!config.GERNETIX_STAGING_SSH) {
    return { configured:false, ...presentSecurityRules(definitions, {}, false), error:"VPS-Sicherheitsstatus nicht konfiguriert: GERNETIX_STAGING_SSH fehlt." };
  }
  const host = monitorSshTarget(config);
  const run = options.execFileAsync || execFileAsync;
  let value;
  try {
    const { stdout } = await run("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=5", host, "sudo -n /usr/local/sbin/gernetix-monitor-diagnostic security"], { windowsHide:true, timeout:15000, maxBuffer:1024*1024 });
    value = { configured:true, host, checkedAt:new Date().toISOString(), ...presentSecurityRules(definitions, parseSecurityCheckOutput(stdout), true), error:"" };
  } catch (error) {
    value = { configured:true, host, ...presentSecurityRules(definitions, {}, false), error:remoteError(error) };
  }
  if (!options.execFileAsync) securityCache = { expiresAt:Date.now()+SECURITY_CACHE_MS, value };
  return value;
}

function serviceLogPath(id){return path.join(workspaceRoot,".runtime","process-logs",`${id}.log`);}
function recentServiceLog(id){try{return fs.readFileSync(serviceLogPath(id),"utf8").trim().split(/\r?\n/).slice(-8).join(" ").slice(-1600);}catch{return "";}}
function serviceNodeExecutable(runtime=process){
  const configured=String(runtime.env?.GERNETIX_NODE_COMMAND||"").trim();
  if(configured)return configured;
  return runtime.execPath;
}
function launchLoggedService(item, env){
  fs.mkdirSync(path.dirname(serviceLogPath(item.id)),{recursive:true});
  const output=fs.openSync(serviceLogPath(item.id),"a");
  try{
    const child=spawn(serviceNodeExecutable(),["src/dev-server.js"],{cwd:item.cwd,detached:true,windowsHide:true,env,stdio:["ignore",output,output]});
    child.once("error",(error)=>{child.gernetixSpawnError=error;});
    return child;
  }
  finally{fs.closeSync(output);}
}
function remoteIdentityEnvironment(){
  const remoteStarter=path.join(workspaceRoot,"tools","start-identity-remote-dev.js");
  if(!fs.existsSync(remoteStarter))throw new Error("Der Remote-Dev-Starter tools/start-identity-remote-dev.js fehlt.");
  const {loadRemoteDevConfig}=require(remoteStarter);
  return {...loadRemoteDevConfig(process.env),ELECTRON_RUN_AS_NODE:"1"};
}

function loadBuildWorkerConfig(){
  const envFile=path.join(workspaceRoot,".env.build-worker.local");
  if(!fs.existsSync(envFile))throw new Error("Build-Worker ist noch nicht eingerichtet: .env.build-worker.local fehlt.");
  const config=parseEnvFile(fs.readFileSync(envFile,"utf8"));
  if(!config.BUILD_WORKER_ID||!config.BUILD_WORKER_BIND_ADDRESS)throw new Error("Build-Worker-Konfiguration ist unvollstaendig.");
  return config;
}

async function runBuildWorkerAction(action,options={}){
  const tool=path.join(workspaceRoot,"tools","build-worker.js");
  if(!fs.existsSync(tool))throw new Error("tools/build-worker.js fehlt.");
  const run=options.execFileAsync||execFileAsync;
  const dockerCommand=options.dockerCommand||dockerExecutable(options);
  await run(process.execPath,[tool,action],{cwd:workspaceRoot,windowsHide:true,timeout:action==="start"?900000:120000,maxBuffer:5*1024*1024,env:{...process.env,ELECTRON_RUN_AS_NODE:"1",GERNETIX_DOCKER_COMMAND:dockerCommand}});
}

async function startBuildWorker(options={}){
  const item=byId("build-worker"),checkService=options.checkService||check;
  const dockerCommand=await ensureDockerReady(options);
  const current=await checkService(item);if(current.healthy)return current;
  await runBuildWorkerAction("start",{...options,dockerCommand});
  const wait=options.delay||delay;
  for(let i=0;i<80;i+=1){const state=await checkService(item);if(state.healthy)return state;await wait(500);}
  throw new Error("Lokaler Build-Worker wurde gestartet, meldet aber keinen gesunden Zustand.");
}
async function startIdentityRemoteDev(options={}){
  const item=byId("identity-server");
  const checkService=options.checkService||check;
  const current=await checkService(item);
  if(current.healthy)return current;
  if(current.identityModeMismatch&&current.pid){
    const stop=options.stopService||stopService;
    await stop(item.id);
  }
  const readVpn=options.vpnState||vpnState;
  const vpn=await readVpn(options);
  if(vpn.supported&&!vpn.configured)throw new Error(vpn.error||"Der GerNetiX-VPN ist nicht eingerichtet.");
  if(vpn.supported&&!vpn.connected){
    const connectVpn=options.setVpnConnected||setVpnConnected;
    await connectVpn(true,options);
  }
  let tunnel=await stagingTunnelState(options);
  if(!tunnel.active){
    const connectTunnel=options.startStagingTunnel||startStagingTunnel;
    tunnel=await connectTunnel(options);
  }
  if(!tunnel.active)throw new Error("Identity benötigt den verbundenen VPS SSH-Tunnel einschließlich Identity-PostgreSQL.");
  let env;
  try{env=(options.remoteIdentityEnvironment||remoteIdentityEnvironment)();}catch(error){throw new Error(`Identity Remote-Dev kann nicht starten: ${error.message}`);}
  const launch=options.launchLoggedService||launchLoggedService;
  const child=launch(item,env);
  child.unref?.();
  const wait=options.delay||delay;
  for(let i=0;i<40;i+=1){const state=await checkService(item);if(state.healthy)return state;if(child.exitCode!==null||child.gernetixSpawnError)break;await wait(250);}
  const detail=child.gernetixSpawnError?.message||recentServiceLog(item.id);
  if(child.exitCode===null&&!child.killed)child.kill?.("SIGTERM");
  throw new Error(`Identity Remote-Dev wurde nicht gestartet.${detail?` Letzte Logzeilen: ${detail}`:""}`);
}
async function startService(id,options={}){ const item=byId(id); if(!item.local)throw new Error(`${item.name} läuft auf dem VPS und kann hier nicht lokal gestartet werden.`); if(id==="identity-server")return startIdentityRemoteDev(options);if(id==="build-worker")return startBuildWorker(options); const checkService=options.checkService||check; const current=await checkService(item); if(current.healthy)return current; const child=launchLoggedService(item,{...process.env,...item.environment,ELECTRON_RUN_AS_NODE:"1",PORT:String(item.port)}); child.unref(); for(let i=0;i<40;i+=1){await delay(250);const state=await checkService(item);if(state.healthy)return state;} throw new Error(`${item.name} konnte nicht gestartet werden.${recentServiceLog(item.id)?` Letzte Logzeilen: ${recentServiceLog(item.id)}`:""}`); }
async function startAllServices(options={}){const start=options.startService||startService;const items=[];for(const item of services.filter((entry)=>entry.autoStart)){try{items.push(await start(item.id));}catch(error){items.push({...item,healthy:false,statusCode:0,pid:null,error:error.message});}}return{items,healthy:items.filter((item)=>item.healthy).length,failed:items.filter((item)=>!item.healthy).length};}
async function stopService(id,options={}){ const item=byId(id); if(!item.local)throw new Error(`${item.name} läuft auf dem VPS und kann hier nicht lokal gestoppt werden.`);if(id==="build-worker"){await runBuildWorkerAction("stop",options);return check(item);} const pid=await pidForPort(item.port); if(!pid)return check(item); if(process.platform==="win32")await execFileAsync("taskkill",["/PID",String(pid),"/T","/F"],{windowsHide:true});else process.kill(pid,"SIGTERM"); for(let i=0;i<20;i+=1){await delay(150);const state=await check(item);if(!state.healthy)return state;} throw new Error(`${item.name} konnte nicht beendet werden.`); }
function pidFromWindowsNetstat(output,port,localAddress=""){
  const line=String(output||"").split(/\r?\n/).find((row)=>{
    const columns=row.trim().split(/\s+/);
    return columns[0]?.toUpperCase()==="TCP"
      && columns[1]?.endsWith(`:${port}`)
      && (!localAddress||columns[1]?.startsWith(`${localAddress}:`))
      && columns[2]?.endsWith(":0")
      && Number(columns.at(-1))>0;
  });
  return Number(line?.trim().split(/\s+/).at(-1))||null;
}
async function pidForPort(port){try{if(process.platform==="win32"){const{stdout}=await execFileAsync("netstat",["-ano","-p","tcp"],{windowsHide:true});return pidFromWindowsNetstat(stdout,port);}const{stdout}=await execFileAsync("lsof",["-nP",`-iTCP:${port}`,"-sTCP:LISTEN","-t"]);return Number(stdout.trim().split(/\s+/)[0])||null;}catch{return null;}}
async function pidForLoopbackPort(port){try{if(process.platform==="win32"){const{stdout}=await execFileAsync("netstat",["-ano","-p","tcp"],{windowsHide:true});return pidFromWindowsNetstat(stdout,port,"127.0.0.1");}const{stdout}=await execFileAsync("lsof",["-nP","-a",`-iTCP@127.0.0.1:${port}`,"-sTCP:LISTEN","-t"]);return Number(stdout.trim().split(/\s+/)[0])||null;}catch{return null;}}
function health(url){return new Promise((resolve,reject)=>{const req=http.get(url,(res)=>{let raw="";res.setEncoding("utf8");res.on("data",(chunk)=>{if(raw.length<16384)raw+=chunk;});res.on("end",()=>{let body=null;try{body=raw?JSON.parse(raw):null;}catch{}resolve({statusCode:res.statusCode||0,body});});});req.setTimeout(1200,()=>req.destroy(new Error("Timeout")));req.on("error",reject);});}
function delay(ms){return new Promise((resolve)=>setTimeout(resolve,ms));}
function loadStagingConfig(){const file=path.join(workspaceRoot,".env.staging.local");return {...(fs.existsSync(file)?parseEnvFile(fs.readFileSync(file,"utf8")):{}),...process.env};}
function parseEnvFile(content){const values={};for(const raw of String(content).split(/\r?\n/)){const line=raw.trim();if(!line||line.startsWith("#"))continue;const separator=line.indexOf("=");if(separator<1)throw new Error(`Ungültige Konfigurationszeile: ${raw}`);const key=line.slice(0,separator).trim();let value=line.slice(separator+1).trim();if((value.startsWith('"')&&value.endsWith('"'))||(value.startsWith("'")&&value.endsWith("'")))value=value.slice(1,-1);values[key]=value;}return values;}
function assertSafeSshTarget(value){if(!/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/.test(value))throw new Error("Ungültiges SSH-Ziel in .env.staging.local.");return value;}
function shellQuote(value){return `'${String(value).replace(/'/g, `'"'"'`)}'`;}
function parseComposePs(output){
  const text=String(output||"").trim();if(!text)return [];
  let rows=[];
  try{const parsed=JSON.parse(text);rows=Array.isArray(parsed)?parsed:[parsed];}
  catch{rows=text.split(/\r?\n/).filter(Boolean).map((line)=>JSON.parse(line));}
  return rows.map((row)=>{const state=String(row.State||row.state||"").toLowerCase();const health=String(row.Health||row.health||"").toLowerCase();const id=String(row.Service||row.service||row.Name||row.name||"unknown");return {
    id,
    name:VPS_SERVICE_LABELS[id]||id,
    container:String(row.Name||row.name||""),state:state||"unknown",health:health||"",status:String(row.Status||row.status||""),portLabel:vpsServicePortLabel(String(row.Service||row.service||row.Name||row.name||"unknown")),
    healthy:state==="running"&&(!health||health==="healthy"),scope:"vps"
  };});
}
function remoteErrorDetail(error){return String(error.stderr||error.message||error).trim().split(/\r?\n/).slice(-1)[0];}
function remoteError(error){return `VPS nicht erreichbar: ${remoteErrorDetail(error)}`;}

function parseWindowsServiceState(output) {
  const match = String(output || "").match(/STATE\s*:\s*(\d+)/i);
  return match ? Number(match[1]) : null;
}

function parseMacVpnState(output, serviceName=MACOS_VPN_SERVICE_NAME) {
  const line=String(output||"").split(/\r?\n/).find((entry)=>entry.includes("com.wireguard.macos")&&entry.includes(`\"${serviceName}\"`));
  if(!line)return {configured:false,connected:false,transitional:false,state:"not-installed"};
  const state=String(line.match(/^\*\s+\(([^)]+)\)/)?.[1]||"unknown").toLowerCase();
  return {configured:true,connected:state==="connected",transitional:["connecting","disconnecting"].includes(state),state};
}

async function vpnState(options = {}) {
  const platform = options.platform || process.platform;
  const run = options.execFileAsync || execFileAsync;
  if (platform === "darwin") {
    try {
      const {stdout}=await run("scutil",["--nc","list"],{windowsHide:true,timeout:5000});
      const state=parseMacVpnState(stdout,options.macosServiceName||MACOS_VPN_SERVICE_NAME);
      return {...state,supported:true,serviceName:options.macosServiceName||MACOS_VPN_SERVICE_NAME,error:state.configured?"":"Der GerNetiX-WireGuard-Tunnel ist nicht installiert."};
    } catch(error) {
      const detail=String(error.stderr||error.stdout||error.message||error).trim().split(/\r?\n/).slice(-1)[0];
      return {supported:true,configured:false,connected:false,transitional:false,state:"error",serviceName:options.macosServiceName||MACOS_VPN_SERVICE_NAME,error:`VPN-Status nicht lesbar: ${detail}`};
    }
  }
  if (platform !== "win32") {
    return { supported:false, configured:false, connected:false, transitional:false, state:"unsupported", error:"Die VPN-Steuerung ist derzeit fuer Windows eingerichtet." };
  }
  try {
    const { stdout } = await run("sc.exe", ["query", VPN_SERVICE_NAME], { windowsHide:true, timeout:5000 });
    const code = parseWindowsServiceState(stdout);
    if (code === null) throw new Error("Windows-Dienststatus konnte nicht gelesen werden.");
    const states = { 1:"stopped", 2:"starting", 3:"stopping", 4:"running", 5:"continuing", 6:"pausing", 7:"paused" };
    return {
      supported:true,
      configured:true,
      connected:code === 4,
      transitional:[2, 3, 5, 6].includes(code),
      state:states[code] || "unknown",
      serviceName:VPN_SERVICE_NAME,
      error:""
    };
  } catch (error) {
    const detail = String(error.stderr || error.stdout || error.message || error);
    const missing = /1060|does not exist|existiert nicht|nicht installiert/i.test(detail);
    return {
      supported:true,
      configured:!missing,
      connected:false,
      transitional:false,
      state:missing ? "not-installed" : "error",
      serviceName:VPN_SERVICE_NAME,
      error:missing ? "Der GerNetiX-WireGuard-Tunnel ist nicht installiert." : `VPN-Status nicht lesbar: ${detail.trim().split(/\r?\n/).slice(-1)[0]}`
    };
  }
}

async function setVpnConnected(connected, options = {}) {
  const desired = Boolean(connected);
  const platform = options.platform || process.platform;
  const current = await vpnState(options);
  if (!current.configured) throw new Error(current.error || "Der GerNetiX-VPN-Tunnel ist nicht eingerichtet.");
  if (current.connected === desired && !current.transitional) return current;
  const run = options.execFileAsync || execFileAsync;
  const action = desired ? "start" : "stop";
  if(platform==="darwin") {
    try {
      await run("scutil",["--nc",action,options.macosServiceName||MACOS_VPN_SERVICE_NAME],{windowsHide:true,timeout:10000});
    } catch(error) {
      const detail=String(error.stderr||error.stdout||error.message||error).trim().split(/\r?\n/).slice(-1)[0];
      throw new Error(`VPN konnte nicht ${desired?"verbunden":"getrennt"} werden: ${detail}`);
    }
  } else if(platform==="win32") {
    try {
      await run("sc.exe", [action, VPN_SERVICE_NAME], { windowsHide:true, timeout:10000 });
    } catch (error) {
      const detail = String(error.stderr || error.stdout || error.message || error);
      if (!/access is denied|zugriff verweigert|\b5\b/i.test(`${error.code || ""} ${detail}`)) {
        throw new Error(`VPN konnte nicht ${desired ? "verbunden" : "getrennt"} werden: ${detail.trim().split(/\r?\n/).slice(-1)[0]}`);
      }
      const command = `$process = Start-Process -FilePath 'sc.exe' -ArgumentList @('${action}', '${VPN_SERVICE_NAME}') -Verb RunAs -Wait -PassThru; exit $process.ExitCode`;
      try {
        await run("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { windowsHide:true, timeout:60000 });
      } catch {
        throw new Error("Die VPN-Aktion wurde im Windows-Sicherheitsdialog nicht bestaetigt.");
      }
    }
  } else throw new Error("Die VPN-Steuerung wird auf diesem Betriebssystem nicht unterstuetzt.");
  const wait = options.delay || delay;
  const attempts = options.maxAttempts || 24;
  for (let index = 0; index < attempts; index += 1) {
    const state = await vpnState(options);
    if (state.connected === desired && !state.transitional) return state;
    await wait(250);
  }
  throw new Error(`Der VPN-Tunnel wurde nicht rechtzeitig ${desired ? "verbunden" : "getrennt"}.`);
}

module.exports={applyAccountDatabaseState,completeVpsServiceStates,configureWorkspace,dockerBuildWorkerHealth,dockerDaemonReady,dockerExecutable,ensureDockerReady,interfaceStatistics,loadBuildWorkerConfig,operationsAlerts,parseComposePs,parseMacVpnState,parseSecurityCheckOutput,parseWindowsServiceState,pidForLoopbackPort,pidFromWindowsNetstat,presentLinkIntegrity,processStates,remoteAccountDatabaseState,remoteIdentityEnvironment,remoteInterfaceStatistics,remoteLinkIntegrity,remoteProcessStates,remoteUserActionAlerts,runBuildWorkerAction,securityRuleStates,serviceNodeExecutable,services,stagingTunnelDefinition,stagingTunnelState,startBuildWorker,startIdentityRemoteDev,startRemoteAccountDatabase,startStagingTunnel,stopStagingTunnel,setVpnConnected,startAllServices,startService,stopService,vpnState};
