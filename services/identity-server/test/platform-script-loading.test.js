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

test("the module choice is opt-in for every call site", () => {
  // Pauschal umgestellt wuerden die Globalen der 28 nachgeladenen Dateien
  // verschwinden und die Anwendung an vielen Stellen zugleich brechen.
  const aufrufe = [...shellQuelle.matchAll(/loadPlatformScript\([^)]*\)/g)].map((t) => t[0]);
  assert.ok(aufrufe.length > 10, `Zu wenige Aufrufstellen gefunden: ${aufrufe.length}`);
  const alsModul = aufrufe.filter((a) => a.includes("module"));
  assert.deepEqual(alsModul, [], "noch ist keine nachgeladene Datei ein Modul");
});
