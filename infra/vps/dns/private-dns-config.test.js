const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../../..");
const compose = fs.readFileSync(path.join(repoRoot, "compose.vps.yaml"), "utf8");
const corefile = fs.readFileSync(path.join(__dirname, "Corefile"), "utf8");
const deploy = fs.readFileSync(path.join(repoRoot, "scripts/staging/remote-deploy.sh"), "utf8");
const envExample = fs.readFileSync(path.join(repoRoot, ".env.vps.example"), "utf8");

test("private DNS is bound only to the WireGuard address", () => {
  assert.match(compose, /private-dns:[\s\S]*coredns\/coredns:1\.14\.6/);
  assert.match(compose, /PRIVATE_VPS_BIND_ADDRESS:-10\.77\.0\.1\}:\$\{PRIVATE_DNS_PORT:-53\}:53\/udp/);
  assert.match(compose, /PRIVATE_VPS_BIND_ADDRESS:-10\.77\.0\.1\}:\$\{PRIVATE_DNS_PORT:-53\}:53\/tcp/);
  assert.match(compose, /private-dns:[\s\S]*cap_drop:[\s\S]*- ALL/);
  assert.match(compose, /private-dns:[\s\S]*cap_add:[\s\S]*- NET_BIND_SERVICE/);
  assert.match(envExample, /^PRIVATE_DNS_PORT=53$/m);
});

test("private service names resolve to the WireGuard edge and other names fall through", () => {
  assert.match(corefile, /10\.77\.0\.1 pwa\.gernetix\.com build\.gernetix\.com mqtt\.gernetix\.com/);
  assert.match(corefile, /fallthrough/);
  assert.match(corefile, /forward \. \/etc\/resolv\.conf/);
});

test("deployment verifies the real private DNS answer", () => {
  assert.match(deploy, /dig \+short A pwa\.gernetix\.com "@\$\{private_vps_bind_address\}"/);
  assert.match(deploy, /private_pwa_dns_answer" != "\$private_vps_bind_address/);
});
