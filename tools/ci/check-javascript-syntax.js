"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const listed = spawnSync("git", ["ls-files", "-z", "*.js", "*.cjs", "*.mjs"], {
  cwd: repoRoot,
  encoding: "utf8",
});
if (listed.error) throw listed.error;
if (listed.status !== 0) {
  process.stderr.write(listed.stderr || "");
  process.exit(listed.status || 1);
}

const files = listed.stdout.split("\0").filter(Boolean);
const concurrency = Math.min(8, Math.max(2, os.availableParallelism?.() || os.cpus().length));
const failures = [];
let nextIndex = 0;

function runCheck(args, input) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, args, {
      cwd: repoRoot,
      stdio: [input === undefined ? "ignore" : "pipe", "ignore", "pipe"],
    });
    let stderr = "";
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", (error) => resolve({ ok: false, message: error.message }));
    child.on("exit", (code) => resolve({
      ok: code === 0,
      message: stderr.trim() || `exit ${code}`,
    }));
    if (input !== undefined) {
      child.stdin.on("error", () => {});
      child.stdin.end(input);
    }
  });
}

// Das Browser-Frontend liegt als ES-Module in .js-Dateien, ohne "type": "module"
// in einer package.json. `node --check` liest die deshalb als CommonJS und
// scheitert an import/export. Solche Dateien werden ueber stdin als Modul
// nachgeprueft. Erst CommonJS, dann ESM: so kann kein bisher erkannter
// Syntaxfehler durchrutschen.
const ESM_MARKER = /^\s*(?:import|export)[\s{*]/m;

async function check(file) {
  // Die Modulform vorab am Inhalt bestimmen, damit im Regelfall ein einziger
  // Prozess reicht. Eine Datei zu lesen kostet ungleich weniger, als node ein
  // zweites Mal zu starten.
  const source = fs.readFileSync(path.join(repoRoot, file), "utf8");
  const first = ESM_MARKER.test(source)
    ? await runCheck(["--input-type=module", "--check"], source)
    : await runCheck(["--check", file]);
  if (first.ok) return;

  // Die Heuristik kann danebenliegen -- etwa wenn "export" nur in einem String
  // steht. Deshalb die andere Form gegenpruefen, bevor ein Fehler gemeldet wird.
  const second = ESM_MARKER.test(source)
    ? await runCheck(["--check", file])
    : await runCheck(["--input-type=module", "--check"], source);
  if (!second.ok) failures.push({ file, message: first.message });
}

async function worker() {
  while (nextIndex < files.length) {
    const file = files[nextIndex++];
    await check(file);
  }
}

Promise.all(Array.from({ length: concurrency }, worker)).then(() => {
  if (failures.length) {
    for (const failure of failures) console.error(`\n${failure.file}\n${failure.message}`);
    process.exitCode = 1;
    return;
  }
  console.log(`JavaScript syntax valid: ${files.length} tracked files`);
});
