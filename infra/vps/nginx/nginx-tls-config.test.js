const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../../..");
const http = fs.readFileSync(path.join(__dirname, "default.conf"), "utf8");
const tls = fs.readFileSync(path.join(__dirname, "tls.conf"), "utf8");
const compose = fs.readFileSync(path.join(repoRoot, "compose.vps.yaml"), "utf8");

test("build deploy advertises the canonical public firmware origin", () => {
  assert.match(compose, /PUBLIC_BASE_URL: https:\/\/build\.gernetix\.com/);
  assert.match(compose, /BUILD_RUNNER: platformio/);
  assert.match(compose, /PLATFORMIO_COMMAND: \/opt\/platformio\/bin\/platformio/);
});
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

test("device services and private PWA use dedicated .com hostnames", () => {
  assert.match(http, /server_name build\.gernetix\.com mqtt\.gernetix\.com pwa\.gernetix\.com/);
  assert.match(tls, /server_name build\.gernetix\.com/);
  assert.match(tls, /server_name pwa\.gernetix\.com/);
  assert.match(tls, /proxy_pass http:\/\/build-deploy-server:4400/);
  assert.match(tls, /live\/gernetix-services\.com\/fullchain\.pem/);
  assert.match(tls, /allow 10\.77\.0\.0\/24;[\s\S]*deny all;/);
  assert.match(deploy, /-d build\.gernetix\.com -d mqtt\.gernetix\.com -d pwa\.gernetix\.com/);
});

test("compose and staging deploy manage HTTPS certificate lifecycle", () => {
  assert.match(compose, /nginx-tls:/);
  assert.match(compose, /certbot:/);
  assert.match(compose, /HTTPS_PORT:-443/);
  assert.match(deploy, /certonly --webroot/);
  assert.match(deploy, /--profile tls up -d/);
  assert.match(deploy, /--force-recreate nginx-tls mqtt-broker certbot/);
  assert.match(deploy, /--no-deps --force-recreate mqtt-broker/);
});

test("public web and authentication requests are rate limited per source", () => {
  for (const config of [http, tls]) {
    assert.match(config, /limit_req_zone \$binary_remote_addr zone=gernetix_web_per_ip:10m rate=10r\/s/);
    assert.match(config, /limit_req_zone \$binary_remote_addr zone=gernetix_auth_per_ip:10m rate=5r\/m/);
    assert.match(config, /limit_conn_zone \$binary_remote_addr zone=gernetix_connections_per_ip:10m/);
    assert.match(config, /limit_req_status 429/);
    assert.match(config, /limit_conn_status 429/);
    assert.match(config, /location ~ \^\/api\/\(login\(\?:\/external\)\?\|register\)\$/);
    assert.match(config, /limit_req zone=gernetix_auth_per_ip burst=5 nodelay/);
  }
  assert.match(tls, /limit_req_zone \$binary_remote_addr zone=gernetix_build_per_ip:10m rate=30r\/s/);
  assert.match(tls, /limit_req zone=gernetix_build_per_ip burst=100 nodelay/);
});
