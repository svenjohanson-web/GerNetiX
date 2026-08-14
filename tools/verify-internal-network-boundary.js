"use strict";

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");

const allowedPublishedPorts = new Map([
  ["runtime-postgres", [/^\$\{RUNTIME_POSTGRES_BIND_ADDRESS:-127\.0\.0\.1\}:/]],
  ["forgejo", [/^127\.0\.0\.1:/]],
  ["project-server", [/^127\.0\.0\.1:/]],
  ["compute-control-plane", [/^\$\{COMPUTE_BIND_ADDRESS:-127\.0\.0\.1\}:/]],
  ["build-deploy-server", [/^127\.0\.0\.1:/]],
  ["build-router", [/^127\.0\.0\.1:/]],
  ["public-demo-server", [/^127\.0\.0\.1:/]],
  ["device-management-server", [/^127\.0\.0\.1:/]],
  ["telemetry-server", [/^127\.0\.0\.1:/]],
  ["hardware-catalog", [/^10\.77\.0\.1:/]],
  ["hardware-shop", [/^127\.0\.0\.1:/]],
  ["ai-usage-server", [/^127\.0\.0\.1:/]],
  ["device-voice-orchestrator", [/^127\.0\.0\.1:/]],
  ["community-platform", [/^127\.0\.0\.1:/]],
  ["ai-context-server", [/^127\.0\.0\.1:/]],
  ["admin-tool", [/^127\.0\.0\.1:/]],
  ["admin-access-server", [/^127\.0\.0\.1:/]],
  ["mqtt-broker", [/^\$\{PRIVATE_VPS_BIND_ADDRESS:-10\.77\.0\.1\}:/]],
  ["private-dns", [/^\$\{PRIVATE_VPS_BIND_ADDRESS:-10\.77\.0\.1\}:/]],
  ["nginx", [
    /^127\.0\.0\.1:/,
    /^\$\{ACME_HTTP_BIND_ADDRESS:-0\.0\.0\.0\}:/,
  ]],
  ["nginx-tls", [/^\$\{PRIVATE_VPS_BIND_ADDRESS:-10\.77\.0\.1\}:/]],
]);

function parsePublishedPorts(source) {
  const result = [];
  let service = "";
  let inServices = false;
  let inPorts = false;
  for (const rawLine of source.replace(/\r\n/g, "\n").split("\n")) {
    if (rawLine === "services:") {
      inServices = true;
      continue;
    }
    if (inServices && /^\S/.test(rawLine) && rawLine !== "services:") break;
    const serviceMatch = rawLine.match(/^  ([a-zA-Z0-9_-]+):\s*$/);
    if (inServices && serviceMatch) {
      service = serviceMatch[1];
      inPorts = false;
      continue;
    }
    const inlinePorts = rawLine.match(/^    ports:\s*\[(.*)\]\s*$/);
    if (inlinePorts) {
      for (const binding of inlinePorts[1].split(",").map((value) => value.trim().replace(/^["']|["']$/g, "")).filter(Boolean)) {
        result.push({ service, binding });
      }
      inPorts = false;
      continue;
    }
    if (/^    ports:\s*$/.test(rawLine)) {
      inPorts = true;
      continue;
    }
    if (inPorts && /^    \S/.test(rawLine)) inPorts = false;
    const portMatch = inPorts && rawLine.match(/^      -\s+["']?([^"'#]+)["']?\s*(?:#.*)?$/);
    if (portMatch) result.push({ service, binding: portMatch[1].trim() });
  }
  return result;
}

function verifyNetworkBoundary(composeSource) {
  const findings = [];
  if (!/^  backend:\n    internal: true\s*$/m.test(composeSource.replace(/\r\n/g, "\n"))) {
    findings.push("Das Compose-Netz 'backend' muss internal: true sein.");
  }
  for (const published of parsePublishedPorts(composeSource)) {
    const allowed = allowedPublishedPorts.get(published.service) || [];
    if (!allowed.some((pattern) => pattern.test(published.binding))) {
      findings.push(`${published.service} publiziert einen nicht erlaubten Host-Port: ${published.binding}`);
    }
  }
  return findings;
}

function walk(root, accept, result = []) {
  if (!fs.existsSync(root)) return result;
  for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
    if (entry.isDirectory() && ["node_modules", ".git", "coverage"].includes(entry.name)) continue;
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) walk(fullPath, accept, result);
    else if (accept(fullPath)) result.push(fullPath);
  }
  return result;
}

function browserAssetFiles(root = path.join(repoRoot, "services")) {
  return walk(root, (file) => {
    const relative = path.relative(root, file).replace(/\\/g, "/");
    return /\/(?:public|static|dist)\//.test(`/${relative}`)
      && /\.(?:html?|js|mjs|cjs|css|json|webmanifest|svg|txt)$/i.test(file);
  });
}

const browserLeakPatterns = [
  ["interner Signaturschluessel", /INTERNAL_API_SIGNING_KEY/],
  ["interne Delegation", /X-GerNetiX-(?:Admin-)?Delegation/i],
  ["Bearer-Authorization im Browserartefakt", /Authorization\s*[:=]\s*[`'\"]Bearer\s/i],
  ["eingebettetes JWT/Bearer-Token", /Bearer\s+eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/],
];

function verifyBrowserAssets(files = browserAssetFiles()) {
  const findings = [];
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    for (const [label, pattern] of browserLeakPatterns) {
      if (pattern.test(source)) findings.push(`${path.relative(repoRoot, file)} enthaelt ${label}.`);
    }
  }
  return findings;
}

function verifySourceLeakage(root = path.join(repoRoot, "services")) {
  const findings = [];
  const files = walk(root, (file) => /\.(?:js|mjs|cjs)$/i.test(file)
    && !/[\\/](?:test|tests|node_modules)[\\/]/.test(file)
    && !/\.test\.js$/i.test(file));
  const unsafeLog = /(?:console|logger)\.(?:log|info|warn|error|debug)\([^\n]*(?:req(?:uest)?\.url|originalUrl|headers\.authorization|authorization|delegation)/i;
  const internalUrlSecret = /(?:searchParams\.(?:set|append)\s*\(|[?&])\s*[`'\"]?(?:authorization|delegation|internal[_-]?(?:api[_-]?)?token)[`'\"]?\s*[,=]/i;
  for (const file of files) {
    const source = fs.readFileSync(file, "utf8");
    if (unsafeLog.test(source)) findings.push(`${path.relative(repoRoot, file)} protokolliert moeglicherweise URL- oder Authentifizierungsdaten.`);
    if (internalUrlSecret.test(source)) findings.push(`${path.relative(repoRoot, file)} schreibt interne Authentisierung moeglicherweise in eine URL.`);
  }
  return findings;
}

function verifyNginxLogging(configFiles = [
  path.join(repoRoot, "infra", "vps", "nginx", "default.conf"),
  path.join(repoRoot, "infra", "vps", "nginx", "tls.conf"),
  path.join(repoRoot, "infra", "vps", "nginx", "build-router.conf"),
]) {
  const findings = [];
  for (const file of configFiles) {
    const source = fs.readFileSync(file, "utf8");
    const relative = path.relative(repoRoot, file);
    if (!/log_format\s+gernetix_no_query\s+[^;]*\$request_method\s+\$uri\s+\$server_protocol[^;]*;/s.test(source)) {
      findings.push(`${relative} verwendet nicht das query-freie Zugriffslogformat.`);
    }
    if (/log_format\s+gernetix_no_query\s+[^;]*\$(?:request(?:_uri)?|args|query_string|http_referer)\b/s.test(source)) {
      findings.push(`${relative} nimmt Query- oder Referrer-Daten in das Zugriffslogformat auf.`);
    }
    if (!/access_log\s+\/dev\/stdout\s+gernetix_no_query\s*;/.test(source)) {
      findings.push(`${relative} aktiviert das query-freie Zugriffslogformat nicht.`);
    }
  }
  return findings;
}

function verify(options = {}) {
  const composeSource = options.composeSource || fs.readFileSync(path.join(repoRoot, "compose.vps.yaml"), "utf8");
  return [
    ...verifyNetworkBoundary(composeSource),
    ...verifyBrowserAssets(options.browserFiles),
    ...verifySourceLeakage(options.serviceRoot),
    ...verifyNginxLogging(options.nginxFiles),
  ];
}

if (require.main === module) {
  const findings = verify();
  if (findings.length) {
    for (const finding of findings) process.stderr.write(`- ${finding}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write("Interne Netzgrenze und Secret-Leakage lokal verifiziert.\n");
  }
}

module.exports = {
  parsePublishedPorts,
  verifyNetworkBoundary,
  verifyBrowserAssets,
  verifySourceLeakage,
  verifyNginxLogging,
  verify,
};
