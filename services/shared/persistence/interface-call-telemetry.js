const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

const connections = new Map();

function createInterfaceCallTelemetry(options = {}) {
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
      succeeded INTEGER NOT NULL
    )`);
    db.exec("CREATE INDEX IF NOT EXISTS idx_interface_calls_time ON gernetix_external_interface_calls(occurred_at)");
    connections.set(dbPath, db);
  }
  const insert = db.prepare(`INSERT INTO gernetix_external_interface_calls
    (occurred_at, source_service, target_service, method, route, status_code, duration_ms, succeeded)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);
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
        );
      } catch {
        // Telemetrie darf den eigentlichen Schnittstellenaufruf nie blockieren.
      }
    },
  };
}

function normalizeRoute(value) {
  return String(value || "/").split("?")[0].slice(0, 300) || "/";
}

module.exports = { createInterfaceCallTelemetry, normalizeRoute };
