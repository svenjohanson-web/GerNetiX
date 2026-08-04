"use strict";

class PostgresHardwareLabRepository {
  constructor(stateStore) {
    this.stateStore = stateStore;
    this.sessions = new Map();
    this.pendingPersistence = Promise.resolve();
  }

  hydrate() {
    const state = this.stateStore.load();
    this.sessions = new Map((state.sessions || []).map((session) => [session.recovery_session_id, session]));
  }

  saveSession(session) {
    this.sessions.set(session.recovery_session_id, session);
    const snapshot = { sessions: Array.from(this.sessions.values()) };
    this.pendingPersistence = this.pendingPersistence.then(() => this.stateStore.save(snapshot));
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

  async flush() {
    await this.pendingPersistence;
  }
}

module.exports = { PostgresHardwareLabRepository };
