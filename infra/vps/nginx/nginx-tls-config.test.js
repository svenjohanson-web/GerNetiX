const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../../..");
const http = fs.readFileSync(path.join(__dirname, "default.conf"), "utf8");
const tls = fs.readFileSync(path.join(__dirname, "tls.conf"), "utf8");
const compose = fs.readFileSync(path.join(repoRoot, "compose.vps.yaml"), "utf8");
const deploy = fs.readFileSync(path.join(repoRoot, "scripts/staging/remote-deploy.sh"), "utf8");
const english = fs.readFileSync(path.join(__dirname, "welcome.en.html"), "utf8");

test("all public domains use ACME and redirect HTTP to HTTPS", () => {
  for (const domain of ["gernetix.nl", "gernetix.de", "gernetix.com"]) {
    assert.match(http, new RegExp(`server_name ${domain.replace(".", "\\.")} www\\.${domain.replace(".", "\\.")}`));
  }
  assert.match(http, /\.well-known\/acme-challenge/);
  assert.match(http, /return 301 https:\/\/\$host\$request_uri/);
});

test("TLS serves Dutch, German and English pages with one SAN certificate", () => {
  assert.match(tls, /welcome\.nl\.html/);
  assert.match(tls, /welcome\.html/);
  assert.match(tls, /welcome\.en\.html/);
  assert.match(tls, /live\/gernetix\.nl\/fullchain\.pem/);
  assert.match(english, /From vision to/);
  assert.match(english, /Understand\. Develop\. Create\./);
});

test("compose and staging deploy manage HTTPS certificate lifecycle", () => {
  assert.match(compose, /nginx-tls:/);
  assert.match(compose, /certbot:/);
  assert.match(compose, /HTTPS_PORT:-443/);
  assert.match(deploy, /certonly --webroot/);
  assert.match(deploy, /--profile tls up -d/);
});
