class EphemeralVoiceSessionRepository {
  constructor() {
    this.sessions = new Map();
  }

  save(session) {
    this.sessions.set(session.session_id, structuredClone(session));
    return structuredClone(session);
  }

  find(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? structuredClone(session) : null;
  }

  delete(sessionId) {
    return this.sessions.delete(sessionId);
  }

  purgeExpired(now = Date.now()) {
    const removed = [];
    for (const [sessionId, session] of this.sessions) {
      if (Date.parse(session.expires_at) <= now) {
        this.sessions.delete(sessionId);
        removed.push(structuredClone(session));
      }
    }
    return removed;
  }
}

module.exports = { EphemeralVoiceSessionRepository };
