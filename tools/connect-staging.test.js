"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { REMOTE_DEV_SERVICE_FORWARDS, parseArgs, sshTunnelArgs } = require("./connect-staging");

test("forwards platform, admin and loopback-only identity PostgreSQL access", () => {
  const args = sshTunnelArgs({
    host: "root@gernetix-vps",
    localPort: 14600,
    remotePort: 4610,
    platformPort: 14300,
    remotePlatformPort: 8080,
    identityDbPort: 25432,
    remoteIdentityDbHost: "10.77.0.1",
    remoteIdentityDbPort: 25432,
    buildRouterPort: 14400,
    remoteBuildRouterHost: "127.0.0.1",
    remoteBuildRouterPort: 14400,
    forgejoPort: 13300,
    remoteForgejoPort: 3300,
  });
  assert.equal(args.filter((arg) => arg === "-L").length, 5 + REMOTE_DEV_SERVICE_FORWARDS.length);
  assert.ok(args.includes("127.0.0.1:25432:10.77.0.1:25432"));
  assert.ok(args.includes("127.0.0.1:14400:127.0.0.1:14400"));
  assert.ok(args.includes("127.0.0.1:13300:127.0.0.1:3300"));
  assert.ok(args.includes("127.0.0.1:4600:127.0.0.1:4600"));
  for (const [localPort, remotePort] of REMOTE_DEV_SERVICE_FORWARDS) {
    assert.ok(args.includes(`127.0.0.1:${localPort}:127.0.0.1:${remotePort}`));
  }
  assert.equal(args.at(-1), "root@gernetix-vps");
});

/*
 * Jeder lokale Dienst, den der Remote-Dev-Identity-Prozess aufruft, muss
 * weitergeleitet werden.
 *
 * Der Tunnel fuehrt eine Portliste, Identity fuehrt eine Dienstliste, und
 * niemand verband die beiden. Genau dort ist ADMIN_TOOL_BASE_URL
 * durchgefallen: der Starter setzt die Variable nicht, Identity faellt auf
 * 127.0.0.1:4600 zurueck, und der Tunnel kannte den Port nicht. Das Monitoring
 * meldete Identity daraufhin als gestoert -- ohne dass irgendwo stand, warum.
 *
 * Wirksam ist, was der Starter setzt; wo er schweigt, gilt der Rueckfall im
 * dev-server. Beide Listen werden hier gelesen statt wiederholt.
 */
test("the tunnel forwards every local service the remote-dev identity will call", () => {
  const wurzel = path.resolve(__dirname, "..");
  const lies = (rel) => fs.readFileSync(path.join(wurzel, rel), "utf8");

  /*
   * Zwei begruendete Ausnahmen:
   * - Der eigene Port des Identity-Prozesses wird nicht getunnelt.
   * - Ollama laeuft auf dem Entwicklungsrechner selbst, nicht auf dem VPS.
   */
  const nichtGetunnelt = new Set(["IDENTITY_APP_BASE_URL", "OLLAMA_BASE_URL"]);

  const adressen = new Map();
  const sammle = (text, herkunft) => {
    for (const t of text.matchAll(/([A-Z][A-Z_]*_BASE_URL)[^;\n]*?["'`]http:\/\/127\.0\.0\.1:(\d+)/g)) {
      if (nichtGetunnelt.has(t[1])) continue;
      adressen.set(t[1], { port: t[2], herkunft });
    }
  };
  // Erst die Rueckfaelle, dann der Starter -- er ueberschreibt sie.
  sammle(lies("services/identity-server/src/dev-server.js"), "Rueckfall im dev-server");
  sammle(lies("tools/start-identity-remote-dev.js"), "vom Starter gesetzt");

  assert.ok(adressen.size >= 10, `Zu wenige Dienstadressen gefunden: ${adressen.size}`);

  const args = sshTunnelArgs({
    host: "root@gernetix-vps",
    localPort: 14600, remotePort: 4600,
    platformPort: 14300, remotePlatformPort: 4300,
    identityDbPort: 25432, remoteIdentityDbHost: "10.77.0.1", remoteIdentityDbPort: 25432,
    buildRouterPort: 14400, remoteBuildRouterHost: "127.0.0.1", remoteBuildRouterPort: 4400,
    forgejoPort: 13300, remoteForgejoPort: 3300,
  });
  const weitergeleitet = new Set();
  for (const eintrag of args) {
    const treffer = String(eintrag).match(/^127\.0\.0\.1:(\d+):/);
    if (treffer) weitergeleitet.add(treffer[1]);
  }

  const fehlend = [];
  for (const [name, { port, herkunft }] of adressen) {
    if (!weitergeleitet.has(port)) fehlend.push(`${name} -> 127.0.0.1:${port} (${herkunft}) wird nicht weitergeleitet`);
  }
  assert.deepEqual(fehlend, []);
});

