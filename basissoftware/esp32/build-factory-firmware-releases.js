const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = __dirname;
const releaseRoot = path.join(root, "..", "..", ".runtime", "server-firmware", "esp32-basissoftware");
const [platformio, python, esptool] = process.argv.slice(2);

const releases = [
  { environment: "esp32dev", directory: "esp32-classic-qspi-4mb/full" },
  { environment: "esp32dev-medium", directory: "esp32-classic-qspi-4mb/medium" },
  { environment: "esp32dev-low", directory: "esp32-classic-qspi-4mb/low" },
  { environment: "esp32-s3-16mb-full", directory: "esp32-s3-opi-n16r8/full" },
  { environment: "esp32-c6-4mb-full", directory: "esp32-c6-qspi-4mb/full" },
];

if (![platformio, python, esptool].every(Boolean)) {
  throw new Error("Aufruf: build-factory-firmware-releases.js <platformio> <python> <esptool>");
}

for (const release of releases) {
  console.log(`\n=== Build ${release.environment} ===`);
  execFileSync(platformio, ["run", "-e", release.environment], { cwd: root, stdio: "inherit" });

  const buildDir = path.join(root, ".pio", "build", release.environment);
  const flashArgs = JSON.parse(fs.readFileSync(path.join(buildDir, "flasher_args.json"), "utf8"));
  const outputDir = path.join(releaseRoot, ...release.directory.split("/"));
  const outputFile = path.join(outputDir, "merged-firmware.bin");
  fs.mkdirSync(outputDir, { recursive: true });

  const args = ["--chip", flashArgs.extra_esptool_args.chip, "merge_bin", "-o", outputFile];
  for (const value of flashArgs.write_flash_args || []) args.push(value);
  for (const [offset, fileName] of Object.entries(flashArgs.flash_files || {})) {
    args.push(offset, path.join(buildDir, fileName));
  }
  execFileSync(python, [esptool, ...args], { cwd: root, stdio: "inherit" });
  console.log(`Release bereit: ${outputFile}`);
}
