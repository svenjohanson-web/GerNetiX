"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const buildRoot = path.join(root, "build");
const app = path.join(buildRoot, "GerNetiX Serial Service.app");
const executable = path.join(app, "Contents", "MacOS", "GerNetiX Serial Service");
const resources = path.join(app, "Contents", "Resources");
const espflashTarget = path.join(resources, "espflash");

function buildNativeService() {
  if (process.platform !== "darwin") throw new Error("Der native macOS-WebHelper kann nur auf macOS gebaut werden.");
  const espflashSource = resolveEspflash();
  fs.rmSync(app, { recursive: true, force: true });
  fs.mkdirSync(path.dirname(executable), { recursive: true });
  fs.mkdirSync(resources, { recursive: true });

  const moduleCache = path.join(buildRoot, "module-cache");
  fs.mkdirSync(moduleCache, { recursive: true });
  execFileSync("xcrun", [
    "swiftc",
    "-swift-version", "5",
    "-target", "arm64-apple-macos13.0",
    "-Osize",
    "-whole-module-optimization",
    "-framework", "Network",
    "-framework", "Security",
    path.join(root, "native", "main.swift"),
    "-o", executable,
  ], {
    cwd: root,
    env: {
      ...process.env,
      CLANG_MODULE_CACHE_PATH: moduleCache,
      SWIFT_MODULECACHE_PATH: moduleCache,
    },
    stdio: "inherit",
  });
  fs.copyFileSync(espflashSource, espflashTarget);
  copyEspflashLicenses(espflashSource, resources);
  fs.chmodSync(executable, 0o755);
  fs.chmodSync(espflashTarget, 0o755);
  fs.copyFileSync(path.join(root, "install", "macos", "Info.plist"), path.join(app, "Contents", "Info.plist"));
  execFileSync("xattr", ["-cr", app], { stdio: "inherit" });
  signApp(app, executable, espflashTarget);
  return { app, executable, espflash: espflashTarget };
}

function copyEspflashLicenses(espflashSource, resources) {
  const configured = process.env.GERNETIX_ESPFLASH_LICENSE_DIR;
  const candidates = [
    configured,
    path.resolve(path.dirname(espflashSource), ".."),
  ].filter(Boolean);
  const licenseDir = candidates.find((candidate) =>
    fs.existsSync(path.join(candidate, "LICENSE-APACHE"))
    && fs.existsSync(path.join(candidate, "LICENSE-MIT")));
  if (!licenseDir) {
    if (process.env.GERNETIX_RELEASE_BUILD === "1") {
      throw new Error("Release-Build abgebrochen: LICENSE-APACHE und LICENSE-MIT fuer espflash fehlen.");
    }
    console.warn("Hinweis: espflash-Lizenzdateien wurden neben dem lokalen Binary nicht gefunden.");
    return;
  }
  fs.copyFileSync(path.join(licenseDir, "LICENSE-APACHE"), path.join(resources, "espflash-LICENSE-APACHE"));
  fs.copyFileSync(path.join(licenseDir, "LICENSE-MIT"), path.join(resources, "espflash-LICENSE-MIT"));
}

function resolveEspflash() {
  const configured = process.env.GERNETIX_ESPFLASH_BINARY;
  if (configured && fs.existsSync(configured)) return path.resolve(configured);
  const result = spawnSync("sh", ["-c", "command -v espflash"], { encoding: "utf8" });
  const candidate = result.status === 0 ? result.stdout.trim() : "";
  if (!candidate || !fs.existsSync(candidate)) {
    throw new Error("espflash fehlt. Installiere es einmalig mit `brew install espflash` oder setze GERNETIX_ESPFLASH_BINARY.");
  }
  return fs.realpathSync(candidate);
}

function signApp(appPath, mainExecutable, espflashExecutable) {
  const identity = process.env.CSC_NAME || "-";
  const shared = ["--force", "--sign", identity];
  if (identity !== "-") shared.push("--options", "runtime", "--timestamp");
  execFileSync("codesign", [...shared, espflashExecutable], { stdio: "inherit" });
  execFileSync("codesign", [...shared, mainExecutable], { stdio: "inherit" });
  execFileSync("codesign", [...shared, appPath], { stdio: "inherit" });
  execFileSync("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath], { stdio: "inherit" });
}

if (require.main === module) {
  const result = buildNativeService();
  process.stdout.write(`Native GerNetiX Serial Service: ${result.app}\n`);
  if (process.argv.includes("--run")) {
    const child = spawnSync(result.executable, [], { stdio: "inherit", env: process.env });
    process.exitCode = child.status ?? 1;
  }
}

module.exports = { buildNativeService, resolveEspflash };
