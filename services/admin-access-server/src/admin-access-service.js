const { normalizeUsername, verifyPassword } = require("./admin-access-repository");

const ROLE_CAPABILITIES = {
  administrator: ["admin_device_management", "admin_ai_usage_monitoring", "admin_ai_cost_controls", "admin_identity_configuration", "admin_identity_recovery", "admin_link_integrity", "admin_learning", "admin_community_support", "admin_community_moderation", "context_manager.read", "context_manager.write", "context_manager.analyze"],
  support: ["admin_device_management", "support_registered_board_check", "admin_community_support", "admin_identity_recovery"],
  community_moderator: ["admin_community_moderation"],
};

class AdminAccessService {
  constructor({ repository, config }) { this.repository = repository; this.config = config; }

  async bootstrap() {
    if (await this.repository.countUsers() > 0) return { created: false };
    if (!this.config.bootstrapUsername || !this.config.bootstrapPassword) return { created: false, setup_required: true };
    validateCredential(this.config.bootstrapUsername, this.config.bootstrapPassword);
    const user = await this.repository.createUser({ username: this.config.bootstrapUsername, password: this.config.bootstrapPassword });
    return { created: true, username: user.username };
  }

  async login({ username, password }) {
    const user = await this.repository.findUser(normalizeUsername(username));
    if (!user || !user.enabled || !verifyPassword(password, user)) {
      await this.repository.audit(user?.admin_id || null, "login_denied", normalizeUsername(username));
      return null;
    }
    const expiresAt = new Date(Date.now() + this.config.sessionHours * 60 * 60 * 1000).toISOString();
    const session = await this.repository.createSession(user.admin_id, expiresAt);
    await this.repository.markLogin(user.admin_id);
    return { token: session.token, expires_at: expiresAt, admin: publicAdmin(user) };
  }

  async session(token) {
    const session = await this.repository.resolveSession(token);
    return session ? { admin: publicAdmin(session), expires_at: session.expires_at } : null;
  }
  async logout(token) { const session = await this.repository.resolveSession(token); await this.repository.revokeSession(token); if (session) await this.repository.audit(session.admin_id, "logout", ""); }
  async actorFor(token) {
    const session = await this.repository.resolveSession(token);
    if (!session) return null;
    return { actor_id: session.admin_id, role: session.role, capabilities: ROLE_CAPABILITIES[session.role] || [] };
  }
  async auditContextRequest(token, eventType, detail) {
    const session = await this.repository.resolveSession(token);
    if (!session) return false;
    await this.repository.audit(session.admin_id, eventType, detail);
    return true;
  }
  async reauthenticate(token, password) {
    const session = await this.repository.resolveSession(token);
    if (!session) return null;
    const user = await this.repository.findUser(normalizeUsername(session.username));
    if (!user || !user.enabled || !verifyPassword(password, user)) {
      await this.repository.audit(session.admin_id, "support_recovery_reauthentication_denied", "");
      return null;
    }
    await this.repository.audit(session.admin_id, "support_recovery_reauthenticated", "");
    return { actor_id: session.admin_id, role: session.role, capabilities: ROLE_CAPABILITIES[session.role] || [] };
  }
  async listAdmins(token) {
    if (!await this.actorFor(token)) return null;
    return this.repository.listUsers();
  }
  async createAdministrator(token, { username, password, role = "administrator" }) {
    const actor = await this.actorFor(token);
    if (!actor || actor.role !== "administrator") return null;
    validateCredential(username, password);
    if (!Object.hasOwn(ROLE_CAPABILITIES, role)) throw new Error("Die gewählte Admin-Rolle ist ungültig.");
    if (await this.repository.findUser(normalizeUsername(username))) throw new Error("Dieser Admin-Benutzername existiert bereits.");
    const user = await this.repository.createUser({ username, password, role });
    await this.repository.audit(actor.actor_id, "administrator_created", `${user.admin_id}:${role}`);
    return publicAdmin(user);
  }
}

function validateCredential(username, password) {
  if (!/^[a-z0-9._@-]{3,120}$/i.test(String(username || ""))) throw new Error("Admin-Benutzername ist ungueltig.");
  if (String(password || "").length < 16) throw new Error("Das initiale Admin-Passwort muss mindestens 16 Zeichen haben.");
}
function publicAdmin(user) { return { admin_id: user.admin_id, username: user.username, role: user.role, capabilities: ROLE_CAPABILITIES[user.role] || [] }; }

module.exports = { AdminAccessService, ROLE_CAPABILITIES };
