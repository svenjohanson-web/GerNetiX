const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "..", "..");
const source = path.join(projectRoot, ".pio", "build", "diymore_hw_364a", "firmware.bin");
const targetDirectory = path.join(repoRoot, ".runtime", "server-firmware", "esp8266-diymore-hw364a", "latest");
const target = path.join(targetDirectory, "firmware.bin");

if (!fs.existsSync(source)) throw new Error(`PlatformIO-Build fehlt: ${source}`);
fs.mkdirSync(targetDirectory, { recursive: true });
fs.copyFileSync(source, target);
const bytes = fs.readFileSync(target);
const manifest = {
  artifact_id: "firmware_artifact.esp8266_diymore_hw364a_basissoftware_factory.latest",
  version: "0.1.0",
  chip: "esp8266",
  hardware_profile_id: "hardware.processor_board.diymore_hw_364a_esp8266_oled",
  file_name: "firmware.bin",
  flash_strategy: "esp8266_app_bin",
  flash_offset: "0x0",
  size_bytes: bytes.length,
  sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
};
fs.writeFileSync(path.join(targetDirectory, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
console.log(JSON.stringify({ status: "prepared", firmware_path: target, manifest }, null, 2));
