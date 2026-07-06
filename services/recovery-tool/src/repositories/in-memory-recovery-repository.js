class InMemoryRecoveryRepository {
  constructor(seed = {}) {
    this.sessions = new Map((seed.sessions || []).map((item) => [item.recovery_session_id, item]));
  }

  saveSession(session) {
    this.sessions.set(session.recovery_session_id, session);
    return session;
  }

  findSession(sessionId) {
    return this.sessions.get(sessionId) || null;
  }

  listSessions(filter = {}) {
    return Array.from(this.sessions.values()).filter((session) => {
      if (filter.account_id && session.account_id !== filter.account_id) return false;
      if (filter.status && session.status !== filter.status) return false;
      return true;
    });
  }
}

module.exports = { InMemoryRecoveryRepository };
