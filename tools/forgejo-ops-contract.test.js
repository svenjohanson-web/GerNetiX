"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const compose = fs.readFileSync(path.join(root, "compose.vps.yaml"), "utf8").replace(/\r\n/g, "\n");
const envExample = fs.readFileSync(path.join(root, ".env.vps.example"), "utf8");
const backup = fs.readFileSync(path.join(root, "tools", "backup-forgejo.sh"), "utf8");

function serviceBlock(name) {
  const start = compose.indexOf(`\n  ${name}:\n`);
  assert.notEqual(start, -1, `service ${name} fehlt`);
  const remainder = compose.slice(start + name.length + 5);
  const nextService = /^  [a-zA-Z0-9][a-zA-Z0-9-]*:\s*$/m.exec(remainder);
  const end = nextService ? start + name.length + 5 + nextService.index : compose.length;
  return compose.slice(start, end);
}

test("pins a rootless Forgejo LTS service to the internal backend and VPS loopback only", () => {
  const forgejo = serviceBlock("forgejo");
  assert.match(forgejo, /image: codeberg\.org\/forgejo\/forgejo:15\.0\.6-rootless/);
  assert.match(forgejo, /user: "1000:1000"/);
  assert.match(forgejo, /read_only: true/);
  assert.match(forgejo, /no-new-privileges:true/);
  assert.match(forgejo, /cap_drop:\n\s+- ALL/);
  assert.match(forgejo, /networks:\n\s+- backend/);
  assert.match(forgejo, /expose: \["3000"\]/);
  assert.match(forgejo, /ports:\n\s+- "127\.0\.0\.1:3300:3000"/);
  assert.doesNotMatch(forgejo, /(?:0\.0\.0\.0|10\.77\.0\.1):3300:3000/);
  assert.doesNotMatch(forgejo, /\n\s+- edge\s*$/m);
  assert.match(compose, /  backend:\n    internal: true\n/);
});

test("keeps Forgejo state and health on dedicated contracts", () => {
  const forgejo = serviceBlock("forgejo");
  assert.match(forgejo, /forgejo_data:\/var\/lib\/gitea/);
  assert.match(compose, /^  forgejo_data:$/m);
  assert.match(forgejo, /http:\/\/127\.0\.0\.1:3000\/api\/healthz/);
  assert.match(forgejo, /forgejo-postgres-provisioning: \{ condition: service_completed_successfully \}/);
  assert.match(serviceBlock("forgejo-postgres-provisioning"), /runtime-postgres: \{ condition: service_healthy \}/);
});

test("disables public enrollment, push-to-create, Actions, SSH and unused modules", () => {
  const forgejo = serviceBlock("forgejo");
  const disabled = [
    "FORGEJO__service__DISABLE_REGISTRATION: \"true\"",
    "FORGEJO__repository__ENABLE_PUSH_CREATE_USER: \"false\"",
    "FORGEJO__repository__ENABLE_PUSH_CREATE_ORG: \"false\"",
    "FORGEJO__actions__ENABLED: \"false\"",
    "FORGEJO__server__DISABLE_SSH: \"true\"",
    "FORGEJO__security__DISABLE_GIT_HOOKS: \"true\"",
    "FORGEJO__security__DISABLE_WEBHOOKS: \"true\"",
    "FORGEJO__packages__ENABLED: \"false\"",
    "FORGEJO__openid__ENABLE_OPENID_SIGNUP: \"false\"",
    "FORGEJO__oauth2_client__ENABLE_AUTO_REGISTRATION: \"false\"",
  ];
  for (const setting of disabled) assert.ok(forgejo.includes(setting), `${setting} fehlt`);
  assert.match(forgejo, /REVERSE_PROXY_TRUSTED_PROXIES: 127\.0\.0\.0\/8,::1\/128/);
  assert.match(forgejo, /REQUIRE_SIGNIN_VIEW: "true"/);
});

test("uses a separate database/login and three distinct required runtime secrets", () => {
  const forgejo = serviceBlock("forgejo");
  const provisioning = serviceBlock("forgejo-postgres-provisioning");
  assert.match(forgejo, /FORGEJO__database__NAME: forgejo/);
  assert.match(forgejo, /FORGEJO__database__USER: forgejo/);
  assert.match(provisioning, /provision-forgejo-postgres\.js/);
  for (const secret of ["FORGEJO_POSTGRES_PASSWORD", "FORGEJO_SECRET_KEY", "FORGEJO_INTERNAL_TOKEN"]) {
    assert.match(envExample, new RegExp(`^${secret}=replace-with-a-unique`, "m"));
    assert.match(forgejo, new RegExp(`\\$\\{${secret}:\\?${secret} muss gesetzt sein\\}`));
  }
  const configuredValues = ["RUNTIME_POSTGRES_PASSWORD", "FORGEJO_POSTGRES_PASSWORD", "FORGEJO_SECRET_KEY", "FORGEJO_INTERNAL_TOKEN"]
    .map((name) => envExample.match(new RegExp(`^${name}=(.+)$`, "m"))[1]);
  assert.equal(new Set(configuredValues).size, configuredValues.length);
  assert.equal((compose.match(/\$\{FORGEJO_POSTGRES_PASSWORD:/g) || []).length, 2);
  assert.equal((compose.match(/\$\{FORGEJO_SECRET_KEY:/g) || []).length, 1);
  assert.equal((compose.match(/\$\{FORGEJO_INTERNAL_TOKEN:/g) || []).length, 1);
});

test("backs up the stopped Forgejo database and volume as one checksummed set", () => {
  const stop = backup.indexOf("compose stop -t 60 forgejo");
  const databaseDump = backup.indexOf("pg_dump");
  const volumeArchive = backup.indexOf("tar -C /var/lib/gitea");
  const restart = backup.lastIndexOf("restart_forgejo");
  assert.ok(stop !== -1 && stop < databaseDump);
  assert.ok(databaseDump < volumeArchive);
  assert.ok(volumeArchive < restart);
  assert.match(backup, /trap restart_forgejo EXIT HUP INT TERM/);
  assert.match(backup, /sha256sum forgejo-database\.dump forgejo-data\.tar\.gz forgejo-version\.txt >SHA256SUMS/);
  assert.match(backup, /if \[ -e "\$backup_dir" \]/);
  assert.doesNotMatch(backup, /down -v|volume rm|rm -rf/);
});
