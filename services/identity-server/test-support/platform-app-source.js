"use strict";

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const platformAppFiles = [
  "app-shell-early.js",
  // Der gemeinsame Zustand liegt seit der Entflechtung in einer eigenen
  // Datei und wird vor den Controllern geladen. Die Reihenfolge hier muss
  // der in index.html entsprechen, sie wird gegen sie geprueft.
  "platform-state.js",
  "platform-routing.js",
  "platform-components.js",
  "app-shell-controller.js",
  "app-dashboard-controller.js",
  "app-community-controller.js",
  "app-account-controller.js",
  "app-project-controller.js",
  "app-ide-controller.js",
  // Statuszeile und Terminal der Werkbank. Wird mit dem Bau-Paket nachgeladen
  // und vom Bau-Controller eingefuehrt, steht also vor ihm.
  "workbench-output-view.js",
  "app-device-build-controller.js",
  "app-billing-controller.js",
  "app-runtime-utils.js",
  "app-push-controller.js",
  "app.js",
  "device-debug-controller.js",
  "app-event-bindings.js",
];
const routeLazyPlatformAppFiles = new Set([
  "app-community-controller.js",
  "app-ide-controller.js",
  "workbench-output-view.js",
  "app-device-build-controller.js",
  "device-debug-controller.js",
]);

function readPlatformAppSource() {
  return platformAppFiles.map((file) => readForSandbox(file)).join("\n");
}

/*
 * Das Dokument ohne seine Import Map.
 *
 * Zahlreiche Tests sichern zu, dass eine Datei NICHT im Dokument steht, weil
 * sie erst bei Bedarf nachgeladen wird. Seit die Map alle Modul-Adressen als
 * JSON auffuehrt, kommt jeder dieser Namen ein zweites Mal im Dokument vor,
 * und die Zusicherung schlaegt an, ohne dass sich am Laden etwas geaendert
 * haette. Geprueft werden soll der Rest des Dokuments.
 */
function scriptAbschnitt(html) {
  return html.replace(/<script type="importmap">[\s\S]*?<\/script>/, "");
}

/*
 * Position eines Skript-Tags in index.html.
 *
 * Aus demselben Grund wird hier das Tag gesucht und nicht der blosse Pfad:
 * der stuende sonst zuerst im Map-Eintrag, und jeder Reihenfolgevergleich
 * liefert dasselbe Ergebnis.
 */
function scriptPosition(html, file) {
  const maskiert = file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const treffer = html.match(new RegExp(`<script[^>]*src="/app/${maskiert}\\?v=`));
  return treffer ? treffer.index : -1;
}

/*
 * Quelltext einer Browser-Datei zum Ausfuehren in einer Sandbox.
 *
 * Umgestellte Dateien sind ES-Module. Ihre import- und export-Anweisungen sind
 * in einem klassischen vm-Kontext Syntaxfehler; node --test kann diese Tests
 * nicht als Module ausfuehren, ohne dass jede von ihnen umgeschrieben wird.
 *
 * Beides wird darum entfernt. Das ist kein Verlust an Aussagekraft: die Tests
 * legen die Namen, die sie brauchen, ohnehin selbst in den Kontext oder fuegen
 * die liefernde Datei daneben ein -- genau das taten sie schon, als noch alles
 * ueber den globalen Namensraum lief. Geprueft wird hier das Verhalten der
 * Funktionen, nicht die Modulverdrahtung; fuer die gibt es eigene Tests.
 */
function readForSandbox(file) {
  const quelle = fs.readFileSync(path.resolve(__dirname, "../public/app", file), "utf8");
  return quelle
    .replace(/^import [\s\S]*?;$/gm, "")
    .replace(/^export \{[\s\S]*?\};$/gm, "")
    .replace(/^export (?=(const|let|var|function|async function|class)\b)/gm, "");
}

/*
 * Eine Browser-Datei als CommonJS-Modul laden.
 *
 * Mehrere Tests binden UMD-Dateien direkt mit require ein und nutzen deren
 * module.exports. Sobald die Datei zusaetzlich eine export-Anweisung traegt,
 * lehnt der CommonJS-Lader sie ab -- die Datei ist dann fuer node beides und
 * damit keines von beidem.
 *
 * Hier wird sie darum selbst ausgewertet: Modulsyntax entfernt, in einem
 * Kontext ausgefuehrt, der wie ein Browser mit CommonJS aussieht, und
 * zurueckgegeben wird, was die Datei nach UMD-Art veroeffentlicht hat.
 */
const geladeneSandkastenModule = new Map();

function requireForSandbox(file) {
  /*
   * Wie bei require wird jede Datei nur einmal ausgewertet. Ohne das bekaeme
   * jeder Aufrufer eigene Objekte, und Tests, die Katalogeintraege ueber zwei
   * Dateien hinweg mit assert.equal auf Gleichheit pruefen, scheiterten an der
   * Identitaet statt an der Sache.
   */
  if (geladeneSandkastenModule.has(file)) return geladeneSandkastenModule.get(file);
  /*
   * Ausgefuehrt wird im selben Kontext, nur in einer Huelle -- so wie es
   * CommonJS selbst macht. Ein eigener vm-Kontext haette eigene Prototypen;
   * ein dort erzeugtes Array ist dann kein Array dieses Prozesses mehr, und
   * assert.deepEqual scheiterte an der Herkunft statt am Inhalt.
   *
   * Das globale Objekt ist eine eigene Ablage: die Datei veroeffentlicht nach
   * UMD-Art dorthin, und der Testprozess bleibt sauber.
   */
  const modul = { exports: {} };
  const ablage = {};
  const huelle = vm.runInThisContext(
    `(function (module, exports, window, globalThis) {\n${readForSandbox(file)}\n})`,
    { filename: file },
  );
  huelle(modul, modul.exports, undefined, ablage);
  geladeneSandkastenModule.set(file, modul.exports);
  return modul.exports;
}

module.exports = {
  platformAppFiles,
  scriptAbschnitt,
  requireForSandbox,
  readPlatformAppSource,
  routeLazyPlatformAppFiles,
  scriptPosition,
  readForSandbox,
};

