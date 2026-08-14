"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const {
  verifyNetworkBoundary,
  verifyBrowserAssets,
  verifySourceLeakage,
  verifyNginxLogging,
  verify,
} = require("./verify-internal-network-boundary");

const repoRoot = path.resolve(__dirname, "..");

test("aktuelles VPS-Modell haelt interne Dienste von oeffentlichen Host-Ports fern", () => {
  const compose = fs.readFileSync(path.join(repoRoot, "compose.vps.yaml"), "utf8");
  assert.deepEqual(verifyNetworkBoundary(compose), []);
});

test("neuer Wildcard-Port eines internen Dienstes wird abgewiesen", () => {
  const compose = `services:\n  project-server:\n    ports:\n      - "0.0.0.0:4800:4800"\nnetworks:\n  backend:\n    internal: true\n`;
  assert.match(verifyNetworkBoundary(compose).join("\n"), /project-server.*0\.0\.0\.0/);
});

test("Inline-Portlisten koennen die Netzgrenze nicht umgehen", () => {
  const compose = `services:\n  new-internal-service:\n    ports: ["0.0.0.0:9999:9999"]\nnetworks:\n  backend:\n    internal: true\n`;
  assert.match(verifyNetworkBoundary(compose).join("\n"), /new-internal-service.*0\.0\.0\.0/);
});

test("explizite ACME- und VPN-Bindungen bleiben erlaubt", () => {
  const compose = `services:\n  nginx:\n    ports:\n      - "\${ACME_HTTP_BIND_ADDRESS:-0.0.0.0}:\${ACME_HTTP_PORT:-80}:8080"\n  nginx-tls:\n    ports:\n      - "\${PRIVATE_VPS_BIND_ADDRESS:-10.77.0.1}:\${HTTPS_PORT:-443}:8443"\nnetworks:\n  backend:\n    internal: true\n`;
  assert.deepEqual(verifyNetworkBoundary(compose), []);
});

test("Browserartefakte duerfen weder Schluessel noch interne Delegation enthalten", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-browser-leak-"));
  const clean = path.join(temporary, "clean.js");
  const leaked = path.join(temporary, "leaked.js");
  fs.writeFileSync(clean, "fetch('/api/session');", "utf8");
  fs.writeFileSync(leaked, "const name = 'INTERNAL_API_SIGNING_KEY';", "utf8");
  assert.deepEqual(verifyBrowserAssets([clean]), []);
  assert.match(verifyBrowserAssets([leaked]).join("\n"), /Signaturschluessel/);
});

test("Produktionscode darf interne Authentisierung nicht in URLs oder Logs schreiben", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-source-leak-"));
  fs.mkdirSync(path.join(temporary, "src"));
  fs.writeFileSync(path.join(temporary, "src", "unsafe.js"), "console.info(req.url); url.searchParams.set('delegation', value);", "utf8");
  const findings = verifySourceLeakage(temporary);
  assert.equal(findings.length, 2);
});

test("Nginx-Zugriffslogs muessen Querywerte auslassen", () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-nginx-log-"));
  const safe = path.join(temporary, "safe.conf");
  const unsafe = path.join(temporary, "unsafe.conf");
  fs.writeFileSync(safe, "log_format gernetix_no_query '$request_method $uri $server_protocol';\naccess_log /dev/stdout gernetix_no_query;", "utf8");
  fs.writeFileSync(unsafe, "log_format gernetix_no_query '$request $http_referer';\naccess_log /dev/stdout;", "utf8");
  assert.deepEqual(verifyNginxLogging([safe]), []);
  assert.ok(verifyNginxLogging([unsafe]).length >= 2);
});

test("vollstaendiger lokaler Nachweis ist erfolgreich", () => {
  assert.deepEqual(verify(), []);
});
