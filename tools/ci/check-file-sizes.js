"use strict";

/*
 * Groessen-Sperrklinke fuer getrackte JavaScript-Dateien.
 *
 * Eine blosse Obergrenze haette hier nichts bewirkt: 32 Dateien liegen bereits
 * darueber, und eine Ausnahmeliste in dieser Laenge ist keine Grenze mehr.
 *
 * Stattdessen haelt tools/ci/file-size-baseline.json fest, wie gross jede
 * grosse Datei zuletzt war. Wachsen darf keine von ihnen; schrumpfen jederzeit.
 * Eine neue Datei ueber der Grenze faellt auf und muss bewusst aufgenommen
 * werden. Die Baseline kann damit nur kleiner werden.
 *
 *   node tools/ci/check-file-sizes.js            pruefen
 *   node tools/ci/check-file-sizes.js --accept   Baseline fortschreiben
 *
 * Testdateien sind ausgenommen: mehr Testabdeckung ist erwuenscht, und eine
 * Sperrklinke darauf wuerde bei jeder neuen Zusicherung anschlagen.
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const baselinePath = path.join(__dirname, "file-size-baseline.json");

const LIMIT_BYTES = 40 * 1024;
// Erzeugte oder eingesammelte Dateien: ihre Groesse sagt nichts ueber die
// Wartbarkeit des Repositories aus.
const IGNORED = /(^|\/)(node_modules|dist|dist-web|\.pio)\//;

function trackedJavaScript() {
  const listed = spawnSync("git", ["ls-files", "-z", "*.js", "*.cjs", "*.mjs"], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (listed.error) throw listed.error;
  if (listed.status !== 0) {
    process.stderr.write(listed.stderr || "");
    process.exit(listed.status || 1);
  }
  return listed.stdout.split("\0").filter(Boolean)
    .filter((file) => !IGNORED.test(file) && !file.endsWith(".test.js"));
}

/*
 * Groesse mit normalisierten Zeilenenden.
 *
 * Die Dateigroesse auf der Platte haengt davon ab, ob das Arbeitsverzeichnis
 * CRLF oder LF fuehrt. Eine auf Windows erstellte Baseline waere auf Linux zu
 * gross und umgekehrt jede Datei "gewachsen". Gemessen wird deshalb die
 * normalisierte Fassung -- dieselbe Zahl auf jedem Arbeitsplatz.
 *
 * Vorgefiltert wird ueber die Dateigroesse: CRLF macht eine Datei nur groesser,
 * nie kleiner. Was schon auf der Platte unter der Grenze liegt, liegt es auch
 * normalisiert.
 */
function normalizedSize(absolute) {
  const source = fs.readFileSync(absolute, "utf8");
  return Buffer.byteLength(source.replace(/\r\n/g, "\n"), "utf8");
}

function currentSizes() {
  const sizes = {};
  for (const file of trackedJavaScript()) {
    const absolute = path.join(repoRoot, file);
    if (!fs.existsSync(absolute)) continue;
    if (fs.statSync(absolute).size <= LIMIT_BYTES) continue;
    const size = normalizedSize(absolute);
    if (size > LIMIT_BYTES) sizes[file] = size;
  }
  return sizes;
}

function kb(bytes) {
  return `${Math.round(bytes / 1024)} KB`;
}

const actual = currentSizes();

if (process.argv.includes("--accept")) {
  const sorted = Object.fromEntries(Object.entries(actual).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(baselinePath, `${JSON.stringify({
    hinweis: "Erzeugt von tools/ci/check-file-sizes.js. Werte duerfen nur sinken.",
    limit_bytes: LIMIT_BYTES,
    dateien: sorted,
  }, null, 2)}\n`);
  console.log(`Groessen-Baseline fortgeschrieben: ${Object.keys(sorted).length} Dateien ueber ${kb(LIMIT_BYTES)}.`);
  process.exit(0);
}

if (!fs.existsSync(baselinePath)) {
  console.error("tools/ci/file-size-baseline.json fehlt.");
  console.error("Einmalig anlegen: node tools/ci/check-file-sizes.js --accept");
  process.exit(1);
}

const baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
const erlaubt = baseline.dateien || {};
const gewachsen = [];
const neu = [];
const geschrumpft = [];

for (const [file, size] of Object.entries(actual)) {
  const vorher = erlaubt[file];
  if (vorher === undefined) neu.push({ file, size });
  else if (size > vorher) gewachsen.push({ file, size, vorher });
}
for (const [file, vorher] of Object.entries(erlaubt)) {
  const size = actual[file] ?? 0;
  if (size < vorher) geschrumpft.push({ file, size, vorher });
}

if (gewachsen.length || neu.length) {
  console.error("Groessen-Sperrklinke angeschlagen:\n");
  for (const entry of gewachsen) {
    console.error(`  gewachsen: ${entry.file}`);
    console.error(`             ${kb(entry.vorher)} -> ${kb(entry.size)}`);
  }
  for (const entry of neu) {
    console.error(`  neu ueber ${kb(LIMIT_BYTES)}: ${entry.file} (${kb(entry.size)})`);
  }
  console.error("\nGrosse Dateien sollen kleiner werden, nicht groesser. Neue Logik gehoert");
  console.error("in eine eigene Datei. Wenn das Wachstum begruendet ist, bewusst uebernehmen:");
  console.error("  node tools/ci/check-file-sizes.js --accept");
  process.exit(1);
}

const summe = Object.values(actual).reduce((total, size) => total + size, 0);
console.log(`Groessen-Sperrklinke: ${Object.keys(actual).length} Dateien ueber ${kb(LIMIT_BYTES)}, zusammen ${kb(summe)}.`);
if (geschrumpft.length) {
  console.log(`${geschrumpft.length} Datei(en) geschrumpft -- Baseline mit --accept nachziehen:`);
  for (const entry of geschrumpft.slice(0, 8)) {
    console.log(`  ${entry.file}: ${kb(entry.vorher)} -> ${entry.size ? kb(entry.size) : "unter der Grenze"}`);
  }
}
