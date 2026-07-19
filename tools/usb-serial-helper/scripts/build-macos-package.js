"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { buildNativeService } = require("./build-native-service");

if (process.platform !== "darwin") throw new Error("Das macOS-Paket kann nur auf macOS gebaut werden.");

const root = path.resolve(__dirname, "..");
const dist = path.join(root, "dist");
const packageRoot = fs.mkdtempSync(path.join(os.tmpdir(), "gernetix-serial-service-pkg-"));
const packageScripts = path.join(root, "install", "macos", "pkg-scripts");
const appTarget = path.join(packageRoot, "Applications", "GerNetiX Serial Service.app");
const launchAgentTarget = path.join(packageRoot, "Library", "LaunchAgents", "com.gernetix.serial-service.plist");
const output = path.join(dist, "GerNetiX-Serial-Service-mac-arm64.pkg");
const manifest = require(path.join(root, "package.json"));
const versionedOutput = path.join(dist, `GerNetiX-Serial-Service-${manifest.version}-mac-arm64.pkg`);

if (process.env.GERNETIX_RELEASE_BUILD === "1"
  && (!process.env.CSC_NAME || !process.env.GERNETIX_MAC_INSTALLER_IDENTITY)) {
  throw new Error("Release-Build abgebrochen: CSC_NAME oder GERNETIX_MAC_INSTALLER_IDENTITY fehlt.");
}
if (process.env.GERNETIX_NOTARY_PROFILE
  && (!process.env.CSC_NAME || !process.env.GERNETIX_MAC_INSTALLER_IDENTITY)) {
  throw new Error("Notarisierung abgebrochen: Anwendung und Installer muessen zuerst mit Developer ID signiert werden.");
}

const native = buildNativeService();
fs.mkdirSync(path.dirname(appTarget), { recursive: true });
fs.mkdirSync(path.dirname(launchAgentTarget), { recursive: true });
fs.cpSync(native.app, appTarget, { recursive: true });
fs.copyFileSync(path.join(root, "install", "macos", "com.gernetix.serial-service.plist"), launchAgentTarget);
execFileSync("xattr", ["-cr", packageRoot], { cwd: root, stdio: "inherit" });

const args = [
  "--root", packageRoot,
  "--identifier", "com.gernetix.serial-service",
  "--version", manifest.version,
  "--install-location", "/",
  "--component-plist", path.join(root, "install", "macos", "component.plist"),
  "--scripts", packageScripts,
];
if (process.env.GERNETIX_MAC_INSTALLER_IDENTITY) args.push("--sign", process.env.GERNETIX_MAC_INSTALLER_IDENTITY);
args.push(output);

execFileSync("pkgbuild", args, {
  cwd: root,
  env: { ...process.env, COPYFILE_DISABLE: "1" },
  stdio: "inherit",
});
try {
  fs.rmSync(packageRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
} catch (error) {
  console.warn(`Temporärer Paketordner konnte nicht entfernt werden: ${error.message}`);
}
if (process.env.GERNETIX_MAC_INSTALLER_IDENTITY) {
  execFileSync("/usr/sbin/pkgutil", ["--check-signature", output], { cwd: root, stdio: "inherit" });
} else {
  console.warn("Lokales Testpaket ist nicht mit einer Developer-ID-Installer-Identitaet signiert.");
}

if (process.env.GERNETIX_NOTARY_PROFILE) {
  execFileSync("xcrun", ["notarytool", "submit", output, "--keychain-profile", process.env.GERNETIX_NOTARY_PROFILE, "--wait"], {
    cwd: root,
    stdio: "inherit",
  });
  execFileSync("xcrun", ["stapler", "staple", output], { cwd: root, stdio: "inherit" });
  execFileSync("/usr/sbin/spctl", ["--assess", "--type", "install", "--verbose=2", output], { cwd: root, stdio: "inherit" });
}

const sizeMiB = (fs.statSync(output).size / 1024 / 1024).toFixed(1);
fs.copyFileSync(output, versionedOutput);
console.log(`GerNetiX Serial Service package: ${output} (${sizeMiB} MiB)`);
console.log(`Versioned package: ${versionedOutput}`);
