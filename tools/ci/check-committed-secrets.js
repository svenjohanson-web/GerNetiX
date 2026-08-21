"use strict";

/*
 * Sucht versehentlich eingecheckte Zugangsdaten in getrackten Dateien.
 *
 * Ergaenzt tools/verify-internal-network-boundary.js: der prueft, ob interne
 * Signaturschluessel in Browser-Artefakte oder URLs geraten. Hier geht es um
 * den anderen Fall -- eine .env mit echten Werten oder ein privater Schluessel,
 * der versehentlich mitgegeben wurde.
 *
 * Bewusst nur eindeutige Muster. Ein Waechter, der bei jedem zweiten Lauf
 * grundlos anschlaegt, wird abgeschaltet oder ignoriert; dann schuetzt er nicht
 * mehr. Erkannt wird deshalb nur, was praktisch nie ein Fehlalarm ist.
 */

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");

const MUSTER = [
  ["privater Schluessel", /-----BEGIN (?:RSA |EC |OPENSSH |PGP |DSA )?PRIVATE KEY-----/],
  ["GitHub-Token", /\bgh[pousr]_[A-Za-z0-9]{36,}\b/],
  ["AWS-Zugriffsschluessel", /\bAKIA[0-9A-Z]{16}\b/],
  ["Slack-Token", /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/],
  ["PuTTY-Schluessel", /^PuTTY-User-Key-File-\d/m],
];

// Dateien, die per Zweck Beispielwerte tragen. Sie werden nicht uebersprungen,
// sondern nur von der .env-Regel ausgenommen -- ein echter privater Schluessel
// bleibt auch in einer .example-Datei ein Fund.
const BEISPIEL = /\.(?:example|sample|template|dist)$/;

function trackedFiles() {
  const listed = spawnSync("git", ["ls-files", "-z"], { cwd: repoRoot, encoding: "utf8" });
  if (listed.error) throw listed.error;
  if (listed.status !== 0) {
    process.stderr.write(listed.stderr || "");
    process.exit(listed.status || 1);
  }
  return listed.stdout.split("\0").filter(Boolean);
}

const funde = [];

for (const file of trackedFiles()) {
  const absolute = path.join(repoRoot, file);
  if (!fs.existsSync(absolute)) continue;

  const basename = path.basename(file);

  // Eine getrackte .env-Datei ist der haeufigste Weg, auf dem Zugangsdaten in
  // ein Repository geraten. Vorlagen sind ausgenommen.
  if (/^\.env(\..+)?$/.test(basename) && !BEISPIEL.test(basename)) {
    funde.push(`${file}: .env-Datei ist eingecheckt. Nur .example-Vorlagen gehoeren ins Repository.`);
  }

  const { size } = fs.statSync(absolute);
  if (size > 2 * 1024 * 1024) continue;

  let source;
  try { source = fs.readFileSync(absolute, "utf8"); } catch { continue; }
  if (source.includes("\0")) continue;

  for (const [label, muster] of MUSTER) {
    if (muster.test(source)) funde.push(`${file}: ${label} gefunden.`);
  }
}

if (funde.length) {
  console.error("Moegliche eingecheckte Zugangsdaten:\n");
  for (const fund of funde) console.error(`  - ${fund}`);
  console.error("\nEin einmal gepushtes Geheimnis gilt als kompromittiert: zuerst beim");
  console.error("ausstellenden Dienst zurueckziehen und neu ausstellen, danach aus dem");
  console.error("Repository entfernen. Das Entfernen allein genuegt nicht.");
  process.exit(1);
}

console.log("Keine eingecheckten Zugangsdaten gefunden.");
