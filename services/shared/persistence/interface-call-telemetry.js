const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { issueInternalToken } = require("../internal-api-auth");

const connections = new Map();

function createInterfaceCallTelemetry(options = {}) {
  if (options.endpoint) return createHttpTelemetry(options);
  const dbPath = path.resolve(options.dbPath || path.join(__dirname, "../../../.runtime/gernetix-services.sqlite"));
  const sourceService = String(options.sourceService || "unknown");
  let db = connections.get(dbPath);
  if (!db) {
    db = new DatabaseSync(dbPath);
    db.exec("PRAGMA journal_mode = WAL");
    db.exec(`CREATE TABLE IF NOT EXISTS gernetix_external_interface_calls (
      call_id INTEGER PRIMARY KEY AUTOINCREMENT,
      occurred_at TEXT NOT NULL,
      source_service TEXT NOT NULL,
      target_service TEXT NOT NULL,
      method TEXT NOT NULL,
      route TEXT NOT NULL,
      status_code INTEGER NOT NULL,
      duration_ms INTEGER NOT NULL,
      succeeded INTEGER NOT NULL,
      action_id TEXT,
      action_type TEXT
    )`);
    ensureColumn(db, "gernetix_external_interface_calls", "action_id", "TEXT");
    ensureColumn(db, "gernetix_external_interface_calls", "action_type", "TEXT");
    db.exec("CREATE INDEX IF NOT EXISTS idx_interface_calls_time ON gernetix_external_interface_calls(occurred_at)");
    db.exec("CREATE INDEX IF NOT EXISTS idx_interface_calls_action ON gernetix_external_interface_calls(action_id, occurred_at)");
    connections.set(dbPath, db);
  }
  const insert = db.prepare(`INSERT INTO gernetix_external_interface_calls
    (occurred_at, source_service, target_service, method, route, status_code, duration_ms, succeeded, action_id, action_type)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  return {
    record(input = {}) {
      try {
        insert.run(
          new Date().toISOString(),
          sourceService,
          String(input.targetService || "unknown"),
          String(input.method || "GET").toUpperCase(),
          normalizeRoute(input.route),
          Number(input.statusCode || 0),
          Math.max(0, Math.round(Number(input.durationMs || 0))),
          input.succeeded ? 1 : 0,
          normalizeActionId(input.actionId),
          normalizeActionType(input.actionType),
        );
      } catch {
        // Telemetrie darf den eigentlichen Schnittstellenaufruf nie blockieren.
      }
    },
  };
}

function createHttpTelemetry(options) {
  const endpoint = String(options.endpoint).replace(/\/$/, "");
  const sourceService = String(options.sourceService || "unknown");
  return {
    record(input = {}) {
      if (!options.internalApiSigningKey) return;
      const token = issueInternalToken({
        iss: sourceService, sub: sourceService, aud: "admin-tool",
        scopes: ["operations.interface_calls.write"],
      }, options.internalApiSigningKey);
      fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          occurred_at: new Date().toISOString(),
          source_service: sourceService,
          target_service: String(input.targetService || "unknown"),
          method: String(input.method || "GET").toUpperCase(),
          route: normalizeRoute(input.route),
          status_code: Number(input.statusCode || 0),
          duration_ms: Math.max(0, Math.round(Number(input.durationMs || 0))),
          succeeded: Boolean(input.succeeded),
          action_id: normalizeActionId(input.actionId),
          action_type: normalizeActionType(input.actionType),
        }),
      }).catch(() => {
        // Betriebliche Telemetrie darf den Fachaufruf nie blockieren.
      });
    },
  };
}

function ensureColumn(db, table, column, type) {
  const columns = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((item) => item.name));
  if (!columns.has(column)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${type}`);
}

function normalizeActionId(value) {
  const result = String(value || "").trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(result) ? result : "";
}

function normalizeActionType(value) {
  const result = String(value || "").trim();
  return /^[a-z0-9][a-z0-9._-]{0,99}$/.test(result) ? result : "";
}

function normalizeRoute(value) {
  return String(value || "/").split("?")[0].slice(0, 300) || "/";
}

module.exports = { createInterfaceCallTelemetry, normalizeActionId, normalizeActionType, normalizeRoute };
