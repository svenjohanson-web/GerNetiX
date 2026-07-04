const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const args = parseArgs(process.argv.slice(2));
const board = args.board || "esp32-devkit-v1";
const serial = args.serial || `local-${Date.now()}`;
const dryRun = Boolean(args["dry-run"]);
const boardId = createBoardId(board, serial);

const manifest = {
  schemaVersion: 1,
  kind: "esp32_provisioning_manifest",
  board,
  serial,
  boardId,
  createdAt: new Date().toISOString(),
  capabilities: ["capability.processor_esp32", "capability.wifi", "capability.ota"],
  status: dryRun ? "dry_run" : "provisioned_manifest_created",
};

if (dryRun) {
  console.log(JSON.stringify(manifest, null, 2));
  process.exit(0);
}

const outDir = path.resolve(__dirname, "..", "out");
fs.mkdirSync(outDir, { recursive: true });
const filePath = path.join(outDir, `${boardId}.json`);
fs.writeFileSync(filePath, JSON.stringify(manifest, null, 2));
console.log(`Provisioning manifest written: ${filePath}`);

function createBoardId(boardName, serialNumber) {
  return crypto.createHash("sha256").update(`${boardName}:${serialNumber}`).digest("hex").slice(0, 16);
}

function parseArgs(values) {
  const result = {};
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = values[index + 1];
    if (!next || next.startsWith("--")) {
      result[key] = true;
    } else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}
