const assert = require("node:assert/strict");
const fs = require("node:fs");
const test = require("node:test");

const { ermittleStand, liesManifest, MANIFEST } = require("../scripts/asset-versions");

/*
 * Ersetzt 33 Zusicherungen, die in 17 Testdateien einzelne
 * Versionszeichenketten festnagelten.
 *
 * Die alten Pins kosteten bei jeder Aenderung eine Suche quer durch die
 * Suite und gerieten dabei untereinander in Widerspruch: dieselbe Datei war
 * an einer Stelle auf 20260805-shell-menu-1 und an anderer auf
 * 20260814-portfolio-guide-1 festgelegt. Drei Tests konnten deshalb
 * dauerhaft nicht gruen sein.
 *
 * Vor allem aber prueften sie die falsche Sache. Dass irgendwo eine
 * bestimmte Zeichenkette steht, sagt nichts darueber, ob Browser nach einer
 * Aenderung die neue Fassung laden. Genau das sichern diese Tests.
 */

const stand = ermittleStand();

test("no asset is delivered under two different cache versions", () => {
  // Zwei Versionen derselben Datei heissen: dieselbe Datei wird doppelt
  // geladen, und je nachdem welche Seite zuerst besucht wurde, liefert der
  // Browser danach die andere aus dem Zwischenspeicher.
  const meldungen = stand.widersprueche.map(
    (w) => `${w.pfad}: ${w.versionen.join(" und ")}`,
  );
  assert.deepEqual(meldungen, []);
});

test("every served browser asset carries a cache version", () => {
  // Ohne Version kann eine geaenderte Datei beliebig lange als alte Fassung
  // im Browser haengenbleiben.
  const meldungen = stand.ohneVersion.map((o) => `${o.pfad} in ${o.herkunft}`);
  assert.deepEqual(meldungen, []);
});

test("every referenced asset exists", () => {
  assert.deepEqual(stand.fehlend, []);
});

test("the recorded versions match what is actually served", () => {
  // Das Manifest ist die eingecheckte Momentaufnahme. Weicht es ab, wurde
  // eine Datei geaendert, ohne den Stand nachzufuehren -- und dann bleibt
  // unbemerkt, ob die Version mitgezogen wurde.
  const manifest = liesManifest();
  assert.notEqual(manifest, null, `${MANIFEST} fehlt`);

  const abweichend = [];
  for (const [pfad, jetzt] of Object.entries(stand.eintraege)) {
    const verzeichnet = manifest.dateien[pfad];
    if (!verzeichnet) { abweichend.push(`${pfad} ist neu und nicht verzeichnet`); continue; }
    if (verzeichnet.version !== jetzt.version) abweichend.push(`${pfad}: Version ${verzeichnet.version} verzeichnet, ausgeliefert ${jetzt.version}`);
    else if (verzeichnet.pruefsumme !== jetzt.pruefsumme) abweichend.push(`${pfad}: Inhalt geaendert, Version ${jetzt.version} unveraendert`);
  }
  for (const pfad of Object.keys(manifest.dateien)) {
    if (!stand.eintraege[pfad]) abweichend.push(`${pfad} ist verzeichnet, wird aber nicht mehr ausgeliefert`);
  }

  assert.deepEqual(
    abweichend,
    [],
    `Nach einer Aenderung an Browser-Dateien: npm run assets:sync --prefix services/identity-server\n${abweichend.join("\n")}`,
  );
});

test("the manifest stays machine-written", () => {
  // Von Hand gepflegt waere es wieder das, was ersetzt wurde.
  const text = fs.readFileSync(MANIFEST, "utf8");
  assert.match(text, /update-asset-versions\.js/);
  assert.ok(Object.keys(JSON.parse(text).dateien).length > 40);
});

test("no test pins a single cache version any more", () => {
  // Sonst waechst die alte Fesselung unbemerkt nach.
  const path = require("node:path");
  const testVerzeichnis = __dirname;
  const betroffen = [];
  for (const name of fs.readdirSync(testVerzeichnis)) {
    if (!name.endsWith(".test.js") || name === "asset-cache-versions.test.js") continue;
    const quelle = fs.readFileSync(path.join(testVerzeichnis, name), "utf8");
    for (const treffer of quelle.matchAll(/[^\n]*\?v=\d{8}[^\n]*/g)) {
      betroffen.push(`${name}: ${treffer[0].trim().slice(0, 80)}`);
    }
  }
  assert.deepEqual(betroffen, []);
});
