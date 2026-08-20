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
 * Welche Dateien ES-Module sind.
 *
 * Das entscheidet zweierlei: wie sie geparst werden muessen (export ist in
 * einem klassischen Skript ein Syntaxfehler) und ob ihre Deklarationen
 * global werden. In einem Modul werden sie es nicht -- global ist dort nur,
 * was ausdruecklich an globalThis zugewiesen wird.
 *
 * Entschieden wird am Inhalt, nicht am Skript-Tag. Die Haelfte der Plattform
 * wird ueber loadPlatformScript nachgeladen und steht in keinem Dokument;
 * solange die Antwort aus den Tags kam, galt jede dieser Dateien als
 * klassisch, und die Analyse brach an der ersten export-Anweisung ab.
 *
 * Ob eine Datei auch richtig eingebunden ist, ist eine andere Frage -- die
 * beantwortet platform-script-loading.test.js, und zwar in beide Richtungen.
 */
const MODULSYNTAX = /^\s*(?:import\s|export\s*[{*]|export\s+(?:const|let|var|function|async|class)\b)/m;

function modulDateien() {
  const namen = new Set();
  for (const name of browserDateien()) {
    if (MODULSYNTAX.test(fs.readFileSync(path.join(OEFFENTLICH, name), "utf8"))) namen.add(name);
  }
  return namen;
}

module.exports = { OEFFENTLICH, browserDateien, modulDateien };
