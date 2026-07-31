"use strict";

function createSessionAccess({ resolveSession, sendJson }) {
  if (typeof resolveSession !== "function" || typeof sendJson !== "function") {
    throw new TypeError("resolveSession and sendJson are required");
  }

  async function requireSession(req, res) {
    const session = await resolveSession(req);
    if (session) return session;
    sendJson(res, 401, { error: "not_authenticated" });
    return null;
  }

  return { requireSession };
}

module.exports = { createSessionAccess };
