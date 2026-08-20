"use strict";

const fs = require("node:fs");
const path = require("node:path");

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
  "app-device-build-controller.js",
  "device-debug-controller.js",
]);

function readPlatformAppSource() {
  return platformAppFiles.map((file) => readForSandbox(file)).join("\n");
}

/*
 * Position eines Skript-Tags in index.html.
 *
 * Seit der Import Map im Dokumentkopf stehen dieselben Adressen ein zweites
 * Mal im Dokument -- als JSON. Eine Suche nach dem blossen Pfad findet dann
 * den Map-Eintrag, der immer zuerst kommt, und jeder Reihenfolgevergleich
 * liefert dasselbe Ergebnis. Geprueft werden muss das Tag.
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

module.exports = {
  platformAppFiles,
  readPlatformAppSource,
  routeLazyPlatformAppFiles,
  scriptPosition,
  readForSandbox,
};
