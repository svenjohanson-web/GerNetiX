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

module.exports = { OEFFENTLICH, browserDateien };
