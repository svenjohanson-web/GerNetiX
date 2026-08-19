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
 */
const fs = require("node:fs");
const { ermittleStand, liesManifest, MANIFEST } = require("./asset-versions");

const nurPruefen = process.argv.includes("--pruefen");
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
