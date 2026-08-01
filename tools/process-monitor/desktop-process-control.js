const http = require("node:http");
const path = require("node:path");
const { execFile, spawn } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");

const execFileAsync = promisify(execFile);
const VPN_SERVICE_NAME = "WireGuardTunnel$gernetix-vps";
const MACOS_VPN_SERVICE_NAME = "gernetix-vps-mac";
const REMOTE_DEV_SERVICE_FORWARDS = [[4400,4400],[4700,4700],[4800,4800],[4900,4900],[5001,5000],[5200,5200],[5500,5500],[5600,5600]];
const SECURITY_CACHE_MS = 60000;
let workspaceRoot = process.env.GERNETIX_WORKSPACE || path.resolve(__dirname, "../..");
let securityCache = null;
let linkIntegrityCache = null;
let stagingTunnel = null;
let stagingTunnelError = "";
const services = [
  service("project-server", "Project Server", 4800), service("build-deploy-server", "Build & Deploy Server", 4400),
  service("device-management-server", "Device Management Server", 4700), service("hardware-catalog", "Hardware Catalog", 4910, {PERSISTENCE_BACKEND:"memory"}),
  service("hardware-shop", "Hardware Shop", 4900, {PERSISTENCE_BACKEND:"memory"}), service("ai-usage-server", "AI Usage Server", 5000, {PERSISTENCE_BACKEND:"memory"}),
  service("ai-context-server", "AI Context Server", 5500), service("admin-tool", "Admin Tool", 4600, {PERSISTENCE_BACKEND:"memory"}),
  service("community-platform", "Community Platform", 5200),
  service("identity-server", "Identity Server", 4300, {}, {local:true}),
  service("admin-access-server", "Admin Access Server", 4610, {}, {autoStart:false}),
  service("telemetry-server", "Telemetry Server", 5600, {}, {autoStart:false}),
  service("public-demo-server", "Öffentlicher Demo-Katalog", 4920, {}, {autoStart:false}),
  service("community-ai-assistant", "Community AI Assistant", 5300, {}, {autoStart:false}),
  service("persistence-server", "Persistence Server", 5400, {}, {autoStart:false}),
  service("provisioning-tool", "Provisioning Tool Server", 4500, {}, {autoStart:false}),
  service("recovery-tool", "Recovery Tool Server", 5100, {}, {autoStart:false})
];

function service(id, name, port, environment={}, options={}) { const local=options.local===true; return { id, name, port, cwd:path.join(workspaceRoot,"services",id), healthUrl:`http://127.0.0.1:${port}/health`, environment, local, autoStart:local&&options.autoStart!==false }; }
function configureWorkspace(root) { workspaceRoot=path.resolve(root); for(const item of services)item.cwd=path.join(workspaceRoot,"services",item.id); }
function byId(id) { const item=services.find((entry)=>entry.id===id); if(!item) throw new Error("Unbekannter GerNetiX-Dienst."); return item; }
function isIdentityRemoteDevHealth(body){return body?.service==="identity-server"&&body?.persistence_backend==="postgres"&&body?.remote_dev===true;}
async function check(item) {
  const communityStorage=item.id==="community-platform"?communityStorageSummary():null;
  try {
    const response=await health(item.healthUrl),statusCode=response.statusCode,pid=await pidForPort(item.port);
    const statusHealthy=statusCode>=200&&statusCode<300;
    const identityModeMismatch=item.id==="identity-server"&&statusHealthy&&!isIdentityRemoteDevHealth(response.body);
    return {...item,healthy:statusHealthy&&!identityModeMismatch,statusCode,pid,
      persistenceBackend:response.body?.persistence_backend||"",remoteDev:response.body?.remote_dev===true,
      identityModeMismatch,error:identityModeMismatch?"Falscher Identity-Modus: Port 4300 verwendet nicht Remote-Dev mit PostgreSQL.":"",
      ...(communityStorage?{communityStorage}:{})};
  }
  catch(error){ return {...item,healthy:false,statusCode:0,pid:await pidForPort(item.port),error:error.message,...(communityStorage?{communityStorage}:{})}; }
}
async function processStates(){ return Promise.all(services.filter((item)=>item.local).map(check)); }
function communityStorageSummary(root=workspaceRoot){
  const dbPath=path.join(root,".runtime","gernetix-community.sqlite");
  const visiblePath=path.relative(root,dbPath)||path.basename(dbPath);
  if(!fs.existsSync(dbPath))return {exists:false,path:visiblePath,bytes:0,questions:{total:0,public:0,private:0,open:0},answers:{total:0,verified:0},knowledgeDocuments:{total:0}};
  let db;
  try{
    db=new DatabaseSync(dbPath,{readOnly:true});
    const tables=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row)=>row.name));
    const count=(table,where="")=>tables.has(table)?Number(db.prepare(`SELECT COUNT(*) AS count FROM ${table}${where}`).get().count):0;
    return {
      exists:true,path:visiblePath,bytes:fs.statSync(dbPath).size,
      questions:{
        total:count("community_questions"),
        public:count("community_questions"," WHERE visibility = 'public'"),
        private:count("community_questions"," WHERE visibility = 'private'"),
        open:count("community_questions"," WHERE status = 'open'")
      },
      answers:{
        total:count("community_answers"),
        verified:count("community_answers"," WHERE verification_state = 'verified'")
      },
      knowledgeDocuments:{total:count("community_knowledge_documents")}
    };
  }catch(error){return {exists:true,path:visiblePath,bytes:fs.statSync(dbPath).size,error:error.message};}
  finally{try{db?.close();}catch{}}
}
function interfaceStatistics(hours=24){
  const dbPath=path.join(workspaceRoot,".runtime","gernetix-services.sqlite");
  if(!fs.existsSync(dbPath))return {hours,items:[],summary:{calls:0,failed:0,targets:0}};
  let db;
  try{
    db=new DatabaseSync(dbPath,{readOnly:true});
    const table=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='gernetix_external_interface_calls'").get();
    if(!table)return {hours,items:[],summary:{calls:0,failed:0,targets:0}};
    const since=new Date(Date.now()-Math.max(1,Number(hours)||24)*3600000).toISOString();
    const items=db.prepare(`SELECT source_service, target_service, COUNT(*) AS calls,
      SUM(CASE WHEN succeeded = 0 THEN 1 ELSE 0 END) AS failed,
      ROUND(AVG(duration_ms)) AS average_ms, MAX(duration_ms) AS maximum_ms, MAX(occurred_at) AS last_call
      FROM gernetix_external_interface_calls WHERE occurred_at >= ?
      GROUP BY source_service, target_service ORDER BY calls DESC, target_service`).all(since);
    return {hours,items,summary:{calls:items.reduce((sum,item)=>sum+Number(item.calls),0),failed:items.reduce((sum,item)=>sum+Number(item.failed),0),targets:items.length}};
  }catch(error){return {hours,items:[],summary:{calls:0,failed:0,targets:0},error:error.message};}
  finally{try{db?.close();}catch{}}
}
function runtimeAlerts(hours=24,limit=20){
  const dbPath=path.join(workspaceRoot,".runtime","gernetix-services.sqlite");
  if(!fs.existsSync(dbPath))return {hours,items:[],summary:{total:0,errors:0,warnings:0}};
  let db;
  try{
    db=new DatabaseSync(dbPath,{readOnly:true});
    const tableNames=new Set(db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row)=>row.name));
    const since=new Date(Date.now()-Math.max(1,Number(hours)||24)*3600000).toISOString();
    const maxItems=Math.max(1,Math.min(100,Number(limit)||20));
    const items=[];
    if(tableNames.has("admin_tool_system_events")){
      items.push(...db.prepare(`SELECT occurred_at,severity,source_service,target_service,message,route,event_type
        FROM admin_tool_system_events WHERE occurred_at >= ? AND severity IN ('warning','error','critical')
        ORDER BY occurred_at DESC LIMIT ?`).all(since,maxItems).map((item)=>({...item,kind:"system_event"})));
    }
    const represented=new Set(items.map((item)=>alertKey(item.target_service,item.route)));
    if(tableNames.has("gernetix_external_interface_calls")){
      const failedCalls=db.prepare(`SELECT occurred_at,source_service,target_service,route,status_code
        FROM gernetix_external_interface_calls WHERE occurred_at >= ? AND succeeded = 0
        ORDER BY occurred_at DESC LIMIT ?`).all(since,maxItems);
      for(const call of failedCalls){
        const key=alertKey(call.target_service,call.route);
        if(represented.has(key))continue;
        represented.add(key);
        items.push({...call,severity:"error",event_type:"interface_call_failed",kind:"interface_call",message:call.status_code?`Schnittstellenaufruf mit HTTP ${call.status_code} fehlgeschlagen.`:"Zielservice ist nicht erreichbar."});
      }
    }
    items.sort((left,right)=>String(right.occurred_at).localeCompare(String(left.occurred_at)));
    const selected=items.slice(0,maxItems);
    return {hours,items:selected,summary:{total:selected.length,errors:selected.filter((item)=>["error","critical"].includes(item.severity)).length,warnings:selected.filter((item)=>item.severity==="warning").length}};
  }catch(error){return {hours,items:[],summary:{total:0,errors:0,warnings:0},error:error.message};}
  finally{try{db?.close();}catch{}}
}
function alertKey(targetService,route){return `${String(targetService||"").replace(/-/g,"_")}|${String(route||"")}`;}
async function remoteProcessStates(options={}) {
  const config=options.config||loadStagingConfig();
  if(!config.GERNETIX_STAGING_SSH)return {configured:false,items:[],error:"VPS nicht konfiguriert: .env.staging.local fehlt oder enthält kein GERNETIX_STAGING_SSH."};
  const host=assertSafeSshTarget(config.GERNETIX_STAGING_SSH);
  const remoteDir=String(config.GERNETIX_STAGING_DIR||"/opt/gernetix");
  if(!remoteDir.startsWith("/")||/[\r\n]/.test(remoteDir))throw new Error("Ungültiges GERNETIX_STAGING_DIR.");
  const run=options.execFileAsync||execFileAsync;
  const command=`cd ${shellQuote(remoteDir)} && docker compose --env-file .env.vps -f compose.vps.yaml ps --format json`;
  try {
    const {stdout}=await run("ssh",["-o","BatchMode=yes","-o","ConnectTimeout=5",host,command],{windowsHide:true,timeout:12000,maxBuffer:2*1024*1024});
    return {configured:true,host,items:parseComposePs(stdout).filter(isVisibleVpsService),error:""};
  } catch(error) {
    return {configured:true,host,items:[],error:remoteError(error)};
  }
}

function isVisibleVpsService(item) {
  return !item.id.endsWith("-migration");
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
  const host=assertSafeSshTarget(config.GERNETIX_STAGING_SSH);
  const remoteDir=String(config.GERNETIX_STAGING_DIR||"/opt/gernetix");
  if(!remoteDir.startsWith("/")||/[\r\n]/.test(remoteDir))throw new Error("Ungültiges GERNETIX_STAGING_DIR.");
  const run=options.execFileAsync||execFileAsync;
  const command=`cd ${shellQuote(remoteDir)} && docker compose --env-file .env.vps -f compose.vps.yaml exec -T admin-tool node /app/services/admin-tool/scripts/read-link-integrity.js`;
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

function stagingTunnelDefinition(config=loadStagingConfig()) {
  const host=assertSafeSshTarget(config.GERNETIX_STAGING_SSH||"");
  const adminPort=parsePort(config.GERNETIX_STAGING_LOCAL_ADMIN_PORT||14600,"Lokaler Admin-Port");
  const remoteAdminPort=parsePort(config.GERNETIX_STAGING_REMOTE_ADMIN_PORT||4610,"Remote-Admin-Port");
  const platformPort=parsePort(config.GERNETIX_STAGING_LOCAL_PLATFORM_PORT||14300,"Lokaler Plattform-Port");
  const remotePlatformPort=parsePort(config.GERNETIX_STAGING_REMOTE_PLATFORM_PORT||8080,"Remote-Plattform-Port");
  const identityDbPort=parsePort(config.GERNETIX_STAGING_LOCAL_IDENTITY_DB_PORT||25432,"Lokaler Identity-PostgreSQL-Port");
  const remoteIdentityDbPort=parsePort(config.GERNETIX_STAGING_REMOTE_IDENTITY_DB_PORT||25432,"Remote-Identity-PostgreSQL-Port");
  const forwards=[[platformPort,remotePlatformPort],[adminPort,remoteAdminPort],[identityDbPort,remoteIdentityDbPort],...REMOTE_DEV_SERVICE_FORWARDS];
  return {host,adminPort,platformPort,identityDbPort,forwards,args:["-N","-o","BatchMode=yes","-o","ExitOnForwardFailure=yes","-o","ServerAliveInterval=30","-o","ServerAliveCountMax=3",...forwards.flatMap(([local,remote])=>["-L",`127.0.0.1:${local}:127.0.0.1:${remote}`]),host]};
}

async function stagingTunnelState(options={}) {
  const config=options.config||loadStagingConfig();
  if(!config.GERNETIX_STAGING_SSH)return {configured:false,active:false,owned:false,error:"VPS nicht konfiguriert: .env.staging.local fehlt oder enthält kein GERNETIX_STAGING_SSH."};
  let definition;
  try { definition=stagingTunnelDefinition(config); }
  catch(error) { return {configured:false,active:false,owned:false,error:error.message}; }
  const findPid=options.pidForPort||pidForPort;
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
  const child=launch("ssh",definition.args,{cwd:workspaceRoot,windowsHide:true,stdio:"ignore"});
  stagingTunnel=child;
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
const SECURITY_CHECK_SCRIPT = `
emit() {
  key="$1"
  command="$2"
  if sh -c "$command"; then printf '%s=active\\n' "$key"; else printf '%s=missing\\n' "$key"; fi
}
emit firewall_protection 'systemctl is-active --quiet gernetix-firewall.service && nft list chain inet gernetix_host input 2>/dev/null | grep -q "policy drop"'
emit ssh_wireguard_only 'nft list chain inet gernetix_host input 2>/dev/null | grep -q "iifname \\"wg0\\" tcp dport 22 accept"'
emit ssh_password_disabled 'sshd -T 2>/dev/null | grep -q "^passwordauthentication no$"'
emit fail2ban_sshd 'systemctl is-active --quiet fail2ban.service && fail2ban-client status sshd >/dev/null 2>&1'
emit web_rate_limit 'docker exec gernetix-nginx-tls-1 nginx -T 2>/dev/null | grep -q "zone=gernetix_web_per_ip:10m rate=10r/s"'
emit auth_rate_limit 'docker exec gernetix-nginx-tls-1 nginx -T 2>/dev/null | grep -q "zone=gernetix_auth_per_ip:10m rate=5r/m"'
emit build_rate_limit 'docker exec gernetix-nginx-tls-1 nginx -T 2>/dev/null | grep -q "zone=gernetix_build_per_ip:10m rate=30r/s"'
emit mqtt_tls_auth 'docker exec gernetix-mqtt-broker-1 grep -q "allow_anonymous false" /mosquitto/config/mosquitto.conf && docker exec gernetix-mqtt-broker-1 grep -q "^require_certificate true" /mosquitto/config/mosquitto.conf && docker exec gernetix-mqtt-broker-1 grep -q "^use_identity_as_username true" /mosquitto/config/mosquitto.conf && docker exec gernetix-mqtt-broker-1 grep -q "^acl_file " /mosquitto/config/mosquitto.conf'
emit mqtt_connection_rate 'nft list table inet gernetix_host 2>/dev/null | grep -q "meter mqtt_tls_ipv4" && nft list table inet gernetix_host 2>/dev/null | grep -q "meter mqtt_tls_ipv6"'
emit mqtt_resource_limits 'docker exec gernetix-mqtt-broker-1 grep -q "max_connections 2048" /mosquitto/config/mosquitto.conf && docker exec gernetix-mqtt-broker-1 grep -q "max_packet_size 131072" /mosquitto/config/mosquitto.conf'
emit admin_loopback 'ss -lnt 2>/dev/null | grep -q "127.0.0.1:4600"'
emit services_private '! ss -lnt 2>/dev/null | grep -Eq "(0.0.0.0|\\[::\\]):(4300|4400|4700|4800|4900|4910|5000|5500)"'
emit root_login_disabled 'sshd -T 2>/dev/null | grep -q "^permitrootlogin no$"'
`.trim();

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
    securityRule("private-services", "Domaenendienste nicht oeffentlich", "Service-Isolation", "VPS / Docker-Netze", "Interne Ports 4300 bis 5500 nicht am oeffentlichen Host veroeffentlichen.", "services_private", false, "Compose-Portfreigaben bei jeder Architektur-Aenderung pruefen."),
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
  const host = assertSafeSshTarget(config.GERNETIX_STAGING_SSH);
  const run = options.execFileAsync || execFileAsync;
  let value;
  try {
    const { stdout } = await run("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=5", host, SECURITY_CHECK_SCRIPT], { windowsHide:true, timeout:15000, maxBuffer:1024*1024 });
    value = { configured:true, host, checkedAt:new Date().toISOString(), ...presentSecurityRules(definitions, parseSecurityCheckOutput(stdout), true), error:"" };
  } catch (error) {
    value = { configured:true, host, ...presentSecurityRules(definitions, {}, false), error:remoteError(error) };
  }
  if (!options.execFileAsync) securityCache = { expiresAt:Date.now()+SECURITY_CACHE_MS, value };
  return value;
}

function serviceLogPath(id){return path.join(workspaceRoot,".runtime","process-logs",`${id}.log`);}
function recentServiceLog(id){try{return fs.readFileSync(serviceLogPath(id),"utf8").trim().split(/\r?\n/).slice(-8).join(" ").slice(-1600);}catch{return "";}}
function launchLoggedService(item, env){
  fs.mkdirSync(path.dirname(serviceLogPath(item.id)),{recursive:true});
  const output=fs.openSync(serviceLogPath(item.id),"a");
  try{return spawn(process.execPath,["src/dev-server.js"],{cwd:item.cwd,detached:true,windowsHide:true,env,stdio:["ignore",output,output]});}
  finally{fs.closeSync(output);}
}
function remoteIdentityEnvironment(){
  const remoteStarter=path.join(workspaceRoot,"tools","start-identity-remote-dev.js");
  if(!fs.existsSync(remoteStarter))throw new Error("Der Remote-Dev-Starter tools/start-identity-remote-dev.js fehlt.");
  const {loadRemoteDevConfig}=require(remoteStarter);
  return {...loadRemoteDevConfig(process.env),ELECTRON_RUN_AS_NODE:"1"};
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
  let tunnel=await stagingTunnelState(options);
  if(!tunnel.active){
    const readVpn=options.vpnState||vpnState;
    const vpn=await readVpn(options);
    if(vpn.supported&&!vpn.configured)throw new Error(vpn.error||"Der GerNetiX-VPN ist nicht eingerichtet.");
    if(vpn.supported&&!vpn.connected){
      const connectVpn=options.setVpnConnected||setVpnConnected;
      await connectVpn(true,options);
    }
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
  for(let i=0;i<40;i+=1){const state=await checkService(item);if(state.healthy)return state;if(child.exitCode!==null)break;await wait(250);}
  const detail=recentServiceLog(item.id);
  if(child.exitCode===null&&!child.killed)child.kill?.("SIGTERM");
  throw new Error(`Identity Remote-Dev wurde nicht gestartet.${detail?` Letzte Logzeilen: ${detail}`:""}`);
}
async function startService(id,options={}){ const item=byId(id); if(!item.local)throw new Error(`${item.name} läuft auf dem VPS und kann hier nicht lokal gestartet werden.`); if(id==="identity-server")return startIdentityRemoteDev(options); const checkService=options.checkService||check; const current=await checkService(item); if(current.healthy)return current; const child=launchLoggedService(item,{...process.env,...item.environment,ELECTRON_RUN_AS_NODE:"1",PORT:String(item.port)}); child.unref(); for(let i=0;i<40;i+=1){await delay(250);const state=await checkService(item);if(state.healthy)return state;} throw new Error(`${item.name} konnte nicht gestartet werden.${recentServiceLog(item.id)?` Letzte Logzeilen: ${recentServiceLog(item.id)}`:""}`); }
async function startAllServices(options={}){const start=options.startService||startService;const items=[];for(const item of services.filter((entry)=>entry.autoStart)){try{items.push(await start(item.id));}catch(error){items.push({...item,healthy:false,statusCode:0,pid:null,error:error.message});}}return{items,healthy:items.filter((item)=>item.healthy).length,failed:items.filter((item)=>!item.healthy).length};}
async function stopService(id){ const item=byId(id); if(!item.local)throw new Error(`${item.name} läuft auf dem VPS und kann hier nicht lokal gestoppt werden.`); const pid=await pidForPort(item.port); if(!pid)return check(item); if(process.platform==="win32")await execFileAsync("taskkill",["/PID",String(pid),"/T","/F"],{windowsHide:true});else process.kill(pid,"SIGTERM"); for(let i=0;i<20;i+=1){await delay(150);const state=await check(item);if(!state.healthy)return state;} throw new Error(`${item.name} konnte nicht beendet werden.`); }
function pidFromWindowsNetstat(output,port){
  const line=String(output||"").split(/\r?\n/).find((row)=>{
    const columns=row.trim().split(/\s+/);
    return columns[0]?.toUpperCase()==="TCP"
      && columns[1]?.endsWith(`:${port}`)
      && columns[2]?.endsWith(":0")
      && Number(columns.at(-1))>0;
  });
  return Number(line?.trim().split(/\s+/).at(-1))||null;
}
async function pidForPort(port){try{if(process.platform==="win32"){const{stdout}=await execFileAsync("netstat",["-ano","-p","tcp"],{windowsHide:true});return pidFromWindowsNetstat(stdout,port);}const{stdout}=await execFileAsync("lsof",["-nP",`-iTCP:${port}`,"-sTCP:LISTEN","-t"]);return Number(stdout.trim().split(/\s+/)[0])||null;}catch{return null;}}
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
  return rows.map((row)=>{const state=String(row.State||row.state||"").toLowerCase();const health=String(row.Health||row.health||"").toLowerCase();return {
    id:String(row.Service||row.service||row.Name||row.name||"unknown"),
    name:String(row.Service||row.service||row.Name||row.name||"Unbekannter Container"),
    container:String(row.Name||row.name||""),state:state||"unknown",health:health||"",status:String(row.Status||row.status||""),
    healthy:state==="running"&&(!health||health==="healthy"),scope:"vps"
  };});
}
function remoteError(error){const detail=String(error.stderr||error.message||error).trim().split(/\r?\n/).slice(-1)[0];return `VPS nicht erreichbar: ${detail}`;}

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

module.exports={communityStorageSummary,configureWorkspace,interfaceStatistics,parseComposePs,parseMacVpnState,parseSecurityCheckOutput,parseWindowsServiceState,pidFromWindowsNetstat,presentLinkIntegrity,processStates,remoteLinkIntegrity,remoteProcessStates,runtimeAlerts,securityRuleStates,services,stagingTunnelDefinition,stagingTunnelState,startIdentityRemoteDev,startStagingTunnel,stopStagingTunnel,setVpnConnected,startAllServices,startService,stopService,vpnState};
