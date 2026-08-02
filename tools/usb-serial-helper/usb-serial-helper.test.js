"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const test = require("node:test");
const { buildNativeService } = require("./scripts/build-native-service");

const root = __dirname;

test("webhelper is a native UI-less service without Electron or Chromium", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const swift = fs.readFileSync(path.join(root, "native", "main.swift"), "utf8");
  const launchAgent = fs.readFileSync(path.join(root, "install", "macos", "com.gernetix.serial-service.plist"), "utf8");

  assert.equal(manifest.version, "0.3.10");
  assert.equal(manifest.dependencies, undefined);
  assert.equal(manifest.devDependencies, undefined);
  assert.doesNotMatch(JSON.stringify(manifest), /electron|chromium/i);
  assert.match(swift, /runtime": "native-swift"/);
  assert.match(swift, /local_device_diagnostics/);
  assert.match(swift, /validatedLocalDeviceBaseURL/);
  assert.match(swift, /isAllowedLocalDeviceHost/);
  assert.match(swift, /completionHandler\(nil\)/);
  assert.match(swift, /NWListener/);
  assert.match(swift, /SecPKCS12Import/);
  assert.match(swift, /espflash/);
  assert.match(swift, /"--after", "no-reset-no-stub"/);
  assert.match(swift, /read-flash/);
  assert.match(swift, /Flash verifiziert/);
  assert.match(swift, /"percent": percent/);
  assert.match(swift, /outputHandle\.readabilityHandler/);
  assert.match(swift, /recordEspflashProgress/);
  assert.match(swift, /Geschriebene Firmware wird geprüft/);
  assert.match(swift, /flash_package_app_address_mismatch/);
  assert.match(swift, /#available\(macOS 15\.0, \*\)/);
  assert.match(swift, /kSecImportToMemoryOnly/);
  assert.match(launchAgent, /RunAtLoad/);
  assert.match(launchAgent, /GERNETIX_SERIAL_TLS_PKCS12/);
  assert.match(
    fs.readFileSync(path.join(root, "scripts", "build-native-service.js"), "utf8"),
    /arm64-apple-macos13\.0/,
  );
});

test("native service builds and passes its contract self-test", { timeout: 120_000 }, () => {
  const built = buildNativeService();
  const output = execFileSync(built.executable, ["--self-test"], { encoding: "utf8" });
  const serviceSize = fs.statSync(built.executable).size;
  const espflashSize = fs.statSync(built.espflash).size;
  const resources = path.dirname(built.espflash);

  assert.match(output, /native self-test: ok/);
  assert.ok(serviceSize < 1024 * 1024, `Swift service is unexpectedly large: ${serviceSize}`);
  assert.ok(espflashSize < 32 * 1024 * 1024, `espflash is unexpectedly large: ${espflashSize}`);
  assert.ok(fs.existsSync(path.join(resources, "espflash-LICENSE-APACHE")));
  assert.ok(fs.existsSync(path.join(resources, "espflash-LICENSE-MIT")));
});

test("installer creates a trusted per-installation TLS identity and starts the LaunchAgent", () => {
  const postinstall = fs.readFileSync(path.join(root, "install", "macos", "pkg-scripts", "postinstall"), "utf8");
  const packageBuilder = fs.readFileSync(path.join(root, "scripts", "build-macos-package.js"), "utf8");
  const component = fs.readFileSync(path.join(root, "install", "macos", "component.plist"), "utf8");

  assert.match(postinstall, /openssl pkcs12 -export/);
  assert.match(postinstall, /security add-trusted-cert -d -r trustRoot/);
  assert.match(postinstall, /security verify-cert -c "\$CERTIFICATE" -p ssl -n localhost/);
  assert.match(postinstall, /-k \/Library\/Keychains\/System\.keychain -L/);
  assert.match(postinstall, /root-ca-openssl\.cnf/);
  assert.match(postinstall, /-certfile "\$ROOT_CERTIFICATE"/);
  assert.match(postinstall, /launchctl bootstrap/);
  assert.match(packageBuilder, /GERNETIX_MAC_INSTALLER_IDENTITY/);
  assert.match(packageBuilder, /Developer ID signiert/);
  assert.match(packageBuilder, /productbuild/);
  assert.match(packageBuilder, /installerResources/);
  assert.match(packageBuilder, /const packageRoot = path\.join\(buildWorkspace, "payload"\)/);
  assert.match(packageBuilder, /const componentPackages = path\.join\(buildWorkspace, "component-packages"\)/);
  assert.match(packageBuilder, /--component-plist/);
  assert.match(component, /<key>BundleIsRelocatable<\/key>\s*<false\/>/);
  const distribution = fs.readFileSync(path.join(root, "install", "macos", "distribution.xml"), "utf8");
  assert.match(distribution, /<background file="installer-background\.png"/);
  assert.match(distribution, /<background-darkAqua file="installer-background-dark\.png"/);
  assert.match(distribution, /<welcome file="welcome\.html"/);
  assert.match(packageBuilder, /notarytool/);
  assert.match(packageBuilder, /stapler/);
});
