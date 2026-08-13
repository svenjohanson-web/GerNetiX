"use strict";

const { readUserActionContext } = require("../../services/user-action-events");

function registerAuthRoutes({
  registry,
  readJsonBody,
  sendJson,
  redirect,
  recordSystemEvent,
  passkeyBrowserFailureEvent,
  auth,
  handleLogin,
  handleRegister,
  handlePasskeyRegistrationOptions,
  handlePasskeyRegistrationVerify,
  handlePasskeyAuthenticationOptions,
  handlePasskeyAuthenticationVerify,
  handleExternalLogin,
  handleLogout,
  handleSession,
  handleSessionTakeover,
  handleSessionTakeoverCancel,
  handleSessionSecure,
  handleOfflineRecoveryStart,
  handleOfflineRecoveryPasskeyOptions,
  handleOfflineRecoveryPasskeyVerify,
}) {
  const handlers = new Map([
    ["/api/login", handleLogin],
    ["/api/register", handleRegister],
    ["/api/passkeys/registration/options", handlePasskeyRegistrationOptions],
    ["/api/passkeys/registration/verify", handlePasskeyRegistrationVerify],
    ["/api/passkeys/authentication/options", handlePasskeyAuthenticationOptions],
    ["/api/passkeys/authentication/verify", handlePasskeyAuthenticationVerify],
    ["/api/login/external", handleExternalLogin],
    ["/api/logout", handleLogout],
    ["/api/session/takeover", handleSessionTakeover],
    ["/api/session/takeover/cancel", handleSessionTakeoverCancel],
    ["/api/session/secure", handleSessionSecure],
  ]);
  for (const [path, handler] of handlers) {
    registry.register({ method: "POST", path, handler: ({ req, res }) => handler(req, res) });
  }

  registry.register({
    method: "POST",
    path: "/api/passkeys/client-error",
    async handler({ req, res }) {
      const actionContext = readUserActionContext(req, "identity.login.passkey");
      await recordSystemEvent(passkeyBrowserFailureEvent(await readJsonBody(req), actionContext?.actionId));
      sendJson(res, 202, { accepted: true });
    },
  });
  registry.register({
    method: "POST",
    path: "/api/password-reset/request",
    async handler({ req, res }) {
      const body = await readJsonBody(req);
      sendJson(res, 202, await auth().request_password_reset(body.email));
    },
  });
  registry.register({
    method: "POST",
    path: "/api/password-reset/complete",
    async handler({ req, res }) {
      const body = await readJsonBody(req);
      sendJson(res, 200, await auth().reset_password(body.token, body.password));
    },
  });
  registry.register({
    method: "GET",
    path: "/verify-email",
    async handler({ res, url }) {
      try {
        await auth().verify_email(url.searchParams.get("token") || "");
        redirect(res, "/app/auth/?verification=success");
      } catch {
        redirect(res, "/app/auth/?verification=invalid");
      }
    },
  });
  registry.register({
    method: "GET",
    path: "/reset-password",
    handler({ res, url }) {
      redirect(res, `/app/auth/?mode=reset&token=${encodeURIComponent(url.searchParams.get("token") || "")}`);
    },
  });
  registry.register({
    method: "*",
    path: "/api/session",
    handler: ({ req, res }) => handleSession(req, res),
  });
  for (const [path, handler] of [
    ["/api/recovery/offline/start", handleOfflineRecoveryStart],
    ["/api/recovery/offline/passkey/options", handleOfflineRecoveryPasskeyOptions],
    ["/api/recovery/offline/passkey/verify", handleOfflineRecoveryPasskeyVerify],
  ]) {
    registry.register({ method: "POST", path, handler: ({ req, res }) => handler(req, res) });
  }
}

module.exports = { registerAuthRoutes };
