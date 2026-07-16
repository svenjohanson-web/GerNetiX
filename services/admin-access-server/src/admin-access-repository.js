const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { DatabaseSync } = require("node:sqlite");

class AdminAccessRepository {
  static create(sqlitePath) {
    fs.mkdirSync(path.dirname(sqlitePath), { recursive: true });
    const repository = new AdminAccessRepository(new DatabaseSync(sqlitePath));
    repository.migrate();
    return repository;
  }

  constructor(db) { this.db = db; }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS admin_access_users (
        admin_id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        role TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        last_login_at TEXT
      );
      CREATE TABLE IF NOT EXISTS admin_access_sessions (
        session_id TEXT PRIMARY KEY,
        admin_id TEXT NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        revoked_at TEXT,
        FOREIGN KEY (admin_id) REFERENCES admin_access_users(admin_id)
      );
      CREATE TABLE IF NOT EXISTS admin_access_audit_events (
        audit_id TEXT PRIMARY KEY,
        occurred_at TEXT NOT NULL,
        admin_id TEXT,
        event_type TEXT NOT NULL,
        detail TEXT NOT NULL
      );
    `);
  }

  countUsers() { return this.db.prepare("SELECT COUNT(*) AS count FROM admin_access_users").get().count; }
  findUser(username) { return this.db.prepare("SELECT * FROM admin_access_users WHERE username = ?").get(normalizeUsername(username)); }
  findUserById(adminId) { return this.db.prepare("SELECT * FROM admin_access_users WHERE admin_id = ?").get(adminId); }
  listUsers() { return this.db.prepare("SELECT admin_id, username, role, enabled, created_at, last_login_at FROM admin_access_users ORDER BY created_at").all(); }

  createUser({ username, password, role = "administrator" }) {
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = hashPassword(password, salt);
    const user = { admin_id: `admin_${crypto.randomUUID()}`, username: normalizeUsername(username), password_hash: passwordHash, password_salt: salt, role, created_at: new Date().toISOString() };
    this.db.prepare("INSERT INTO admin_access_users (admin_id, username, password_hash, password_salt, role, enabled, created_at) VALUES (?, ?, ?, ?, ?, 1, ?)")
      .run(user.admin_id, user.username, user.password_hash, user.password_salt, user.role, user.created_at);
    this.audit(user.admin_id, "admin_created", user.username);
    return user;
  }

  createSession(adminId, expiresAt) {
    const token = crypto.randomBytes(32).toString("base64url");
    const session = { session_id: `admin_session_${crypto.randomUUID()}`, admin_id: adminId, token_hash: hashToken(token), expires_at: expiresAt, created_at: new Date().toISOString() };
    this.db.prepare("INSERT INTO admin_access_sessions (session_id, admin_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)")
      .run(session.session_id, session.admin_id, session.token_hash, session.expires_at, session.created_at);
    return { ...session, token };
  }

  resolveSession(token) {
    if (!token) return null;
    const row = this.db.prepare(`SELECT s.*, u.username, u.role, u.enabled FROM admin_access_sessions s JOIN admin_access_users u ON u.admin_id = s.admin_id WHERE s.token_hash = ? AND s.revoked_at IS NULL`).get(hashToken(token));
    if (!row || !row.enabled || new Date(row.expires_at).getTime() <= Date.now()) return null;
    return row;
  }

  revokeSession(token) {
    if (!token) return;
    this.db.prepare("UPDATE admin_access_sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at IS NULL").run(new Date().toISOString(), hashToken(token));
  }

  markLogin(adminId) {
    this.db.prepare("UPDATE admin_access_users SET last_login_at = ? WHERE admin_id = ?").run(new Date().toISOString(), adminId);
    this.audit(adminId, "login_succeeded", "");
  }
  audit(adminId, eventType, detail) {
    this.db.prepare("INSERT INTO admin_access_audit_events (audit_id, occurred_at, admin_id, event_type, detail) VALUES (?, ?, ?, ?, ?)")
      .run(`admin_audit_${crypto.randomUUID()}`, new Date().toISOString(), adminId || null, eventType, String(detail || "").slice(0, 300));
  }
  close() { this.db.close(); }
}

function normalizeUsername(value) { return String(value || "").trim().toLowerCase(); }
function hashToken(token) { return crypto.createHash("sha256").update(String(token)).digest("hex"); }
function hashPassword(password, salt) { return crypto.scryptSync(String(password), salt, 64).toString("hex"); }
function verifyPassword(password, user) {
  const actual = Buffer.from(hashPassword(password, user.password_salt), "hex");
  const expected = Buffer.from(user.password_hash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

module.exports = { AdminAccessRepository, normalizeUsername, verifyPassword };
