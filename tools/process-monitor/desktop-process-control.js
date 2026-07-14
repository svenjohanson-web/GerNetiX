const http = require("node:http");
const path = require("node:path");
const { execFile, spawn } = require("node:child_process");
const { promisify } = require("node:util");
const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");

const execFileAsync = promisify(execFile);
let workspaceRoot = process.env.GERNETIX_WORKSPACE || path.resolve(__dirname, "../..");
const services = [
  service("project-server", "Project Server", 4800), service("build-deploy-server", "Build & Deploy Server", 4400),
  service("device-management-server", "Device Management Server", 4700), service("hardware-catalog", "Hardware Catalog", 4910),
  service("hardware-shop", "Hardware Shop", 4900), service("ai-usage-server", "AI Usage Server", 5000),
  service("ai-context-server", "AI Context Server", 5500), service("admin-tool", "Admin Tool", 4600),
  service("identity-server", "Identity Server", 4300)
];

function service(id, name, port) { return { id, name, port, cwd:path.join(workspaceRoot,"services",id), healthUrl:`http://127.0.0.1:${port}/health` }; }
function configureWorkspace(root) { workspaceRoot=path.resolve(root); for(const item of services)item.cwd=path.join(workspaceRoot,"services",item.id); }
function byId(id) { const item=services.find((entry)=>entry.id===id); if(!item) throw new Error("Unbekannter GerNetiX-Dienst."); return item; }

async function check(item) {
  try { const statusCode=await health(item.healthUrl); return {...item,healthy:statusCode>=200&&statusCode<300,statusCode,pid:await pidForPort(item.port),error:""}; }
  catch(error){ return {...item,healthy:false,statusCode:0,pid:await pidForPort(item.port),error:error.message}; }
}
async function processStates(){ return Promise.all(services.map(check)); }
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
  const config=loadStagingConfig();
  if(!config.GERNETIX_STAGING_SSH)return {configured:false,items:[],error:"VPS nicht konfiguriert: .env.staging.local fehlt oder enthält kein GERNETIX_STAGING_SSH."};
  const host=assertSafeSshTarget(config.GERNETIX_STAGING_SSH);
  const remoteDir=String(config.GERNETIX_STAGING_DIR||"/opt/gernetix");
  if(!remoteDir.startsWith("/")||/[\r\n]/.test(remoteDir))throw new Error("Ungültiges GERNETIX_STAGING_DIR.");
  const run=options.execFileAsync||execFileAsync;
  const command=`cd ${shellQuote(remoteDir)} && docker compose -f compose.vps.yaml ps --format json`;
  try {
    const {stdout}=await run("ssh",["-o","BatchMode=yes","-o","ConnectTimeout=5",host,command],{windowsHide:true,timeout:12000,maxBuffer:2*1024*1024});
    return {configured:true,host,items:parseComposePs(stdout),error:""};
  } catch(error) {
    return {configured:true,host,items:[],error:remoteError(error)};
  }
}
async function startService(id){ const item=byId(id); const current=await check(item); if(current.healthy)return current; const child=spawn(process.execPath,["src/dev-server.js"],{cwd:item.cwd,detached:true,windowsHide:true,env:{...process.env,ELECTRON_RUN_AS_NODE:"1",PORT:String(item.port)},stdio:"ignore"}); child.unref(); for(let i=0;i<40;i+=1){await delay(250);const state=await check(item);if(state.healthy)return state;} throw new Error(`${item.name} konnte nicht gestartet werden.`); }
async function startAllServices(options={}){const start=options.startService||startService;const items=[];for(const item of services){try{items.push(await start(item.id));}catch(error){items.push({...item,healthy:false,statusCode:0,pid:null,error:error.message});}}return{items,healthy:items.filter((item)=>item.healthy).length,failed:items.filter((item)=>!item.healthy).length};}
async function stopService(id){ const item=byId(id); const pid=await pidForPort(item.port); if(!pid)return check(item); if(process.platform==="win32")await execFileAsync("taskkill",["/PID",String(pid),"/T","/F"],{windowsHide:true});else process.kill(pid,"SIGTERM"); for(let i=0;i<20;i+=1){await delay(150);const state=await check(item);if(!state.healthy)return state;} throw new Error(`${item.name} konnte nicht beendet werden.`); }
async function pidForPort(port){try{if(process.platform==="win32"){const{stdout}=await execFileAsync("netstat",["-ano","-p","tcp"],{windowsHide:true});const line=stdout.split(/\r?\n/).find((row)=>row.includes(`:${port}`)&&/LISTENING/i.test(row));return Number(line?.trim().split(/\s+/).at(-1))||null;}const{stdout}=await execFileAsync("lsof",["-nP",`-iTCP:${port}`,"-sTCP:LISTEN","-t"]);return Number(stdout.trim().split(/\s+/)[0])||null;}catch{return null;}}
function health(url){return new Promise((resolve,reject)=>{const req=http.get(url,(res)=>{res.resume();res.on("end",()=>resolve(res.statusCode||0));});req.setTimeout(1200,()=>req.destroy(new Error("Timeout")));req.on("error",reject);});}
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

module.exports={configureWorkspace,interfaceStatistics,parseComposePs,processStates,remoteProcessStates,runtimeAlerts,services,startAllServices,startService,stopService};
