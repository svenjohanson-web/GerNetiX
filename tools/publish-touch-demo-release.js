const fs = require("node:fs");
const path = require("node:path");
const { SqlitePublicDemoRepository } = require("../services/public-demo-server/src/repositories/sqlite-public-demo-repository");

const root = path.resolve(__dirname, "..");
const build = path.join(root, "Demoanwendungen", "Boards", "hardware.processor_board.esp32_s3_es3c28p", "touch-spielesammlung", "firmware", ".pio", "build", "es3c28p");
const sqlitePath = process.env.PUBLIC_DEMO_SQLITE_PATH
  || path.join(root, ".runtime", "public-demos", "gernetix-public-demos.sqlite");
const repository = new SqlitePublicDemoRepository(sqlitePath);
try {
  const release = {
    demo_id: "touch-spielesammlung",
    title: "Spielfläche",
    description: "Touch-Demo für das ESP32-S3 ES3C28P Touch-Board.",
    board_hardware_item_id: "hardware.processor_board.esp32_s3_es3c28p",
    category: "spiele",
    games: [],
    version: "1.0.40",
    firmware_file_name: "firmware.bin",
    bootloader_base64: readBase64(path.join(build, "bootloader.bin")),
    partitions_base64: readBase64(path.join(build, "partitions.bin")),
    firmware_base64: readBase64(path.join(build, "firmware.bin")),
  };
  let result;
  try {
    result = repository.publish(release);
  } catch (error) {
    if (error.code !== "release_already_exists") throw error;
    const existing = repository.getFirmware(release.demo_id, release.version);
    const expectedSha256 = require("node:crypto").createHash("sha256")
      .update(Buffer.from(release.firmware_base64, "base64")).digest("hex");
    if (existing.firmware_sha256 !== expectedSha256) {
      throw new Error(`Die unveraenderliche Version ${release.version} existiert bereits mit einer anderen Firmware.`);
    }
    result = repository.getPublicDemo(release.demo_id);
  }
  console.log(JSON.stringify(result, null, 2));
} finally {
  repository.close();
}

function readBase64(filePath) { return fs.readFileSync(filePath).toString("base64"); }
