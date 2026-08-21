const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const compose = fs.readFileSync(path.join(__dirname, "..", "compose.vps.yaml"), "utf8");

function serviceBlock(name) {
  const marker = `  ${name}:\n`;
  const start = compose.indexOf(marker);
  assert.notEqual(start, -1, `Service ${name} fehlt in compose.vps.yaml`);
  const remainder = compose.slice(start + marker.length);
  const nextSection = remainder.search(/\n(?:  [a-z0-9][a-z0-9-]*:|networks:)\n/);
  const end = nextSection === -1 ? compose.length : start + marker.length + nextSection;
  return compose.slice(start, end === -1 ? compose.length : end);
}

test("remote-dev services with loopback ports use a non-internal access network", () => {
  const services = new Map([
    ["project-server", 4800],
    ["device-management-server", 4700],
    ["telemetry-server", 5600],
    ["hardware-shop", 4900],
    ["ai-usage-server", 5000],
    ["device-voice-orchestrator", 5800],
    ["community-platform", 5200],
    ["ai-context-server", 5500],
  ]);

  for (const [name, port] of services) {
    const block = serviceBlock(name);
    assert.match(block, /\n    networks:\n      - backend\n      - loopback-access\n/);
    assert.match(block, new RegExp(`\\n      - "127\\.0\\.0\\.1:${port}:${port}"\\n`));
  }

  // Einzeln pruefen statt als Nachbarn: sonst bricht die Zusage bei jedem
  // zusaetzlichen Netzwerk, das dazwischen deklariert wird.
  assert.match(compose, /\n  loopback-access:\n/);
  assert.match(compose, /\n  runtime-postgres-access:\n/);
});

// Identity beantwortet /health mit Detaildiagnose (identity_db, dependencies mit
// Fehlermeldungen). Das ist laut docs/internal-api-access-inventory.md nur
// zulaessig, solange der Plattform-Tunnel ausschliesslich an 127.0.0.1 haengt.
// Faellt die Bindung weg, wird die Detaildiagnose oeffentlich erreichbar.
test("platform tunnel to Identity stays bound to loopback", () => {
  const block = serviceBlock("nginx");
  assert.match(block, /\n      - "127\.0\.0\.1:\$\{PRIVATE_PLATFORM_TUNNEL_PORT:-\d+\}:8081"\n/);
  assert.doesNotMatch(block, /\n      - "(?:0\.0\.0\.0:)?\$\{PRIVATE_PLATFORM_TUNNEL_PORT[^\n]*:8081"\n/);
});

test("AI Context warmup does not fail the staging deployment prematurely", () => {
  const block = serviceBlock("ai-context-server");
  assert.match(block, /\n    healthcheck:\n      test: \["CMD", "node", "\/app\/docker\/healthcheck\.js"\]\n/);
  assert.match(block, /\n      start_period: 120s\n/);
});

test("Identity reaches the public demo catalog through its internal service name", () => {
  const block = serviceBlock("identity-server");
  assert.match(block, /\n      PUBLIC_DEMO_BASE_URL: http:\/\/public-demo-server:4920\n/);
  assert.match(block, /\n      public-demo-server: \{ condition: service_healthy \}\n/);
  assert.match(compose, /public-demo-server:[\s\S]*?ports:\n      - "127\.0\.0\.1:4920:4920"/);
});
