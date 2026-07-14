const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const test = require("node:test");
const { PemOtaCommandSigner, SqliteOtaAcknowledgementStore } = require("../src/modules/ota-security");

test("signs OTA commands with a separate ECDSA P-256 key and stores acknowledgements", async () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "gnx-ota-")), "state.sqlite");
  const keys = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  const signer = new PemOtaCommandSigner({
    keyId: "ota-key-1",
    privateKeyPem: keys.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
  });
  const canonical = "gernetix-ota-command-v1\nota-key-1\ndeploy";
  const signature = await signer.sign({ canonical });
  assert.equal(crypto.verify(
    "sha256",
    Buffer.from(canonical),
    { key: keys.publicKey, dsaEncoding: "ieee-p1363" },
    Buffer.from(signature, "base64url"),
  ), true);

  const store = new SqliteOtaAcknowledgementStore(dbPath);
  await store.record({ deploy_id: "deploy-1", device_id: "device-1", status: "published" });
  await store.receive("gernetix/devices/device-1/status/deployment", JSON.stringify({ deploy_id: "deploy-1", status: "verified" }));
  assert.equal(store.get("deploy-1").status, "verified");
  const check = new DatabaseSync(dbPath, { readOnly: true });
  assert.equal(check.prepare("SELECT status FROM build_deploy_ota_acknowledgements WHERE deploy_id=?").get("deploy-1").status, "verified");
  check.close();
});
