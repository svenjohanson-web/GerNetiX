"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createIdentityAuthHandlers } = require("../src/dev/auth/identity-auth-handlers");

function harness({ login = null } = {}) {
  const responses = [];
  const sessions = new Map();
  const auth = {
    async login_local() {
      if (!login) { const error = new Error("invalid"); error.code = "invalid_login"; throw error; }
      return login;
    },
    async logout(token) { this.loggedOut = token; },
  };
  const handlers = createIdentityAuthHandlers({
    auth: () => auth, sessions, crypto,
    readJsonBody: async (req) => req.body,
    sendJson: (_res, status, body) => responses.push({ status, body }),
    setSessionCookie: () => {}, clearSessionCookie: () => {},
    readSessionToken: (req) => req.token || "", readSession: async () => null,
    sanitizeNextPath: (value) => String(value || "").startsWith("/") ? value : "",
    mockEmailService: { sentMessages: [] }, smtpEmailService: { configured: () => false },
    host: "127.0.0.1", port: 4300, identityAppBaseUrl: "", generateRegistrationOptions: async () => ({}),
    verifyRegistrationResponse: async () => ({}), generateAuthenticationOptions: async () => ({}), verifyAuthenticationResponse: async () => ({}),
    readUserActionContext: () => null, passkeyClientError: () => ({ status: 400 }), recordSystemEvent: async () => {},
    recordPasskeyLoginFailure: async () => {}, evictCachedSessionsForUser: () => {},
  });
  return { auth, handlers, responses, sessions };
}

test("auth handler creates a session for local login and preserves a safe return path", async () => {
  const login = { account: { user_id: "user-1" }, session: { token: "token-1", expires_at: "2030-01-01T00:00:00.000Z" } };
  const context = harness({ login });
  await context.handlers.handleLogin({ body: { identifier: "ada", password: "secret", next: "/app/learn/" } }, {});
  assert.deepEqual(context.sessions.get("token-1"), { account: login.account, expiresAt: login.session.expires_at });
  assert.deepEqual(context.responses, [{ status: 200, body: { account: login.account, next: "/app/learn/" } }]);
});

test("auth handler revokes the local cache and identity session during logout", async () => {
  const context = harness();
  context.sessions.set("token-1", { account: { user_id: "user-1" } });
  await context.handlers.handleLogout({ token: "token-1" }, {});
  assert.equal(context.sessions.has("token-1"), false);
  assert.equal(context.auth.loggedOut, "token-1");
  assert.deepEqual(context.responses, [{ status: 200, body: { logged_out: true } }]);
});
