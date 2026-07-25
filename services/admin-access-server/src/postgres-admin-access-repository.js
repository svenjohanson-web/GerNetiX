const crypto = require("node:crypto");
const { normalizeUsername } = require("./admin-access-repository");

class PostgresAdminAccessRepository {
  static async create(options = {}) {
    const { Pool } = require("pg");
    const repository = new PostgresAdminAccessRepository(options.pool || new Pool(options.poolOptions));
    await repository.migrate();
    return repository;
  }

  constructor(pool) {
    this.pool = pool;
  }

  async migrate() {
    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS admin_access_users (
        admin_id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        password_salt TEXT NOT NULL,
        role TEXT NOT NULL,
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL,
        last_login_at TIMESTAMPTZ
      );
      CREATE TABLE IF NOT EXISTS admin_access_sessions (
        session_id TEXT PRIMARY KEY,
        admin_id TEXT NOT NULL REFERENCES admin_access_users(admin_id),
        token_hash TEXT NOT NULL UNIQUE,
        expires_at TIMESTAMPTZ NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ
      );
      CREATE TABLE IF NOT EXISTS admin_access_audit_events (
        audit_id TEXT PRIMARY KEY,
        occurred_at TIMESTAMPTZ NOT NULL,
        admin_id TEXT,
        event_type TEXT NOT NULL,
        detail TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_admin_access_sessions_token
        ON admin_access_sessions(token_hash, expires_at);
    `);
  }

  async countUsers() {
    const result = await this.pool.query("SELECT COUNT(*)::int AS count FROM admin_access_users");
    return result.rows[0].count;
  }

  async findUser(username) {
    return (await this.pool.query("SELECT * FROM admin_access_users WHERE username=$1", [normalizeUsername(username)])).rows[0] || null;
  }

  async findUserById(adminId) {
    return (await this.pool.query("SELECT * FROM admin_access_users WHERE admin_id=$1", [adminId])).rows[0] || null;
  }

  async listUsers() {
    return (await this.pool.query(`
      SELECT admin_id, username, role, enabled, created_at::text AS created_at,
             last_login_at::text AS last_login_at
      FROM admin_access_users ORDER BY created_at
    `)).rows;
  }

  async createUser({ username, password, role = "administrator" }) {
    const salt = crypto.randomBytes(16).toString("hex");
    const user = {
      admin_id: `admin_${crypto.randomUUID()}`,
      username: normalizeUsername(username),
      password_hash: hashPassword(password, salt),
      password_salt: salt,
      role,
      created_at: new Date().toISOString(),
    };
    await this.pool.query(`
      INSERT INTO admin_access_users
        (admin_id, username, password_hash, password_salt, role, enabled, created_at)
      VALUES ($1,$2,$3,$4,$5,TRUE,$6)
    `, [user.admin_id, user.username, user.password_hash, user.password_salt, user.role, user.created_at]);
    await this.audit(user.admin_id, "admin_created", user.username);
    return { ...user, enabled: true };
  }

  async createSession(adminId, expiresAt) {
    const token = crypto.randomBytes(32).toString("base64url");
    const session = {
      session_id: `admin_session_${crypto.randomUUID()}`,
      admin_id: adminId,
      token_hash: hashToken(token),
      expires_at: expiresAt,
      created_at: new Date().toISOString(),
    };
    await this.pool.query(`
      INSERT INTO admin_access_sessions (session_id, admin_id, token_hash, expires_at, created_at)
      VALUES ($1,$2,$3,$4,$5)
    `, [session.session_id, session.admin_id, session.token_hash, session.expires_at, session.created_at]);
    return { ...session, token };
  }

  async resolveSession(token) {
    if (!token) return null;
    const result = await this.pool.query(`
      SELECT s.session_id, s.admin_id, s.token_hash, s.expires_at::text AS expires_at,
             s.created_at::text AS created_at, s.revoked_at::text AS revoked_at,
             u.username, u.role, u.enabled
      FROM admin_access_sessions s
      JOIN admin_access_users u ON u.admin_id=s.admin_id
      WHERE s.token_hash=$1 AND s.revoked_at IS NULL AND s.expires_at > NOW()
    `, [hashToken(token)]);
    return result.rows[0]?.enabled ? result.rows[0] : null;
  }

  async revokeSession(token) {
    if (!token) return;
    await this.pool.query(`
      UPDATE admin_access_sessions SET revoked_at=NOW()
      WHERE token_hash=$1 AND revoked_at IS NULL
    `, [hashToken(token)]);
  }

  async markLogin(adminId) {
    await this.pool.query("UPDATE admin_access_users SET last_login_at=NOW() WHERE admin_id=$1", [adminId]);
    await this.audit(adminId, "login_succeeded", "");
  }

  async audit(adminId, eventType, detail) {
    await this.pool.query(`
      INSERT INTO admin_access_audit_events (audit_id, occurred_at, admin_id, event_type, detail)
      VALUES ($1,NOW(),$2,$3,$4)
    `, [`admin_audit_${crypto.randomUUID()}`, adminId || null, eventType, String(detail || "").slice(0, 300)]);
  }

  async close() {
    await this.pool.end();
  }
}

function hashToken(token) {
  return crypto.createHash("sha256").update(String(token)).digest("hex");
}

function hashPassword(password, salt) {
  return crypto.scryptSync(String(password), salt, 64).toString("hex");
}

module.exports = { PostgresAdminAccessRepository };
