"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  additionalServicesByDirectory,
  additionalServicesByFile,
  incrementalServiceByDirectory,
  isIgnoredDeploymentFile,
  assertSafeGitRef,
  assertSafeSshTarget,
  createDeploymentPlan,
  formatDeploymentPlan,
  parseArgs,
  parseEnvFile,
  remoteDeployCommand,
  remoteHeadCommand,
  shellQuote,
} = require("./staging-deploy");

test("parses cross-platform staging config", () => {
  assert.deepEqual(parseEnvFile("# local\nGERNETIX_STAGING_SSH=root@example.test\r\nVALUE='hello world'\n"), {
    GERNETIX_STAGING_SSH: "root@example.test",
    VALUE: "hello world",
  });
});

test("parses deploy arguments", () => {
  assert.deepEqual(parseArgs(["--dry-run", "--host", "deploy@example.test", "--branch", "agent/test"]), {
    dryRun: true,
    plan: false,
    publicDemo: false,
    migrateArtifacts: false,
    forceFull: false,
    host: "deploy@example.test",
    branch: "agent/test",
  });
});

test("rejects mutually exclusive local preview and remote plan", () => {
  assert.throws(() => parseArgs(["--dry-run", "--plan"]), /nicht gemeinsam/);
});

test("plans the frequent identity assistant change without a full VPS deployment", () => {
  const plan = createDeploymentPlan([
    "services/identity-server/public/app/app.js",
    "services/recovery-tool/src/services/hardware-lab-ai.js",
    "infra/vps/nginx/tls.conf",
    "services/identity-server/test/hardware-lab-ui.test.js",
    "docs/codex-staging-deployment.md",
  ], { historyIsLinear: true });

  assert.equal(plan.mode, "incremental");
  assert.deepEqual(plan.services, ["identity-server"]);
  assert.equal(plan.edge, true);
  assert.equal(plan.firewall, false);
});

/*
 * Die Listen zu fuehren ist nicht dasselbe, wie sie zu benutzen. Hier wird
 * geprueft, was der Plan tatsaechlich ausgibt -- fuer beide Koernigkeiten.
 */
test("plans a shared file to reach the second service that reads it", () => {
  const plan = createDeploymentPlan([
    "services/identity-server/public/app/development-component-metamodel.js",
  ], { historyIsLinear: true });
  assert.equal(plan.mode, "incremental");
  assert.deepEqual(plan.services, ["identity-server", "admin-tool"]);
});

test("plans a change in a service others build on to reach them as well", () => {
  // hardware-shop bindet den Einstiegspunkt von hardware-catalog ein; die
  // Aenderung liegt eine Ebene tiefer und muss ihn trotzdem erreichen.
  const plan = createDeploymentPlan([
    "services/hardware-catalog/src/modules/capability-store.js",
  ], { historyIsLinear: true });
  assert.equal(plan.mode, "incremental");
  assert.deepEqual(plan.services, ["hardware-catalog", "hardware-shop"]);
});

test("plans edge and firewall changes as targeted infrastructure", () => {
  const plan = createDeploymentPlan([
    "infra/vps/nginx/default.conf",
    "infra/vps/security/firewall.nft",
  ], { historyIsLinear: true });
  assert.equal(plan.mode, "targeted-infrastructure");
  assert.equal(plan.edge, true);
  assert.equal(plan.firewall, true);
});

test("does not reload runtime infrastructure for test-only changes", () => {
  const plan = createDeploymentPlan([
    "infra/vps/nginx/nginx-tls-config.test.js",
    "tools/staging-deploy.test.js",
  ], { historyIsLinear: true });
  assert.equal(plan.mode, "none");
  assert.equal(plan.edge, false);
  assert.equal(plan.firewall, false);
});

test("uses the full safety path for compose, docker and unknown runtime files", () => {
  for (const file of ["compose.vps.yaml", "docker/node-service.Dockerfile", "scripts/staging/remote-deploy.sh"]) {
    const plan = createDeploymentPlan([file], { historyIsLinear: true });
    assert.equal(plan.mode, "full", file);
    assert.match(plan.reasons[0], new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});

test("prints a concise and explained deployment plan", () => {
  const output = formatDeploymentPlan(createDeploymentPlan([
    "services/identity-server/src/dev-server.js",
  ], { historyIsLinear: true }), "a".repeat(40), "b".repeat(40));
  assert.match(output, /Deployment-Plan: incremental/);
  assert.match(output, /Dienste: identity-server/);
  assert.match(output, /VPS:\s+a{12}/);
});

test("preflights the clean VPS and reads its deployed commit without changing runtime state", () => {
  const command = remoteHeadCommand("/opt/gernetix");
  assert.match(command, /git status --porcelain --untracked-files=no/);
  assert.match(command, /docker info/);
  assert.match(command, /docker compose version/);
  assert.match(command, /test -f \.env\.vps/);
  assert.match(command, /git rev-parse HEAD/);
  assert.doesNotMatch(command, /git switch|docker compose (?:up|build|run|exec)/);
});

test("adds the verified PostgreSQL binary migration to staging only when requested", () => {
  const command = remoteDeployCommand({
    branch: "main",
    commit: "0123456789abcdef0123456789abcdef01234567",
    remoteDir: "/opt/gernetix",
    migrateArtifacts: true,
  });
  assert.match(command, /migrate-postgres-binaries-to-artifact-store\.js --quarantine-untraceable-artifacts/);
  assert.match(command, /audit-postgres-binaries\.js/);
});


test("rejects unsafe refs and ssh targets", () => {
  assert.throws(() => assertSafeGitRef("main; reboot"), /Unsicherer/);
  assert.throws(() => assertSafeGitRef("../main"), /Unsicherer/);
  assert.throws(() => assertSafeSshTarget("root@example.test -o ProxyCommand=x"), /Ungueltiges/);
  assert.equal(assertSafeSshTarget("gernetix-vps"), "gernetix-vps");
});

test("parses an explicit full-deployment recovery", () => {
  assert.equal(parseArgs(["--force-full"]).forceFull, true);
});

test("force-full nennt dem Server gar keinen vorherigen Commit", () => {
  /*
   * Ohne Vergleichspunkt waehlt der Server den vollstaendigen Weg. Eine
   * unmoegliche Null-OID taete dasselbe, ist aber ein Umweg: der Server
   * begruendet den Vollmodus dann mit einem Objekt, das es nie gab.
   */
  const command = remoteDeployCommand({
    branch: "main",
    commit: "a".repeat(40),
    remoteDir: "/opt/gernetix",
    forceFullDeployment: true,
  });
  // Nach der Shell-Quotierung ist die leere Zuweisung nicht mehr woertlich
  // lesbar; die Zusicherung ist, dass kein Vergleichspunkt ermittelt wird.
  assert.doesNotMatch(command, /git rev-parse HEAD/);
  assert.match(command, /previous_commit=/);
  assert.match(remoteDeployCommand({ branch: "main", commit: "a".repeat(40), remoteDir: "/opt/gernetix" }), /git rev-parse HEAD/);
});

test("quotes remote values and deploys an exact commit", () => {
  assert.equal(shellQuote("/opt/gernetix"), "'/opt/gernetix'");
  const command = remoteDeployCommand({
    branch: "agent/staging",
    commit: "0123456789abcdef",
    remoteDir: "/opt/gernetix",
  });
  assert.match(command, /git fetch origin .*agent\/staging/);
  assert.match(command, /previous_commit=\$\(git rev-parse HEAD\)/);
  assert.match(command, /git switch --detach .*0123456789abcdef/);
  assert.match(command, /remote-deploy\.sh "\$previous_commit"/);
  assert.match(command, /flock -E 75 -n \/var\/lock\/gernetix-staging-deploy\.lock/);
});

/*
 * Ein erzwungener Vollauf muss auch einer sein.
 *
 * Der Server leitet den Modus aus der Differenz zum genannten Commit ab.
 * Frueher schickte --force-full HEAD^; betraf dieser eine Commit nur einen
 * Dienst, wurde daraus eine inkrementelle Auslieferung -- waehrend lokal
 * "full" gemeldet wurde. Bei der Wiederaufnahme eines abgebrochenen Laufs
 * lief die Reparatur so am kaputten Dienst vorbei.
 *
 * Ohne Vergleichspunkt hat der Server nichts abzuleiten.
 */
test("an explicit full deployment leaves the server nothing to derive from", () => {
  // Der Befehl ist fuer die Shell maskiert; geprueft wird die Aussage.
  const ohneMaskierung = (befehl) => befehl.split(`'"'"'`).join("'");

  const erzwungen = ohneMaskierung(remoteDeployCommand({
    branch: "main",
    commit: "0".repeat(40),
    remoteDir: "/opt/gernetix",
    forceFullDeployment: true,
  }));
  assert.match(erzwungen, /previous_commit=''/);
  assert.doesNotMatch(erzwungen, /previous_commit=\$\(git rev-parse HEAD\)/);

  const normal = ohneMaskierung(remoteDeployCommand({
    branch: "main",
    commit: "0".repeat(40),
    remoteDir: "/opt/gernetix",
  }));
  assert.match(normal, /previous_commit=\$\(git rev-parse HEAD\)/);
});

/*
 * Jede Naht zwischen zwei Diensten muss in der Zuordnung stehen.
 *
 * Bindet ein Dienst Code eines anderen ein, erreicht ihn eine Aenderung dort
 * nur, wenn die Zuordnung das weiss. Sonst laeuft er mit einer veralteten
 * Kopie weiter -- ohne Fehlermeldung, bis er darueber stolpert. Genau so ist
 * ein Deployment abgebrochen: admin-tool konnte das zum ES-Modul gewordene
 * Komponentenmetamodell nicht mehr laden, und der Fix erreichte ihn beim
 * naechsten Lauf nicht.
 *
 * Geprueft wird auch die Koernigkeit. Ein Blatt darf als Datei stehen; wer
 * am Einstiegspunkt eines Dienstes haengt, braucht dessen Verzeichnis, sonst
 * uebersieht die Zuordnung jede Aenderung eine Ebene tiefer.
 *
 * Diese Zusicherung hat zwei Naehte gefunden, die niemand erklaert hatte:
 * telemetry-server liest den MQTT-Transport von build-deploy-server, und
 * hardware-shop bindet den Einstiegspunkt von hardware-catalog ein.
 */
/*
 * Der Plan steht zweimal da -- und beide muessen dasselbe sagen.
 *
 * tools/staging-deploy.js berechnet ihn, um ihn anzuzeigen. Entschieden wird
 * er ein zweites Mal auf dem Server, in Bash, aus derselben Dateiliste. Die
 * lokale Fassung ist damit reine Auskunft; wer nur sie pflegt, aendert die
 * Anzeige und nicht das Verhalten.
 *
 * Genau das ist passiert: drei Eintraege -- .claude/, der Abhaengigkeitsgraph
 * und die Naht zu admin-tool -- standen nur in der JavaScript-Fassung. Die
 * Auslieferung richtete sich weiter nach der alten Bash-Fassung, und die
 * Abweichung fiel niemandem auf, weil die Anzeige ja stimmte.
 *
 * Solange es zwei Fassungen gibt, muss ihre Uebereinstimmung gepruefte
 * Tatsache sein und nicht Sorgfalt.
 */
test("the deployment plan says the same thing in both places", () => {
  const wurzel = path.resolve(__dirname, "..");
  const skript = fs.readFileSync(path.join(wurzel, "scripts/staging/remote-deploy.sh"), "utf8");

  const abweichungen = [];

  /*
   * Gesucht wird innerhalb EINES case-Zweigs, also bis zum naechsten ";;".
   *
   * Ein einfaches Fenster fester Laenge reicht in den folgenden Zweig hinein.
   * Beim Gegenpruefen bestand diese Zusicherung deshalb noch, nachdem
   * hardware-shop aus dem hardware-catalog-Zweig entfernt worden war: weiter
   * unten steht dieselbe Zeile fuer den eigenen Dienst von hardware-shop.
   */
  const imZweig = (kopf, dienst) => new RegExp(
    `${kopf}\\)(?:(?!;;)[\\s\\S])*?add_incremental_service ${dienst}\\b`,
  ).test(skript);

  // Verzeichniszuordnung: jede Zeile der JS-Karte muss im Skript stehen.
  for (const [verzeichnis, dienst] of incrementalServiceByDirectory) {
    if (!imZweig(`services/${verzeichnis}/\\*`, dienst)) {
      abweichungen.push(`Verzeichnis ${verzeichnis} -> ${dienst} fehlt im Serverskript`);
    }
  }

  // Naht auf Verzeichnisebene.
  for (const [verzeichnis, dienste] of additionalServicesByDirectory) {
    for (const dienst of dienste) {
      if (!imZweig(`services/${verzeichnis}/\\*`, dienst)) {
        abweichungen.push(`Naht ${verzeichnis} -> ${dienst} fehlt im Serverskript`);
      }
    }
  }

  // Naht auf Dateiebene: das genaue Muster muss vorkommen.
  for (const [datei, dienste] of additionalServicesByFile) {
    const maskiert = datei.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const dienst of dienste) {
      if (!imZweig(maskiert, dienst)) abweichungen.push(`Naht ${datei} -> ${dienst} fehlt im Serverskript`);
    }
    // Und sie muss vor der allgemeinen Zeile ihres Dienstes stehen.
    const dienstVerzeichnis = datei.match(/^services\/([^/]+)\//)[1];
    const stelleDatei = skript.indexOf(`${datei})`);
    const stelleAllgemein = skript.indexOf(`services/${dienstVerzeichnis}/*)`);
    if (stelleDatei >= 0 && stelleAllgemein >= 0 && stelleDatei > stelleAllgemein) {
      abweichungen.push(`${datei} steht im Serverskript hinter services/${dienstVerzeichnis}/* und wird nie erreicht`);
    }
  }

  // Was lokal ignoriert wird, muss auch der Server ignorieren.
  const ignoriert = ["docs", "data", "model", "tools/architecture-docs", "tools/code-dependency-graph", ".github", ".claude"];
  const ignorierZeile = skript.match(/^\s+(docs\/\*\|[^)]*)\)$/m);
  assert.notEqual(ignorierZeile, null, "Die Ignorierliste des Serverskripts wurde nicht gefunden");
  for (const eintrag of ignoriert) {
    if (!isIgnoredDeploymentFile(`${eintrag}/beispiel.js`)) abweichungen.push(`${eintrag} wird lokal nicht ignoriert`);
    if (!ignorierZeile[1].includes(`${eintrag}/*`)) abweichungen.push(`${eintrag} fehlt in der Ignorierliste des Serverskripts`);
  }

  assert.deepEqual(abweichungen, []);
});

test("every seam between two services is declared in the deployment plan", () => {
  const wurzel = path.resolve(__dirname, "..");
  const rel = (p) => path.relative(wurzel, p).replace(/\\/g, "/");
  const dienstVon = (p) => (rel(p).match(/^services\/([^/]+)\//) || [])[1];

  const jsDateien = (verzeichnis, gesammelt = []) => {
    if (!fs.existsSync(verzeichnis)) return gesammelt;
    for (const eintrag of fs.readdirSync(verzeichnis, { withFileTypes: true })) {
      if (["node_modules", "dist"].includes(eintrag.name)) continue;
      const voll = path.join(verzeichnis, eintrag.name);
      if (eintrag.isDirectory()) jsDateien(voll, gesammelt);
      else if (eintrag.name.endsWith(".js") && !eintrag.name.endsWith(".test.js")) gesammelt.push(voll);
    }
    return gesammelt;
  };

  const aufloesen = (vonDatei, angabe) => {
    const basis = path.resolve(path.dirname(vonDatei), angabe);
    return [basis, `${basis}.js`, path.join(basis, "index.js")]
      .find((k) => fs.existsSync(k) && fs.statSync(k).isFile()) || null;
  };

  const relativeBezuege = (datei) => [...fs.readFileSync(datei, "utf8").matchAll(/require\("(\.[^"]+)"\)/g)]
    .map((t) => aufloesen(datei, t[1]))
    .filter(Boolean);

  // Ein Blatt bindet nichts aus seinem eigenen Dienst ein.
  const istBlatt = (datei) => relativeBezuege(datei)
    .every((ziel) => dienstVon(ziel) !== dienstVon(datei));

  const alle = jsDateien(path.join(wurzel, "services"));
  const beanstandet = [];

  for (const datei of alle) {
    const verbraucher = dienstVon(datei);
    if (!verbraucher) continue;
    for (const ziel of relativeBezuege(datei)) {
      const anbieter = dienstVon(ziel);
      if (!anbieter || anbieter === verbraucher) continue;
      /*
       * services/shared/ ist keinem Dienst zugeordnet. Eine Aenderung dort
       * faellt darum auf eine vollstaendige Auslieferung zurueck und erreicht
       * jeden Leser -- die Naht ist durch Konstruktion abgedeckt.
       */
      if (anbieter === "shared") {
        assert.equal(incrementalServiceByDirectory.has(anbieter), false,
          "services/shared duerfte keinem einzelnen Dienst zugeordnet sein");
        continue;
      }

      const ueberVerzeichnis = incrementalServiceByDirectory.get(anbieter) === verbraucher
        || (additionalServicesByDirectory.get(anbieter) || []).includes(verbraucher);
      if (ueberVerzeichnis) continue;

      const ueberDatei = (additionalServicesByFile.get(rel(ziel)) || []).includes(verbraucher);
      if (ueberDatei && istBlatt(ziel)) continue;
      if (ueberDatei) {
        beanstandet.push(`${rel(ziel)} -> ${verbraucher}: als Datei eingetragen, haengt aber am Baum von ${anbieter}`);
        continue;
      }
      beanstandet.push(`${rel(ziel)} -> ${verbraucher}: nicht zugeordnet (${rel(datei)})`);
    }
  }

  assert.deepEqual(beanstandet, []);
});
