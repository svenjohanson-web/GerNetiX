"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appRoot = path.resolve(__dirname, "../public/app");
const shell = fs.readFileSync(path.join(appRoot, "app-shell-controller.js"), "utf8");
const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");

const MODULSYNTAX = /^\s*(?:import\s|export\s*[{*]|export\s+(?:const|let|var|function|async|class)\b)/m;
const dateien = fs.readdirSync(appRoot).filter((n) => n.endsWith(".js"));
const quelle = (name) => fs.readFileSync(path.join(appRoot, name), "utf8");

/* Beim Start geladen: steht als Skript-Tag im Dokument. */
const beimStart = new Set(
  [...html.matchAll(/<script[^>]*src="\/app\/([a-z0-9-]+\.js)\?v=/g)].map((t) => t[1]),
);
/*
 * Bei Bedarf geladen: steht in einem loadPlatformScript-Aufruf der Schale --
 * oder in der Liste, aus der das Wissensportal seine Adressen bildet.
 */
const beiBedarf = new Set([
  ...[...shell.matchAll(/loadPlatformScript\(\s*(?:"|`)\/app\/([a-z0-9-]+\.js)\?v=/g)].map((t) => t[1]),
  ...[...(shell.match(/function knowledgeContentAssetUrls\(\)[\s\S]*?\n\}/)?.[0] || "")
    .matchAll(/"([a-z0-9-]+\.js)"/g)].map((t) => t[1]),
]);

function importierteDateien(name) {
  return [...quelle(name).matchAll(/from "@app\/([^"]+)"/g)].map((t) => t[1]);
}

/*
 * Die Regel, die die Aufteilung der Anwendung traegt.
 *
 * IDE, Gerätebau, Fehlersuche, Community und Wissensportal werden erst
 * geladen, wenn ihre Route betreten wird. Ein import ist aber eine feste
 * Abhaengigkeit: der Browser holt das Modul, bevor der Leser laeuft. Fuehrte
 * die Schale den IDE-Controller ein, kaeme er bei jedem Seitenaufruf mit --
 * die Aufteilung waere dahin, und niemand saehe es, weil alles weiter
 * funktioniert. Nur langsamer.
 *
 * Fuer diese Richtung bleibt der Zugriff ueber den globalen Namensraum, den
 * die betroffenen Dateien mit einer ausdruecklichen Bruecke bedienen. Der Weg
 * dort heraus ist nicht der import, sondern die Registratur in
 * platform-components.js: sie nimmt eine Fabrik entgegen und ruft sie erst,
 * wenn der Baustein gebraucht wird.
 */
test("a file loaded at startup never imports one that is loaded on demand", () => {
  const verstoesse = [];
  for (const name of dateien) {
    if (!beimStart.has(name)) continue;
    for (const ziel of importierteDateien(name)) {
      if (beiBedarf.has(ziel)) verstoesse.push(`${name} fuehrt ${ziel} ein, obwohl ${ziel} erst bei Bedarf geladen wird`);
    }
  }
  assert.deepEqual(verstoesse, []);
});

/*
 * Eine Bruecke ist eine Ausnahme und muss sich begruenden lassen.
 *
 * Waehrend der Umstellung trug fast jede Datei eine; sie sind verschwunden,
 * sobald ihr letzter globaler Leser den Namen einfuehrte. Was bleibt, bleibt
 * aus dem Grund oben. Faende sich eine Bruecke an einer Datei, die beim Start
 * geladen wird, waere sie Rest und kein Entwurf.
 */
test("every remaining bridge belongs to a file that is loaded on demand", () => {
  const unbegruendet = [];
  for (const name of dateien) {
    if (!quelle(name).includes("/* ---- Uebergangsbruecke ---- */")) continue;
    if (!beiBedarf.has(name)) unbegruendet.push(name);
  }
  assert.deepEqual(unbegruendet, []);
});

/*
 * Die Plattform besteht aus Modulen, nicht aus einem geteilten Namensraum.
 *
 * Eine einzige Ausnahme ist beabsichtigt: initial-view-router.js waehlt die
 * Ansicht, bevor gezeichnet wird. Als Modul wuerde es aufgeschoben, und beim
 * Aufruf einer Unterseite blitzte kurz das Dashboard auf.
 */
test("every script in the platform document is a module, except the one that must not be", () => {
  const klassisch = [...html.matchAll(/<script([^>]*)src="\/app\/([a-z0-9-]+\.js)\?v=/g)]
    .filter((t) => !/type="module"/.test(t[1]))
    .map((t) => t[2]);
  assert.deepEqual(klassisch, ["initial-view-router.js"]);
  assert.doesNotMatch(quelle("initial-view-router.js"), MODULSYNTAX);
});
