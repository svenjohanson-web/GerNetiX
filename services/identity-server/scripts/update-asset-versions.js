#!/usr/bin/env node
/*
 * Schreibt asset-versions.json neu.
 *
 * Hier liegt die eigentliche Zusicherung: hat sich der Inhalt einer Datei
 * geaendert, ohne dass ihre Cache-Version angehoben wurde, verweigert das
 * Werkzeug den Dienst. Browser wuerden sonst die alte Fassung
 * weiterverwenden -- ein Fehler, der sich erst beim Nutzer zeigt und dort
 * kaum zuzuordnen ist.
 *
 * Aufruf: npm run assets:sync --prefix services/identity-server
 *         npm run assets:sync -- --pruefen   (nur melden, nichts schreiben)
 *         npm run assets:sync -- --anheben 20260820-esm-state-1
 *
 * --anheben setzt zuvor alle Dateien, deren Inhalt sich ohne Versionswechsel
 * geaendert hat, auf die angegebene Version. Das ist der Normalfall nach einer
 * Aenderung; ohne den Schalter meldet das Werkzeug nur und bricht ab.
 */
const fs = require("node:fs");
const { ermittleStand, liesManifest, MANIFEST, schreibeImportMap, hebeVersionenAn } = require("./asset-versions");

const nurPruefen = process.argv.includes("--pruefen");
const anhebenIndex = process.argv.indexOf("--anheben");
const neueVersion = anhebenIndex >= 0 ? process.argv[anhebenIndex + 1] : null;

if (anhebenIndex >= 0 && !/^[0-9a-z-]+$/.test(neueVersion || "")) {
  console.error("--anheben braucht eine Version, etwa: --anheben 20260820-esm-state-1");
  process.exit(1);
}

// Anheben muss vor der Import Map laufen: die Map leitet sich aus den
// Versionen im Dokument ab und wuerde sonst die alten uebernehmen.
if (neueVersion) {
  const { angehoben, konstanten } = hebeVersionenAn(neueVersion);
  if (angehoben.length === 0) console.log("Keine Datei brauchte eine neue Version.");
  else {
    console.log(`Auf ${neueVersion} angehoben: ${angehoben.length} Dateien.`);
    for (const p of angehoben) console.log(`  - ${p}`);
    for (const k of konstanten) console.log(`  (Ladegruppe ${k} mit angehoben)`);
  }
}

// Zuerst die Import Map nachziehen: sie leitet sich aus denselben Versionen ab.
if (!nurPruefen && schreibeImportMap()) console.log("Import Map nachgezogen.");

const { eintraege, widersprueche, fehlend, ohneVersion } = ermittleStand();
const vorher = liesManifest();

const fehler = [];

for (const w of widersprueche) {
  fehler.push(`${w.pfad} wird mit zwei Versionen ausgeliefert: ${w.versionen.join(" und ")} (${w.herkunft.join(", ")})`);
}
for (const p of fehlend) fehler.push(`${p} wird verwiesen, existiert aber nicht`);
for (const o of ohneVersion) fehler.push(`${o.pfad} in ${o.herkunft} traegt keine Cache-Version`);

if (vorher) {
  for (const [pfad, jetzt] of Object.entries(eintraege)) {
    const alt = vorher.dateien?.[pfad];
    if (!alt) continue;
    if (alt.pruefsumme !== jetzt.pruefsumme && alt.version === jetzt.version) {
      fehler.push(`${pfad} wurde geaendert, behaelt aber die Version ${jetzt.version} -- Browser liefern weiter die alte Fassung aus`);
    }
  }
}

if (fehler.length > 0) {
  console.error("Cache-Versionen nicht stimmig:\n");
  for (const f of fehler) console.error(`  - ${f}`);
  console.error("");
  process.exit(1);
}

const inhalt = {
  hinweis: "Erzeugt von scripts/update-asset-versions.js. Nicht von Hand bearbeiten.",
  dateien: eintraege,
};
const text = `${JSON.stringify(inhalt, null, 2)}\n`;

if (nurPruefen) {
  const gleich = fs.existsSync(MANIFEST) && fs.readFileSync(MANIFEST, "utf8").replace(/\r\n/g, "\n") === text;
  console.log(gleich ? "asset-versions.json ist aktuell." : "asset-versions.json ist veraltet.");
  process.exit(gleich ? 0 : 1);
}

fs.writeFileSync(MANIFEST, text, "utf8");
console.log(`asset-versions.json geschrieben: ${Object.keys(eintraege).length} Dateien.`);
