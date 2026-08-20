"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const dienstWurzel = path.resolve(__dirname, "../..");

/*
 * Ein Serverdienst darf keine Browser-Datei einbinden, die ein ES-Modul ist.
 *
 * admin-tool liest das Komponentenmetamodell aus public/app mit require, weil
 * Server und Browser dasselbe Modell brauchen. Als diese Datei zum ES-Modul
 * wurde, konnte der CommonJS-Lader sie nicht mehr lesen: der Dienst startete
 * nicht mehr, sein Healthcheck schlug fehl, und ein Deployment brach ab.
 *
 * Gefallen ist das erst auf dem Server. Die Testsuite von identity-server
 * sieht ihre eigenen Dateien an, nicht die Ladewege fremder Dienste -- und die
 * Umstellung lief mit einem Werkzeug, das nur unter services/identity-server
 * geschaut hat. Diese Zusicherung schaut in alle Dienste.
 */
const MODULSYNTAX = /^\s*(?:import\s|export\s*[{*]|export\s+(?:const|let|var|function|async|class)\b)/m;

function jsDateien(verzeichnis, gesammelt = []) {
  for (const eintrag of fs.readdirSync(verzeichnis, { withFileTypes: true })) {
    if (eintrag.name === "node_modules" || eintrag.name === "dist") continue;
    const voll = path.join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) jsDateien(voll, gesammelt);
    else if (eintrag.name.endsWith(".js")) gesammelt.push(voll);
  }
  return gesammelt;
}

test("no server file requires a browser file that is an ES module", () => {
  const verstoesse = [];
  for (const datei of jsDateien(dienstWurzel)) {
    if (/[\\/]public[\\/]/.test(datei)) continue;
    if (datei.endsWith(".test.js")) continue;
    const quelle = fs.readFileSync(datei, "utf8");
    for (const treffer of quelle.matchAll(/require\("([^"]*public\/app\/[^"]+)"\)/g)) {
      const angabe = treffer[1];
      const basis = path.resolve(path.dirname(datei), angabe);
      const ziel = [basis, `${basis}.js`].find((k) => fs.existsSync(k) && fs.statSync(k).isFile());
      const wo = path.relative(dienstWurzel, datei).replace(/\\/g, "/");
      if (!ziel) { verstoesse.push(`${wo}: ${angabe} existiert nicht`); continue; }
      if (MODULSYNTAX.test(fs.readFileSync(ziel, "utf8"))) {
        verstoesse.push(`${wo}: ${angabe} ist ein ES-Modul und laesst sich nicht mit require laden`);
      }
    }
  }
  assert.deepEqual(verstoesse, []);
});

/*
 * Die Gegenprobe: die Datei laesst sich wirklich laden und liefert das Modell.
 * Die Zusicherung oben prueft die Schreibweise, diese hier das Ergebnis --
 * sonst koennte die Datei aus einem anderen Grund unbrauchbar werden, ohne
 * dass es jemand vor dem naechsten Deployment bemerkt.
 */
test("admin-tool can still load the component metamodel it shares with the browser", () => {
  const metamodell = require("../public/app/development-component-metamodel");
  assert.equal(typeof metamodell, "object");
  assert.ok(Object.keys(metamodell.componentTypes || {}).length > 0);
  assert.equal(typeof metamodell.validatesRelation, "function");
});
