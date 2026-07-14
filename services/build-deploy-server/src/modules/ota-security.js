const crypto = require("node:crypto");
const fs = require("node:fs");
const { DatabaseSync } = require("node:sqlite");
const { BuildDeployError } = require("../errors");

class PemOtaCommandSigner {
  constructor(options = {}) {
    this.privateKeyPath = options.privateKeyPath || "";
    this.privateKeyPem = options.privateKeyPem || "";
    this.keyId = options.keyId || "";
  }

  isConfigured() {
    return Boolean(this.keyId && (this.privateKeyPem || this.privateKeyPath));
  }

  async sign({ canonical }) {
    if (!this.isConfigured()) {
      throw new BuildDeployError("ota_signing_key_missing", "Aktiver privater OTA-Signing-Key fehlt.", 409);
    }
    const keyPem = this.privateKeyPem || fs.readFileSync(this.privateKeyPath, "utf8");
    let key;
    try {
      key = crypto.createPrivateKey(keyPem);
    } catch {
      throw new BuildDeployError("ota_signing_key_invalid", "Privater OTA-Signing-Key ist ungueltig.", 500);
    }
    if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1") {
      throw new BuildDeployError("ota_signing_key_unsupported", "OTA-Signing-Key muss ECDSA P-256 verwenden.", 500);
    }
    return crypto.sign("sha256", Buffer.from(canonical), {
      key,
      dsaEncoding: "ieee-p1363",
    }).toString("base64url");
  }
}

class SqliteOtaAcknowledgementStore {
  constructor(sqlitePath) {
    this.db = new DatabaseSync(sqlitePath);
    this.db.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL;");
    this.db.exec(`CREATE TABLE IF NOT EXISTS build_deploy_ota_acknowledgements (
      deploy_id TEXT PRIMARY KEY, device_id TEXT NOT NULL, status TEXT NOT NULL,
      published_at TEXT, acknowledged_at TEXT, detail_json TEXT NOT NULL
    )`);
  }
  async record(entry) { this.upsert(entry); }
  get(deployId) {
    return this.db.prepare("SELECT deploy_id,device_id,status,published_at,acknowledged_at,detail_json FROM build_deploy_ota_acknowledgements WHERE deploy_id=?").get(deployId) || null;
  }
  async receive(topic, payload) {
    let detail;
    try { detail = JSON.parse(payload); } catch { return; }
    const deviceId = topic.split("/")[2] || detail.device_id || "";
    const deployId = detail.deploy_id || detail.deployId || "";
    if (!deviceId || !deployId) return;
    this.upsert({ ...detail, deploy_id: deployId, device_id: deviceId, status: detail.status || detail.state || "acknowledged", acknowledged_at: new Date().toISOString() });
  }
  upsert(entry) {
    this.db.prepare(`INSERT INTO build_deploy_ota_acknowledgements
      (deploy_id,device_id,status,published_at,acknowledged_at,detail_json) VALUES (?,?,?,?,?,?)
      ON CONFLICT(deploy_id) DO UPDATE SET status=excluded.status, acknowledged_at=COALESCE(excluded.acknowledged_at,build_deploy_ota_acknowledgements.acknowledged_at), detail_json=excluded.detail_json`)
      .run(entry.deploy_id, entry.device_id, entry.status, entry.published_at || null, entry.acknowledged_at || null, JSON.stringify(entry));
  }
}

module.exports = { PemOtaCommandSigner, SqliteOtaAcknowledgementStore };
