"use strict";

// Fuehrt alle *.test.js unter tools/ aus, die nicht in tools/ci/ci-test-policy.json
// ausgenommen sind. Bewusst per Glob statt per Namensliste: ein neuer Test unter
// tools/ laeuft dadurch automatisch in der CI mit, ohne Workflow-Aenderung.
//
//   node tools/ci/run-tools-tests.js           Tests ausfuehren
//   node tools/ci/run-tools-tests.js --list    nur auflisten
//
// Wird sowohl von der CI (als CLI) als auch vom lokalen Runner
// tools/ci/verify.js (als Modul) genutzt.

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const toolsRoot = path.join(repoRoot, "tools");

function collect(directory, found = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name.startsWith(".")) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) collect(absolute, found);
    else if (entry.isFile() && entry.name.endsWith(".test.js")) {
      found.push(path.relative(repoRoot, absolute).split(path.sep).join("/"));
    }
  }
  return found;
}

function resolveToolsTests() {
  const policy = JSON.parse(fs.readFileSync(path.join(__dirname, "ci-test-policy.json"), "utf8"));
  const excluded = policy.excludedToolsTests || {};
  const all = collect(toolsRoot).sort();

  // Eine Ausnahme fuer eine Datei, die es nicht mehr gibt, verdeckt nur, dass die
  // Liste veraltet ist. Lieber laut scheitern als still weiterlaufen.
  const stale = Object.keys(excluded).filter((file) => !all.includes(file));

  return {
    all,
    selected: all.filter((file) => !excluded[file]),
    skipped: all.filter((file) => excluded[file]).map((file) => ({ file, reason: excluded[file] })),
    stale,
  };
}

function main() {
  const { all, selected, skipped, stale } = resolveToolsTests();

  if (stale.length) {
    console.error("Veraltete Eintraege unter excludedToolsTests in tools/ci/ci-test-policy.json:");
    for (const file of stale) console.error(`  - ${file} (Datei existiert nicht)`);
    process.exit(1);
  }

  console.log(`tools-Tests: ${selected.length} von ${all.length}`);
  for (const entry of skipped) console.log(`  uebersprungen: ${entry.file}\n      Grund: ${entry.reason}`);

  if (process.argv.includes("--list")) {
    for (const file of selected) console.log(file);
  } else {
    const result = spawnSync(process.execPath, ["--test", ...selected], {
      cwd: repoRoot,
      stdio: "inherit",
    });
    if (result.error) throw result.error;
    process.exit(result.status === null ? 1 : result.status);
  }
}

if (require.main === module) main();

module.exports = { resolveToolsTests };
