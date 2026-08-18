"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const root = __dirname;
const packagedFiles = [
  "desktop-main.js", "desktop-preload.js", "desktop-process-control.js",
  "public/desktop.html", "public/desktop-app.js", "public/styles.css",
];

function hash(file) {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function asarCli() {
  const store = path.join(root, "node_modules", ".pnpm");
  const packageDir = fs.readdirSync(store).find((name) => name.startsWith("@electron+asar@"));
  if (!packageDir) throw new Error("@electron/asar wurde im lokalen pnpm-Store nicht gefunden.");
  return path.join(store, packageDir, "node_modules", "@electron", "asar", "bin", "asar.js");
}

function appBundle() {
  const dist = path.join(root, "dist");
  for (const entry of fs.readdirSync(dist).filter((name) => name.startsWith("mac")).sort()) {
    const directory = path.join(dist, entry);
    const app = fs.readdirSync(directory).find((name) => name.endsWith(".app"));
    if (app) return path.join(directory, app);
  }
  throw new Error("Im dist-Verzeichnis wurde kein macOS-App-Bundle gefunden.");
}

function main() {
  const app = appBundle();
  const asar = path.join(app, "Contents", "Resources", "app.asar");
  assert.ok(fs.existsSync(asar), `app.asar fehlt in ${app}`);
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-process-monitor-bundle-"));
  try {
    execFileSync(process.execPath, [asarCli(), "extract", asar, temporary], { stdio:"pipe" });
    for (const relative of packagedFiles) {
      assert.equal(hash(path.join(temporary, relative)), hash(path.join(root, relative)), `${relative} ist im App-Bundle nicht aktuell.`);
    }
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const bundledPackage = JSON.parse(fs.readFileSync(path.join(temporary, "package.json"), "utf8"));
    assert.equal(bundledPackage.version, packageJson.version, "Die App-Version stimmt nicht mit package.json ueberein.");
    process.stdout.write(`Mac-Bundle verifiziert: ${app}\n`);
  } finally {
    fs.rmSync(temporary, { recursive:true, force:true });
  }
}

if (require.main === module) main();
