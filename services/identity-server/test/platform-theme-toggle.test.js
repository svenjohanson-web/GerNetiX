const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appRoot = path.join(__dirname, "..", "public", "app");
const read = (name) => fs.readFileSync(path.join(appRoot, name), "utf8");

const css = read("app.css");
const html = read("index.html");
const early = read("app-shell-early.js");

function block(quelle, selektor) {
  const start = quelle.indexOf(`${selektor} {`);
  assert.notEqual(start, -1, `${selektor} fehlt`);
  const ende = quelle.indexOf("}", start);
  return quelle.slice(start, ende);
}

function tokenMitFestemWert(inhalt) {
  const namen = new Set();
  for (const treffer of inhalt.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    const [, name, wert] = treffer;
    // Aliase wie --bg: var(--surface) folgen der Palette von selbst und
    // muessen deshalb nicht in beiden Bloecken stehen.
    if (wert.includes("var(")) continue;
    namen.add(name);
  }
  return namen;
}

test("the light platform palette answers every hard-coded token of the dark one", () => {
  // Ein einzelner vergessener Token faellt nicht auf: die Regel greift dann
  // weiterhin auf den dunklen Wert zurueck und erzeugt eine unlesbare Stelle
  // mitten in einer sonst hellen Oberflaeche. Deshalb wird hier vollstaendig
  // geprueft statt stichprobenartig.
  const dunkel = tokenMitFestemWert(block(css, ":root"));
  const hell = tokenMitFestemWert(block(css, 'html[data-public-theme="light"]'));

  const fehlend = [...dunkel].filter((name) => !hell.has(name));
  assert.deepEqual(fehlend, [], `Der Hellmodus laesst diese Token unbeantwortet: ${fehlend.join(", ")}`);
});

test("the dark palette stays the delivered fallback", () => {
  // :root bleibt dunkel. Faellt das JavaScript aus, das die Wahl anwendet,
  // erscheint die erprobte dunkle Oberflaeche statt einer halben Palette.
  assert.match(block(css, ":root"), /color-scheme: dark/);
  assert.match(block(css, 'html[data-public-theme="light"]'), /color-scheme: light/);
});

test("the chosen mode is applied before the stylesheets load", () => {
  // Wird das Attribut erst nach dem Aufbau des Dokuments gesetzt, blitzt die
  // dunkle Auslieferungsfarbe sichtbar auf.
  const skript = html.indexOf("dataset.publicTheme");
  const erstesStylesheet = html.indexOf('<link rel="stylesheet"');
  assert.notEqual(skript, -1, "Das Dokument wendet die Farbwahl nicht selbst an");
  assert.ok(skript < erstesStylesheet, "Die Farbwahl wird erst nach dem ersten Stylesheet angewendet");
  assert.doesNotMatch(
    html.slice(skript - 200, skript),
    /<script[^>]*\bdefer\b[^>]*>\s*$/,
    "Die Farbwahl darf nicht in einem Skript mit defer stehen",
  );
});

test("platform and public pages share one stored preference", () => {
  // Sonst muesste dieselbe Person ihre Wahl zweimal treffen und die Plattform
  // widerspraeche der Startseite, von der sie gerade kam.
  const landing = fs.readFileSync(path.join(__dirname, "..", "public", "landing.js"), "utf8");
  assert.match(landing, /"gernetix-public-theme"/);
  assert.match(early, /"gernetix-public-theme"/);
  assert.match(html, /gernetix-public-theme/);
});

test("the platform offers a reachable switch", () => {
  assert.match(html, /id="platformThemeToggle"[^>]*type="button"/);
  assert.match(html, /id="platformThemeToggle"[^>]*aria-label=/);
  assert.match(early, /#platformThemeToggle/);
  assert.match(early, /aria-pressed/);
  assert.match(css, /\.platform-theme-toggle \{/);
});

test("the light overrides never leak into the dark mode", () => {
  // Der Abschnitt am Dateiende korrigiert Regeln, die ihre Farbe fest setzen.
  // Jede einzelne Zeile darf nur unter dem Attribut greifen; eine ohne
  // Praefix wuerde den Dunkelmodus veraendern.
  const marke = css.indexOf("/* ==== Hellmodus: Ausnahmen von der Token-Palette");
  assert.notEqual(marke, -1, "Der Abschnitt mit den Hellmodus-Ausnahmen fehlt");
  // Kommentare zuerst entfernen: Kommas in Fliesstext wuerden sonst als
  // Selektorgrenzen gelesen.
  const abschnitt = css.slice(marke).replace(/\/\*[\s\S]*?\*\//g, "");

  const selektoren = [...abschnitt.matchAll(/(^|,)\s*([^,{}]+?)\s*(?=[,{])/gm)]
    .map((treffer) => treffer[2].trim())
    .filter((selektor) => selektor && !selektor.startsWith("/*") && !selektor.startsWith("*"));

  assert.ok(selektoren.length > 100, `Zu wenige Selektoren gefunden: ${selektoren.length}`);
  const ungeschuetzt = selektoren.filter((selektor) => !selektor.startsWith('html[data-public-theme="light"]'));
  assert.deepEqual(ungeschuetzt, [], `Diese Selektoren wirken in beiden Modi: ${ungeschuetzt.slice(0, 5).join(" | ")}`);
});
