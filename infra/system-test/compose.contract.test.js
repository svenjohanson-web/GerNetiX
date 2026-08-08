"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const directory = __dirname;
const composePath = path.join(directory, "compose.yaml");
const compose = fs.readFileSync(composePath, "utf8");
const postgres = fs.readFileSync(path.join(directory, "postgres", "init-databases.sh"), "utf8");
const mosquitto = fs.readFileSync(path.join(directory, "mosquitto", "mosquitto.conf"), "utf8");
const bootstrap = fs.readFileSync(path.join(directory, "toxiproxy", "configure-proxies.sh"), "utf8");

test("uses isolated, project-scoped resources with loopback-only host ports", () => {
  assert.match(compose, /^name: gernetix-system-test$/m);
  assert.doesNotMatch(compose, /container_name:/);
  assert.doesNotMatch(compose, /(?:^|["'])0\.0\.0\.0:/m);
  assert.match(compose, /control-plane:\n    internal: true/);
  assert.match(compose, /data-plane:\n    internal: true/);
  assert.match(compose, /com\.gernetix\.scope: system-test/);
  for (const binding of [
    "127.0.0.1:55432:5432",
    "127.0.0.1:51883:1883",
    "127.0.0.1:58474:8474",
    "127.0.0.1:51884:11883",
    "127.0.0.1:53001:13000",
    "127.0.0.1:55433:15432",
    "127.0.0.1:53000:3000",
  ]) {
    assert.match(compose, new RegExp(`- "${binding.replaceAll(".", "\\.")}"`), `${binding} is missing`);
  }
  const portSections = [...compose.matchAll(/^\s{4}ports:\n((?:\s{6}- .+\n)+)/gm)];
  assert.equal(portSections.length, 4, "only the four declared host-facing services may publish ports");
  for (const [, entries] of portSections) {
    for (const entry of entries.trim().split("\n")) {
      assert.match(entry.trim(), /^- "127\.0\.0\.1:\d+:\d+"$/, `unsafe host binding: ${entry}`);
    }
  }
  const publishedBindings = [...compose.matchAll(/^\s+- "([^\"]+:\d+:\d+)"$/gm)].map((match) => match[1]);
  assert.equal(publishedBindings.length, 7, "the direct, proxied and control bindings must stay explicit");
  assert.ok(publishedBindings.every((binding) => binding.startsWith("127.0.0.1:")));
  for (const volume of ["system_test_postgres_data", "system_test_forgejo_data", "system_test_mqtt_data"]) {
    assert.ok(compose.includes(volume), `${volume} is missing`);
  }
});

test("requires an explicit system-test-only startup guard", () => {
  assert.match(compose, /SYSTEM_TEST_ENVIRONMENT: \$\{SYSTEM_TEST_ENVIRONMENT:\?must be exactly system-test\}/);
  assert.match(compose, /SYSTEM_TEST_CONFIRM_ISOLATED: \$\{SYSTEM_TEST_CONFIRM_ISOLATED:\?must be exactly gernetix-system-test-only\}/);
  assert.match(compose, /test "\$\$SYSTEM_TEST_ENVIRONMENT" = "system-test"/);
  assert.match(compose, /test "\$\$SYSTEM_TEST_CONFIRM_ISOLATED" = "gernetix-system-test-only"/);
  assert.doesNotMatch(compose, /\.env\.vps|staging|production/i);
});

test("pins the required infrastructure and provides health checks", () => {
  assert.match(compose, /image: pgvector\/pgvector:pg17/);
  assert.match(compose, /image: codeberg\.org\/forgejo\/forgejo:15\.0\.6-rootless/);
  assert.match(compose, /image: eclipse-mosquitto:2\.0\.22/);
  assert.match(compose, /image: shopify\/toxiproxy:2\.12\.0/);
  for (const service of ["postgres", "mosquitto", "toxiproxy", "forgejo"]) {
    const section = compose.match(new RegExp(`\\n  ${service}:[\\s\\S]*?(?=\\n  [a-z]|\\nnetworks:)`));
    assert.ok(section, `${service} service is missing`);
    assert.match(section[0], /healthcheck:/, `${service} healthcheck is missing`);
  }
});

test("keeps Forgejo private and separates its database login", () => {
  assert.match(compose, /FORGEJO__database__HOST: toxiproxy:15432/);
  for (const setting of [
    "FORGEJO__server__DISABLE_SSH: \"true\"",
    "FORGEJO__security__DISABLE_GIT_HOOKS: \"true\"",
    "FORGEJO__security__DISABLE_WEBHOOKS: \"true\"",
    "FORGEJO__service__DISABLE_REGISTRATION: \"true\"",
    "FORGEJO__repository__ENABLE_PUSH_CREATE_USER: \"false\"",
    "FORGEJO__actions__ENABLED: \"false\"",
  ]) {
    assert.ok(compose.includes(setting), `${setting} is missing`);
  }
  assert.match(postgres, /CREATE EXTENSION IF NOT EXISTS vector/);
  assert.match(postgres, /CREATE ROLE forgejo/);
  assert.match(postgres, /CREATE DATABASE forgejo OWNER forgejo/);
  assert.match(postgres, /REVOKE ALL PRIVILEGES ON DATABASE gernetix_runtime FROM forgejo/);
});

test("routes all selected dependencies through deterministic Toxiproxy listeners", () => {
  assert.match(compose, /entrypoint: \["\/bin\/sh", "\/bootstrap\/configure-proxies\.sh"\]/);
  assert.match(bootstrap, /create_proxy postgres "0\.0\.0\.0:15432" "postgres:5432"/);
  assert.match(bootstrap, /create_proxy mqtt "0\.0\.0\.0:11883" "mosquitto:1883"/);
  assert.match(bootstrap, /create_proxy forgejo "0\.0\.0\.0:13000" "forgejo:3000"/);
  assert.match(compose, /TOXIPROXY_API_URL: http:\/\/toxiproxy:8474/);
  assert.match(compose, /"127\.0\.0\.1:58474:8474"/);
});

test("allows anonymous MQTT only on the isolated test listener and loopback host binding", () => {
  assert.match(mosquitto, /listener 1883 0\.0\.0\.0/);
  assert.match(mosquitto, /allow_anonymous true/);
  assert.doesNotMatch(mosquitto, /listener 8883|listener 9001/);
  assert.match(compose, /"127\.0\.0\.1:51883:1883"/);
  assert.doesNotMatch(compose, /(?:^|[^\d])8883:8883|9001:9001/);
});

test("Docker Compose accepts the file without starting containers", (t) => {
  const version = spawnSync("docker", ["compose", "version"], { encoding: "utf8" });
  if (version.error?.code === "ENOENT" || version.status !== 0) {
    t.skip("Docker Compose CLI is not installed");
    return;
  }

  const result = spawnSync("docker", ["compose", "--file", composePath, "config", "--quiet"], {
    cwd: directory,
    encoding: "utf8",
    env: {
      ...process.env,
      SYSTEM_TEST_ENVIRONMENT: "system-test",
      SYSTEM_TEST_CONFIRM_ISOLATED: "gernetix-system-test-only",
      SYSTEM_TEST_POSTGRES_PASSWORD: "synthetic-runtime-password",
      SYSTEM_TEST_FORGEJO_POSTGRES_PASSWORD: "synthetic-forgejo-password",
      SYSTEM_TEST_FORGEJO_SECRET_KEY: "synthetic-forgejo-secret-key-for-contract-check",
      SYSTEM_TEST_FORGEJO_INTERNAL_TOKEN: "synthetic-forgejo-internal-token-for-contract-check",
    },
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
});
