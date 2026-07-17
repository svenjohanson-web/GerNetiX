const fs = require("node:fs");
const path = require("node:path");
const { SqlitePublicDemoRepository } = require("../services/public-demo-server/src/repositories/sqlite-public-demo-repository");

const root = path.resolve(__dirname, "..");
const build = path.join(root, "Demoanwendungen", "Boards", "hardware.processor_board.esp32_s3_es3c28p", "touch-spielesammlung", "firmware", ".pio", "build", "es3c28p");
const repository = new SqlitePublicDemoRepository(path.join(root, ".runtime", "public-demos", "gernetix-public-demos.sqlite"));
try {
  const result = repository.publish({
    demo_id: "touch-spielesammlung",
    title: "ESP32 Touch 2,8\" Spielesammlung",
    description: "Nibbles für das ESP32-S3 ES3C28P Touch-Board.",
    board_hardware_item_id: "hardware.processor_board.esp32_s3_es3c28p",
    category: "spiele",
    games: ["Nibbles"],
  version: "1.0.12",
    firmware_file_name: "firmware.bin",
    bootloader_base64: readBase64(path.join(build, "bootloader.bin")),
    partitions_base64: readBase64(path.join(build, "partitions.bin")),
    firmware_base64: readBase64(path.join(build, "firmware.bin")),
  });
  console.log(JSON.stringify(result, null, 2));
} finally {
  repository.close();
}

function readBase64(filePath) { return fs.readFileSync(filePath).toString("base64"); }
