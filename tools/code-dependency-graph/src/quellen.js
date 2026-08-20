/*
 * Eine einzige Festlegung, welche Browser-Dateien zum Namensraum gehoeren.
 *
 * Werkzeug und Test hatten das kurzzeitig getrennt: das Werkzeug lief
 * rekursiv, der Test nur flach ueber public/app. Dadurch galt GerNetiXI18n
 * im Test als nirgends deklariert, obwohl es in public/app/i18n/i18n.js
 * steht. Zwei Dateilisten bedeuten zwei Wahrheiten.
 */
const fs = require("node:fs");
const path = require("node:path");

const OEFFENTLICH = path.join(__dirname, "..", "..", "..", "services", "identity-server", "public");

// Der Service Worker laeuft in einem eigenen globalen Namensraum.
const AUSGENOMMEN = new Set(["push-sw.js"]);

function browserDateien(verzeichnis = OEFFENTLICH, gesammelt = []) {
  for (const eintrag of fs.readdirSync(verzeichnis, { withFileTypes: true })) {
    const voll = path.join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      if (eintrag.name === "node_modules" || eintrag.name === "dist") continue;
      browserDateien(voll, gesammelt);
    } else if (eintrag.name.endsWith(".js") && !AUSGENOMMEN.has(eintrag.name)) {
      gesammelt.push(path.relative(OEFFENTLICH, voll).replace(/\\/g, "/"));
    }
  }
  return gesammelt.sort();
}

/*
 * Welche Dateien als ES-Modul eingebunden sind.
 *
 * Das entscheidet zweierlei: wie sie geparst werden muessen (export ist in
 * einem klassischen Skript ein Syntaxfehler) und ob ihre Deklarationen
 * global werden. In einem Modul werden sie es nicht -- global ist dort nur,
 * was ausdruecklich an globalThis zugewiesen wird.
 */
function htmlDateien(verzeichnis = OEFFENTLICH, gesammelt = []) {
  for (const eintrag of fs.readdirSync(verzeichnis, { withFileTypes: true })) {
    const voll = path.join(verzeichnis, eintrag.name);
    if (eintrag.isDirectory()) {
      if (eintrag.name === "node_modules" || eintrag.name === "dist") continue;
      htmlDateien(voll, gesammelt);
    } else if (eintrag.name.endsWith(".html")) gesammelt.push(voll);
  }
  return gesammelt;
}

function modulDateien() {
  const namen = new Set();
  for (const datei of htmlDateien()) {
    const text = fs.readFileSync(datei, "utf8");
    for (const treffer of text.matchAll(/<script([^>]*)src="\/([^"?]+\.js)[^"]*"/g)) {
      if (/type="module"/.test(treffer[1])) namen.add(treffer[2]);
    }
  }
  return namen;
}

module.exports = { OEFFENTLICH, browserDateien, modulDateien };
