const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const repoRoot = path.resolve(__dirname, "../../..");
const firewall = fs.readFileSync(path.join(__dirname, "firewall.nft"), "utf8");
const applyScript = fs.readFileSync(path.join(__dirname, "gernetix-firewall-apply"), "utf8");
const deploy = fs.readFileSync(path.join(repoRoot, "scripts/staging/remote-deploy.sh"), "utf8");

test("HTTPS and MQTT are accepted only through WireGuard", () => {
  assert.match(firewall, /iifname "wg0" tcp dport \{ 22, 443, 4910, 8883 \} accept/);
  assert.doesNotMatch(firewall, /tcp dport \{ 80, 443, 8883 \} accept/);
  assert.match(firewall, /chain forward/);
  assert.match(firewall, /ct status dnat tcp dport \{ 443, 8883 \} iifname != "wg0" drop/);
  assert.match(firewall, /ct status dnat tcp dport 8883 meta nfproto ipv4 meter mqtt_tls_ipv4/);
  assert.match(firewall, /ip saddr limit rate over 60\/minute burst 30 packets/);
  assert.match(firewall, /ct status dnat tcp dport 8883 meta nfproto ipv6 meter mqtt_tls_ipv6/);
  assert.match(firewall, /ip6 saddr limit rate over 60\/minute burst 30 packets/);
});

test("firewall is validated before the active table is replaced", () => {
  const validationIndex = applyScript.indexOf('nft -c -f "$config"');
  const deleteIndex = applyScript.indexOf("nft delete table inet gernetix_host");
  assert.ok(validationIndex >= 0);
  assert.ok(deleteIndex > validationIndex);
});

test("staging deploy installs and reloads the versioned host firewall", () => {
  assert.match(deploy, /nft -c -f infra\/vps\/security\/firewall\.nft/);
  assert.match(deploy, /install -m 0644 infra\/vps\/security\/firewall\.nft \/etc\/gernetix\/firewall\.nft/);
  assert.match(deploy, /systemctl reload gernetix-firewall\.service/);
  assert.ok(deploy.indexOf("nft -c -f infra/vps/security/firewall.nft") < deploy.indexOf("docker compose --env-file \"$env_file\" -f compose.vps.yaml build"));
  assert.ok(deploy.indexOf("docker compose --env-file \"$env_file\" -f compose.vps.yaml build") < deploy.indexOf("install -d -m 0755 /etc/gernetix"));
});
