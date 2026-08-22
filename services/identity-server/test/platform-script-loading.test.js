"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const shellQuelle = fs.readFileSync(
  path.resolve(__dirname, "../public/app/app-shell-controller.js"),
  "utf8",
);

/*
 * Geprueft wird das Verhalten, nicht der Wortlaut: die Funktion wird
 * ausgeschnitten und mit einem nachgebildeten Dokument ausgefuehrt. So bleibt
 * der Test gueltig, wenn die Zeile umformuliert wird, und faellt, wenn die
 * Wahlmoeglichkeit verlorengeht.
 */
function ladeFunktion() {
  const treffer = shellQuelle.match(/function loadPlatformScript\(src, options = \{\}\) \{[\s\S]*?\n\}\n/);
  assert.notEqual(treffer, null, "loadPlatformScript nicht gefunden");
  return treffer[0];
}

function umgebung() {
  const erzeugte = [];
  const document = {
    querySelector: () => null,
    createElement: () => {
      const element = { dataset: {}, addEventListener() {}, remove() {} };
      erzeugte.push(element);
      return element;
    },
    head: { append() {} },
  };
  const kontext = { document, CSS: { escape: (wert) => wert } };
  vm.runInNewContext(`${ladeFunktion()}\nglobalThis.__laden = loadPlatformScript;`, kontext);
  return { laden: kontext.__laden, erzeugte };
}

test("dynamically loaded scripts stay classic unless a module is asked for", () => {
  const { laden, erzeugte } = umgebung();
  void laden("/app/beispiel.js?v=1");
  assert.equal(erzeugte.length, 1);
  assert.equal(erzeugte[0].type, undefined, "ohne Angabe darf kein Modul entstehen");
  assert.equal(erzeugte[0].src, "/app/beispiel.js?v=1");
});

test("a lazily loaded file can be requested as a module", () => {
  // Ohne diese Moeglichkeit koennte keine der ueber loadPlatformScript
  // nachgeladenen Dateien je ein ES-Modul werden.
  const { laden, erzeugte } = umgebung();
  void laden("/app/beispiel.js?v=1", { module: true });
  assert.equal(erzeugte.length, 1);
  assert.equal(erzeugte[0].type, "module");
});

/*
 * Die Wahl muss zur Datei passen -- in beide Richtungen.
 *
 * Ein Modul in einem klassischen Skript-Tag ist ein Syntaxfehler: die Datei
 * laeuft dann ueberhaupt nicht, und alles, was sie bereitstellt, fehlt. Der
 * umgekehrte Fall ist stiller, aber ebenso falsch: eine klassische Datei als
 * Modul geladen behaelt ihre Namen fuer sich, und ihre Leser finden nichts.
 *
 * Beides laesst sich nicht durch Hinsehen ausschliessen, weil die Angabe an
 * der Aufrufstelle steht und die Wahrheit in der Datei.
 */
test("every lazily loaded file is loaded the way it is written", () => {
  const aufrufe = [...shellQuelle.matchAll(/loadPlatformScript\(\s*(?:"|`)(\/app\/[^"`?]+\.js)\?v=[^"`]*(?:"|`)([^)]*)\)/g)];
  assert.ok(aufrufe.length > 10, `Zu wenige Aufrufstellen gefunden: ${aufrufe.length}`);

  const falsch = [];
  for (const [, pfad, rest] of aufrufe) {
    const datei = path.resolve(__dirname, "..", "public", pfad.replace(/^\//, ""));
    if (!fs.existsSync(datei)) { falsch.push(`${pfad}: Datei fehlt`); continue; }
    const istModul = /^\s*(?:import\s|export\s*[{*]|export\s+(?:const|let|var|function|async|class)\b)/m
      .test(fs.readFileSync(datei, "utf8"));
    const alsModul = /module:\s*true/.test(rest);
    if (istModul && !alsModul) falsch.push(`${pfad} ist ein Modul, wird aber klassisch geladen`);
    if (!istModul && alsModul) falsch.push(`${pfad} ist klassisch, wird aber als Modul geladen`);
  }
  assert.deepEqual(falsch, []);
});

/*
 * Dieselbe Frage fuer die Skript-Tags in allen ausgelieferten Seiten.
 *
 * Vier Dateien aus /app/ werden auch von anderen Seiten geladen -- der
 * FlashBox-Einrichtung, dem Nexi-Sprachassistenten, der Anmeldung. Als eine
 * davon zum Modul wurde, blieben deren Tags klassisch, und die Seiten brachen
 * mit einem Syntaxfehler. Kein Test der Plattform konnte das sehen, weil er
 * nur in app/index.html schaute.
 */
test("every page loads a module file as a module", () => {
  const oeffentlich = path.resolve(__dirname, "../public");
  const seiten = [];
  const sammle = (verzeichnis) => {
    for (const eintrag of fs.readdirSync(verzeichnis, { withFileTypes: true })) {
      const voll = path.join(verzeichnis, eintrag.name);
      if (eintrag.isDirectory()) { if (eintrag.name !== "node_modules") sammle(voll); }
      else if (eintrag.name.endsWith(".html")) seiten.push(voll);
    }
  };
  sammle(oeffentlich);

  const falsch = [];
  for (const seite of seiten) {
    const html = fs.readFileSync(seite, "utf8");
    const wo = path.relative(oeffentlich, seite).replace(/\\/g, "/");
    for (const t of html.matchAll(/<script([^>]*?)src="([^"?]+\.js)(?:\?[^"]*)?"/g)) {
      const [, attribute, verweis] = t;
      if (/^https?:/.test(verweis)) continue;
      const datei = verweis.startsWith("/")
        ? path.join(oeffentlich, verweis.slice(1))
        : path.resolve(path.dirname(seite), verweis);
      if (!fs.existsSync(datei)) continue;
      const istModul = /^\s*(?:import\s|export\s*[{*]|export\s+(?:const|let|var|function|async|class)\b)/m
        .test(fs.readFileSync(datei, "utf8"));
      const alsModul = /type="module"/.test(attribute);
      if (istModul && !alsModul) falsch.push(`${wo}: ${verweis} ist ein Modul, wird aber klassisch geladen`);
    }
  }
  assert.deepEqual(falsch, []);
});
