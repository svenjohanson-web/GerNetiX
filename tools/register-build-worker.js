#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..");

function parseEnvFile(content) {
  const values = {};
  for (const rawLine of String(content).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) throw new Error(`Ungueltige Konfigurationszeile: ${rawLine}`);
    values[line.slice(0, separator).trim()] = line.slice(separator + 1).trim().replace(/^(['"])(.*)\1$/, "$2");
  }
  return values;
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`;
}

function workerEnv({ workerId, workerAddress, postgresAddress, password, artifactUploadToken }) {
  return [
    `BUILD_WORKER_ID=${workerId}`,
    `BUILD_WORKER_BIND_ADDRESS=${workerAddress}`,
    "BUILD_WORKER_PORT=4400",
    `BUILD_POSTGRES_HOST=${postgresAddress}`,
    "BUILD_POSTGRES_PORT=25432",
    "BUILD_POSTGRES_DATABASE=gernetix_runtime",
    "BUILD_POSTGRES_USER=gernetix_build_worker",
    `BUILD_POSTGRES_PASSWORD=${password}`,
    "BUILD_ARTIFACT_PERSISTENCE_BACKEND=http",
    "BUILD_ARTIFACT_UPLOAD_BASE_URL=https://build.gernetix.com",
    `BUILD_ARTIFACT_UPLOAD_TOKEN=${artifactUploadToken}`,
    "BUILD_ARTIFACT_UPLOAD_TIMEOUT_MS=120000",
    "BUILD_PUBLIC_BASE_URL=https://build.gernetix.com",
    "",
  ].join("\n");
}

function parseRegistrationArgs(argv = process.argv.slice(2)) {
  const options = {};
  const names = new Map([
    ["--worker-id", "workerId"],
    ["--worker-address", "workerAddress"],
    ["--pool", "pool"],
    ["--local-file", "localFile"],
    ["--reuse-credentials-from", "reuseCredentialsFrom"],
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const key = names.get(argv[index]);
    if (!key || !argv[index + 1]) throw new Error(`Unbekanntes oder unvollstaendiges Argument: ${argv[index]}`);
    options[key] = argv[index + 1];
    index += 1;
  }
  return options;
}

function remoteUpdaterSource() {
  return `
const fs=require("node:fs");
const input=JSON.parse(fs.readFileSync(0,"utf8"));
const file=".env.vps";
const source=fs.readFileSync(file,"utf8");
const upstreamKey=input.pool==="secondary"?"BUILD_WORKER_UPSTREAMS":"BUILD_WORKER_PRIMARY_UPSTREAMS";
const current={};
for(const line of source.split(/\\r?\\n/)){
  const match=line.match(/^([A-Z0-9_]+)=(.*)$/);
  if(match)current[match[1]]=match[2];
}
const endpoint=input.workerAddress+":"+input.workerPort;
const upstreams=String(current[upstreamKey]||"").split(",").map((value)=>value.trim()).filter(Boolean);
if(!upstreams.includes(endpoint))upstreams.push(endpoint);
const updates={
  RUNTIME_POSTGRES_BIND_ADDRESS:input.postgresAddress,
  [upstreamKey]:upstreams.join(","),
  BUILD_WORKER_POSTGRES_PASSWORD:input.password,
};
const seen=new Set();
const lines=source.split(/\\r?\\n/).map((line)=>{
  const match=line.match(/^([A-Z0-9_]+)=/);
  if(!match||!(match[1] in updates))return line;
  seen.add(match[1]);
  return match[1]+"="+updates[match[1]];
});
for(const [key,value] of Object.entries(updates))if(!seen.has(key))lines.push(key+"="+value);
const temporary=file+".worker-setup.tmp";
fs.writeFileSync(temporary,lines.join("\\n"),{mode:0o600});
fs.renameSync(temporary,file);
process.stdout.write("GERNETIX_ARTIFACT_UPLOAD_TOKEN="+(current.BUILD_ARTIFACT_UPLOAD_TOKEN||"")+"\\n");
`;
}

function registerWorker(options = {}) {
  const stagingFile = options.stagingFile || path.join(repoRoot, ".env.staging.local");
  if (!fs.existsSync(stagingFile)) throw new Error(".env.staging.local fehlt.");
  const staging = parseEnvFile(fs.readFileSync(stagingFile, "utf8"));
  const sshTarget = options.sshTarget || staging.GERNETIX_STAGING_SSH;
  const remoteDir = options.remoteDir || staging.GERNETIX_STAGING_DIR;
  if (!/^[A-Za-z0-9._-]+@[A-Za-z0-9.-]+$/.test(sshTarget || "")) throw new Error("Ungueltiges Staging-SSH-Ziel.");
  if (!String(remoteDir || "").startsWith("/")) throw new Error("Ungueltiges Staging-Verzeichnis.");

  const workerId = options.workerId || "mac-worker-01";
  const workerAddress = options.workerAddress || "10.77.0.5";
  const pool = options.pool || "primary";
  if (!/^[a-z0-9._-]+$/.test(workerId)) throw new Error("Ungueltige Worker-ID.");
  if (!/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(workerAddress)) throw new Error("Worker-Adresse muss eine private IPv4-Adresse sein.");
  if (pool !== "primary" && pool !== "secondary") throw new Error("Worker-Pool muss primary oder secondary sein.");

  let reused = {};
  if (options.reuseCredentialsFrom) {
    if (!fs.existsSync(options.reuseCredentialsFrom)) throw new Error("Datei fuer wiederverwendete Worker-Credentials fehlt.");
    reused = parseEnvFile(fs.readFileSync(options.reuseCredentialsFrom, "utf8"));
  }
  const postgresAddress = options.postgresAddress || reused.BUILD_POSTGRES_HOST || "10.77.0.1";
  const password = options.password || reused.BUILD_POSTGRES_PASSWORD || crypto.randomBytes(32).toString("base64url");
  const payload = JSON.stringify({ workerAddress, workerPort:4400, postgresAddress, password, pool });
  const compose = "docker compose --env-file .env.vps -f compose.vps.yaml";
  const remoteCommand = [
    `cd ${shellQuote(remoteDir)}`,
    `docker run --rm -i --user 0:0 -v "$PWD:/workspace" -w /workspace gernetix/node-services:local node -e ${shellQuote(remoteUpdaterSource())}`,
    `${compose} config --quiet`,
    `${compose} up -d --no-deps --force-recreate --wait --wait-timeout 180 runtime-postgres`,
    `${compose} --profile build-worker-provisioning run --rm build-worker-postgres-access`,
    `${compose} up -d --no-deps --force-recreate --wait --wait-timeout 60 build-router`,
  ].join(" && ");
  const run = options.spawnSync || spawnSync;
  const result = run("ssh", ["-o", "BatchMode=yes", sshTarget, remoteCommand], {
    cwd:repoRoot,
    encoding:"utf8",
    input:payload,
    stdio:["pipe", "pipe", "inherit"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Worker-Registrierung wurde mit Exit-Code ${result.status} beendet.`);
  const artifactTokenMatch = String(result.stdout || "").match(/(?:^|\n)GERNETIX_ARTIFACT_UPLOAD_TOKEN=([^\r\n]+)/);
  const artifactUploadToken = options.artifactUploadToken || artifactTokenMatch?.[1] || reused.BUILD_ARTIFACT_UPLOAD_TOKEN || "";
  if (!artifactUploadToken) throw new Error("BUILD_ARTIFACT_UPLOAD_TOKEN fehlt auf dem Staging-VPS.");

  const localFile = options.localFile || path.join(repoRoot, ".env.build-worker.local");
  const temporary = `${localFile}.tmp`;
  fs.writeFileSync(temporary, workerEnv({workerId,workerAddress,postgresAddress,password,artifactUploadToken}), {mode:0o600});
  fs.renameSync(temporary, localFile);
  fs.chmodSync(localFile, 0o600);
  return { workerId, workerAddress, postgresAddress, localFile, pool };
}

if (require.main === module) {
  try {
    const result = registerWorker(parseRegistrationArgs());
    process.stdout.write(`Build-Worker registriert: ${result.workerId} auf ${result.workerAddress} (${result.pool})\n`);
  } catch (error) {
    process.stderr.write(`Build-Worker-Registrierung fehlgeschlagen: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = { parseEnvFile, parseRegistrationArgs, registerWorker, remoteUpdaterSource, shellQuote, workerEnv };
