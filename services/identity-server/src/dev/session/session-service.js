"use strict";

function createSessionService({ auth, parseCookies, cookieName = "gernetix_demo_session" }) {
  const sessions = new Map();

  function readToken(req) {
    const cookies = parseCookies(req.headers.cookie || "");
    return cookies[cookieName] || "";
  }

  async function read(req) {
    const token = readToken(req);
    if (!token) return null;
    const cached = sessions.get(token);
    if (cached) {
      const resolved = await auth().resolve_session_token(token);
      if (resolved) {
        const refreshed = { account: resolved.account, expiresAt: resolved.session.expires_at };
        sessions.set(token, refreshed);
        return refreshed;
      }
      sessions.delete(token);
    }
    const resolved = await auth().resolve_session_token(token);
    if (!resolved) return null;
    const restored = { account: resolved.account, expiresAt: resolved.session.expires_at };
    sessions.set(token, restored);
    return restored;
  }

  function establish(token, account, expiresAt) {
    const session = { account, expiresAt };
    sessions.set(token, session);
    return session;
  }

  function evictUser(userId) {
    for (const [token, session] of sessions.entries()) {
      if (session.account?.user_id === userId) sessions.delete(token);
    }
  }

  function updateAccount(req, account) {
    const token = readToken(req);
    const existing = sessions.get(token);
    if (existing) sessions.set(token, { ...existing, account });
  }

  return { sessions, read, readToken, establish, evictUser, updateAccount };
}

module.exports = { createSessionService };
