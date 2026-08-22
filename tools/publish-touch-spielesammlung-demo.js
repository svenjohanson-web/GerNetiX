#!/usr/bin/env node
"use strict";

// Builds the immutable public-demo payload locally and streams it through the
// private staging SSH connection. The signing key is used only by the Identity
// container on the VPS and is never read by this process.

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const { assertSafeSshTarget, parseEnvFile, shellQuote } = require("./staging-deploy");

const DEMO_ID = "touch-spielesammlung";
const SOURCE_ID = "gernetix-product-game-collection-esp32";
const PRODUCT_DIRECTORY = "spielesammlung-esp32-s3-touch";
const PLATFORMIO_ENVIRONMENT = "es3c28p";

function parseArgs(argv) {
  const allowed = new Set(["--dry-run", "--publish"]);
  for (const argument of argv) if (!allowed.has(argument)) throw new Error(`Unbekanntes Argument: ${argument}`);
  const dryRun = argv.includes("--dry-run");
  const publish = argv.includes("--publish");
  if (dryRun === publish) throw new Error("Genau eines von --dry-run oder --publish muss angegeben werden.");
  return { dryRun, publish };
}

function repositoryPath(env = process.env) {
  if (env.REPOSITORY_PATH) return path.resolve(env.REPOSITORY_PATH);
  return path.resolve(__dirname, "..", "..", "GerNetiX-Projekte", PRODUCT_DIRECTORY);
}

function git(repoPath, args) {
  return execFileSync("git", args, { cwd: repoPath, encoding: "utf8" }).trim();
}

function assertCleanAndPushed(repoPath) {
  if (git(repoPath, ["status", "--porcelain"])) {
    throw new Error("Der Arbeitsbaum des Firmware-Repositories ist nicht sauber. Erst bewusst committen und pushen.");
  }
  const commit = git(repoPath, ["rev-parse", "HEAD"]);
  let upstream;
  try {
    upstream = git(repoPath, ["rev-parse", "@{upstream}"]);
  } catch {
    throw new Error("Das Firmware-Repository besitzt keinen Upstream-Branch. Erst den Forgejo-Branch pushen.");
  }
  if (commit !== upstream) throw new Error("Der aktuelle Firmware-Commit ist noch nicht zu Forgejo gepusht.");
  return commit;
}

function resolveBuildCacheRoot(repoPath, env = process.env, platform = process.platform) {
  const configured = String(env.GERNETIX_LOCAL_BUILD_CACHE_DIR || "").trim();
  if (configured) return path.resolve(configured);
  if (platform !== "win32") return path.posix.join(repoPath, ".gernetix-build");
  /*
   * Ab hier gilt Windows-Semantik, auch wenn der Code anderswo laeuft.
   *
   * Das schlichte path-Modul richtet sich nach dem ausfuehrenden System: unter
   * Linux erkennt path.parse("C:\\...") kein Laufwerk und liefert eine leere
   * Wurzel. Der platform-Parameter waere dann wirkungslos -- die Funktion gaebe
   * je nach Rechner ein anderes Ergebnis fuer denselben Pfad.
   */
  const win = path.win32;
  const repositoryName = win.basename(win.resolve(repoPath)) || "project";
  const suffix = repositoryName.replace(/[^a-zA-Z0-9._-]/g, "").slice(0, 16) || "project";
  const driveRoot = win.parse(repoPath).root;
  if (driveRoot) return win.join(driveRoot, "g", "gernetix-build", suffix);
  const temporaryRoot = env.TEMP || env.TMP;
  return temporaryRoot ? win.join(temporaryRoot, "gernetix-build", suffix) : win.join(repoPath, ".gernetix-build");
}

function findBuildWorkspace(repoPath, env = process.env) {
  const cacheDirectory = path.join(resolveBuildCacheRoot(repoPath, env), "cache");
  if (!fs.existsSync(cacheDirectory)) throw new Error(`Build-Cache fehlt: ${cacheDirectory}. Erst build.bat ausfuehren.`);
  const candidates = fs.readdirSync(cacheDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith(`${SOURCE_ID}--`))
    .map((entry) => path.join(cacheDirectory, entry.name, "workspace"))
    .filter((workspace) => fs.existsSync(path.join(workspace, ".pio", "build", PLATFORMIO_ENVIRONMENT)))
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);
  if (!candidates.length) throw new Error(`Kein fertiger Build fuer ${SOURCE_ID} gefunden. Erst build.bat ausfuehren.`);
  return candidates[0];
}

function readArtifact(workspace, fileName) {
  const filePath = path.join(workspace, ".pio", "build", PLATFORMIO_ENVIRONMENT, fileName);
  if (!fs.existsSync(filePath)) throw new Error(`Build-Artefakt fehlt: ${filePath}`);
  return fs.readFileSync(filePath);
}

function createPayload({ commit, workspace, version = "1.0.0" }) {
  const bootloader = readArtifact(workspace, "bootloader.bin");
  const partitions = readArtifact(workspace, "partitions.bin");
  const firmware = readArtifact(workspace, "firmware.bin");
  return {
    demo_id: DEMO_ID,
    title: "Touch-Spielesammlung: Nibbles und Frogger",
    description: "Eine kleine Spieleauswahl fuer das ESP32-S3 ES3C28P Touch-Board. Der Startbildschirm waehlt Nibbles oder Frogger aus.",
    board_hardware_item_id: "hardware.processor_board.esp32_s3_es3c28p",
    category: "spiele",
    games: ["nibbles", "frogger"],
    version,
    firmware_file_name: "firmware.bin",
    firmware_sha256: crypto.createHash("sha256").update(firmware).digest("hex"),
    source_path: `gernetix-products/${PRODUCT_DIRECTORY}`,
    source_commit_sha: commit,
    flash_assets: [
      { asset_id: "bootloader", flash_offset: 0, base64: bootloader.toString("base64") },
      { asset_id: "partitions", flash_offset: 0x8000, base64: partitions.toString("base64") },
      { asset_id: "firmware", flash_offset: 0x10000, base64: firmware.toString("base64") },
    ],
  };
}

function loadStagingConfig(env = process.env) {
  const localPath = path.join(__dirname, "..", ".env.staging.local");
  const fileValues = fs.existsSync(localPath) ? parseEnvFile(fs.readFileSync(localPath, "utf8")) : {};
  return { ...fileValues, ...env };
}

function remotePublishCommand(remoteDirectory) {
  if (!String(remoteDirectory || "").startsWith("/")) throw new Error("GERNETIX_STAGING_DIR muss ein absoluter VPS-Pfad sein.");
  return `cd ${shellQuote(remoteDirectory)} && sh ./scripts/staging/publish-public-demo.sh`;
}

function publishViaVps(payload, config, spawn = spawnSync) {
  const host = assertSafeSshTarget(config.GERNETIX_STAGING_SSH || "");
  const remoteDirectory = config.GERNETIX_STAGING_DIR || "/opt/gernetix";
  const result = spawn("ssh", ["-o", "BatchMode=yes", host, remotePublishCommand(remoteDirectory)], {
    encoding: "utf8",
    input: JSON.stringify(payload),
    maxBuffer: 2 * 1024 * 1024,
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`Serverseitige Demo-Veroeffentlichung wurde mit Exit-Code ${result.status} beendet.`);
}

function payloadSummary(payload, repoPath, workspace) {
  return {
    demo_id: payload.demo_id,
    version: payload.version,
    source_commit_sha: payload.source_commit_sha,
    source_repository: repoPath,
    build_workspace: workspace,
    assets: payload.flash_assets.map((asset) => ({
      asset_id: asset.asset_id,
      flash_offset: asset.flash_offset,
      size_bytes: Buffer.from(asset.base64, "base64").length,
    })),
    firmware_sha256: payload.firmware_sha256,
  };
}

function main(argv = process.argv.slice(2), env = process.env) {
  const args = parseArgs(argv);
  const repoPath = repositoryPath(env);
  const commit = assertCleanAndPushed(repoPath);
  const workspace = findBuildWorkspace(repoPath, env);
  const payload = createPayload({ commit, workspace, version: env.DEMO_VERSION || "1.0.0" });
  process.stdout.write(`${JSON.stringify(payloadSummary(payload, repoPath, workspace), null, 2)}\n`);
  if (args.dryRun) {
    process.stdout.write("Dry-run abgeschlossen. Es wurden keine Daten gesendet.\n");
    return;
  }
  publishViaVps(payload, loadStagingConfig(env));
}

if (require.main === module) {
  try { main(); }
  catch (error) {
    process.stderr.write(`Public-Demo-Veroeffentlichung abgebrochen: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  assertCleanAndPushed,
  createPayload,
  findBuildWorkspace,
  parseArgs,
  publishViaVps,
  remotePublishCommand,
  resolveBuildCacheRoot,
};
