const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");
const { BuildDeployError } = require("../errors");

class SqliteDeviceOtaSigner {
  constructor(sqlitePath) { this.sqlitePath = sqlitePath; }
  async sign({ deviceId, canonical }) {
    const db = new DatabaseSync(this.sqlitePath, { readOnly: true });
    try {
      const credential = db.prepare("SELECT secret FROM device_management_credentials WHERE device_id = ? AND status = 'active'").get(deviceId);
      if (!credential?.secret) throw new BuildDeployError("device_credential_missing", "Aktives Device-Secret für OTA-Signierung fehlt.", 409);
      return crypto.createHmac("sha256", credential.secret).update(canonical).digest("hex");
    } finally { db.close(); }
  }
}

class SqliteOtaAcknowledgementStore {
  constructor(sqlitePath) {
    this.db = new DatabaseSync(sqlitePath);
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

module.exports = { SqliteDeviceOtaSigner, SqliteOtaAcknowledgementStore };
