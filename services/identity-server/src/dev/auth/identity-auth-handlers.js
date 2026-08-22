"use strict";

function createIdentityAuthHandlers({
  auth, sessions, readJsonBody, sendJson, setSessionCookie, clearSessionCookie,
  readSessionToken, readSession, sanitizeNextPath, mockEmailService, smtpEmailService,
  host, port, identityAppBaseUrl, crypto, generateRegistrationOptions,
  verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse,
  readUserActionContext, passkeyClientError, recordSystemEvent,
  recordPasskeyLoginFailure, evictCachedSessionsForUser, passkeyConfiguration,
}) {
  const passkeyChallenges = new Map();
  const offlineRecoveryAttempts = new Map();

  function subject(username) { return String(username || "").trim().toLowerCase() || "__discoverable_passkey__"; }
  function recoverySubject(token) { return `offline-recovery:${crypto.createHash("sha256").update(String(token || "")).digest("base64url")}`; }
  function storeChallenge(kind, username, challenge, config) {
    passkeyChallenges.set(`${kind}:${subject(username)}`, { challenge, config, expiresAt: Date.now() + 5 * 60 * 1000 });
  }
  function readChallenge(kind, username) {
    const key = `${kind}:${subject(username)}`;
    const value = passkeyChallenges.get(key);
    passkeyChallenges.delete(key);
    if (!value || value.expiresAt < Date.now()) throw new Error("passkey_challenge_expired");
    return value;
  }
  function base64Url(bytes) { return Buffer.from(bytes).toString("base64url"); }
  function clientAddress(req) { return String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "unknown"; }
  function auditHash(value) { return crypto.createHash("sha256").update(String(value || "")).digest("base64url"); }
  function recoveryEvent(req, eventType, severity, message, username, error = null) {
    const supportRecovery = eventType.startsWith("support_recovery_");
    return recordSystemEvent({
      severity, source_service: "identity_server", category: "authentication", event_type: eventType, message,
      impact: eventType === "offline_recovery_passkey_replaced"
        ? "Ein Konto hat seinen Login-Passkey über Offline-Recovery ersetzt; vorherige Sessions wurden widerrufen."
        : supportRecovery
          ? "Support-Recovery bleibt auf die Passkey-Erneuerung begrenzt und wird ohne Zustelladresse, Passwort oder Passkey-Material protokolliert."
          : "Offline-Recovery-Zugriffe werden begrenzt und ohne Recovery-Geheimnisse protokolliert.",
      route: "/app/auth/",
      details: { username_hash: auditHash(String(username || "").trim().toLowerCase()), client_hash: auditHash(clientAddress(req)), ...(error ? { error_code: error.code || "offline_recovery_failed" } : {}) },
    });
  }
  function recoveryLimit(req, username) {
    const now = Date.now(); const windowMs = 10 * 60 * 1000;
    const key = `${clientAddress(req)}:${String(username || "").trim().toLowerCase()}`;
    for (const [attemptKey, attempt] of offlineRecoveryAttempts.entries()) if (attempt.expiresAt <= now) offlineRecoveryAttempts.delete(attemptKey);
    const attempt = offlineRecoveryAttempts.get(key);
    return { key, limited: Boolean(attempt && attempt.count >= 5 && attempt.expiresAt > now), expiresAt: attempt?.expiresAt || now + windowMs };
  }
  function recordRecoveryFailure(key) {
    const now = Date.now(); const current = offlineRecoveryAttempts.get(key);
    offlineRecoveryAttempts.set(key, { count: current && current.expiresAt > now ? current.count + 1 : 1, expiresAt: current && current.expiresAt > now ? current.expiresAt : now + 10 * 60 * 1000 });
  }
  function establish(res, login) { sessions.set(login.session.token, { account: login.account, expiresAt: login.session.expires_at }); setSessionCookie(res, login.session.token, login.session.expires_at); }
  function next(body) { return sanitizeNextPath(body.next) || "/app/dashboard/"; }
  function completeLogin(res, login, body, extra = {}) {
    const destination = next(body);
    if (login.requires_session_takeover) {
      sendJson(res, 409, {
        error: "active_session_exists",
        message: "Für dieses Konto ist bereits eine andere Sitzung aktiv.",
        pending_login_token: login.pending_login_token,
        pending_login_expires_at: login.pending_login_expires_at,
        next: destination,
        ...extra,
      });
      return;
    }
    establish(res, login);
    sendJson(res, 200, { account: login.account, next: destination, ...extra });
  }

  async function handleLogin(req, res) {
    const body = await readJsonBody(req);
    try { const login = await auth().login_local(body.identifier, body.password); if (body.locale) login.account = await auth().update_preferred_locale(login.account.user_id, body.locale); completeLogin(res, login, body); }
    catch (error) { sendJson(res, error.status || 401, { error: error.code || "invalid_login", message: "Login fehlgeschlagen." }); }
  }
  async function handleRegister(req, res) {
    const body = await readJsonBody(req);
    try {
      const beforeCount = mockEmailService.sentMessages.length;
      const registered = await auth().register_local(body.username, body.email, body.password, body.accepted_terms === true, body.password_repeat, { preferredLocale: body.locale });
      if (smtpEmailService.configured()) { sendJson(res, 202, { account: registered.account, requires_email_verification: true, message: "Konto erstellt. Bitte bestätige jetzt die E-Mail-Adresse." }); return; }
      const verification = mockEmailService.sentMessages.slice(beforeCount).find((message) => message.type === "verification");
      const token = verification ? new URL(verification.link).searchParams.get("token") : "";
      if (token) await auth().verify_email(token);
      const login = await auth().login_local(body.email, body.password); establish(res, login);
      sendJson(res, 201, { account: login.account, next: next(body) });
    } catch (error) { sendJson(res, error.status || 400, { error: error.code || "registration_failed", message: registrationMessage(error) }); }
  }
  async function handleExternalLogin(req, res) {
    const body = await readJsonBody(req); const provider = String(body.provider || "").trim().toLowerCase(); const email = String(body.email || "").trim().toLowerCase(); const username = String(body.username || "").trim();
    try {
      if (!provider) throw new Error("provider_required"); if (!email) throw new Error("email_required");
      const login = await auth().login_external(provider, { provider, provider_user_id: body.provider_user_id || `${provider}:${email}`, email, email_verified: body.email_verified !== false, username: username || email.split("@")[0] });
      if (!login.session && !login.requires_session_takeover) { sendJson(res, 202, { account: login.account, requires_email_verification: true, message: "Account erstellt, E-Mail-Verifizierung erforderlich." }); return; }
      completeLogin(res, login, body, { provider });
    } catch (error) { sendJson(res, error.status || 400, { error: error.code || "external_login_failed", message: externalLoginMessage(error) }); }
  }
  async function handleLogout(req, res) { const token = readSessionToken(req); if (token) { sessions.delete(token); await auth().logout(token); } clearSessionCookie(res); sendJson(res, 200, { logged_out: true }); }
  async function handleSession(req, res) {
    const session = await readSession(req);
    if (!session) {
      const token = readSessionToken(req);
      const described = token ? await auth().describe_session_token(token) : null;
      sendJson(res, 401, {
        authenticated: false,
        ...(described?.status === "revoked" ? { error: "session_revoked", reason: described.reason || "revoked" } : {}),
      });
      return;
    }
    sendJson(res, 200, { authenticated: true, account: session.account, expires_at: session.expiresAt });
  }
  async function handleSessionTakeover(req, res) {
    try {
      const body = await readJsonBody(req);
      const login = await auth().complete_session_takeover(body.pending_login_token);
      evictCachedSessionsForUser(login.account.user_id);
      establish(res, login);
      sendJson(res, 200, { account: login.account, next: next(body), replaced_session: true });
    } catch (error) {
      sendJson(res, error.status || 401, { error: error.code || "invalid_pending_login", message: "Sitzungswechsel ist abgelaufen oder ungültig." });
    }
  }
  async function handleSessionTakeoverCancel(req, res) {
    try {
      const body = await readJsonBody(req);
      sendJson(res, 200, await auth().cancel_session_takeover(body.pending_login_token));
    } catch (error) {
      sendJson(res, error.status || 401, { error: error.code || "invalid_pending_login", message: "Sitzungswechsel ist abgelaufen oder ungültig." });
    }
  }
  async function handleSessionSecure(req, res) {
    try {
      const body = await readJsonBody(req);
      const secured = await auth().secure_account_from_pending_login(body.pending_login_token);
      evictCachedSessionsForUser(secured.account.user_id);
      establish(res, secured);
      sendJson(res, 200, { secured: true, recovery_required: false, next: "/app/account-setup/?security=review" });
    } catch (error) {
      sendJson(res, error.status || 401, { error: error.code || "invalid_pending_login", message: "Kontosicherung konnte nicht gestartet werden." });
    }
  }

  async function handlePasskeyRegistrationOptions(req, res) {
    try { const body = await readJsonBody(req); const username = String(body.username || "").trim(); if (username.length < 3) throw new Error("invalid_username"); const config = passkeyConfiguration.forRequest(req, { mutation: true }); const options = await generateRegistrationOptions({ rpName: "GerNetiX", rpID: config.rpID, userName: username, attestationType: "none", authenticatorSelection: { residentKey: "required", userVerification: "required" } }); storeChallenge("register", username, options.challenge, config); sendJson(res, 200, options); }
    catch (error) { sendJson(res, error.status || 400, { error: error.code || (error.message === "invalid_username" ? "invalid_username" : "passkey_registration_unavailable"), message: "Konto wurde nicht angelegt. Grund: Passkey konnte nicht vorbereitet werden." }); }
  }
  async function handlePasskeyRegistrationVerify(req, res) {
    try { const body = await readJsonBody(req); const username = String(body.username || "").trim(); if (body.accepted_terms !== true) throw new Error("terms_not_accepted"); passkeyConfiguration.forRequest(req, { mutation: true }); const challenge = readChallenge("register", username); const verification = await verifyRegistrationResponse({ response: body.credential, expectedChallenge: challenge.challenge, expectedOrigin: challenge.config.origin, expectedRPID: challenge.config.rpID, requireUserVerification: true }); if (!verification.verified || !verification.registrationInfo) throw new Error("passkey_registration_not_verified"); const credential = verification.registrationInfo.credential; const created = await auth().create_passkey_account(username, { credentialId: credential.id, publicKey: base64Url(credential.publicKey), counter: credential.counter, transports: credential.transports || [], rpId: challenge.config.rpID }, { preferredLocale: body.locale }); establish(res, created); sendJson(res, 201, { account: created.account, message: "Konto wurde angelegt.", next: next(body) }); }
    catch (error) { const message = error.message === "terms_not_accepted" ? "Konto wurde nicht angelegt. Grund: Bitte bestätige die Nutzungsbedingungen." : host === "127.0.0.1" ? `Konto wurde nicht angelegt. Grund: Passkey konnte nicht verifiziert werden: ${error.message || "unbekannter Fehler"}` : "Konto wurde nicht angelegt. Grund: Passkey konnte nicht verifiziert werden."; sendJson(res, error.status || 400, { error: error.code || (error.message === "terms_not_accepted" ? "terms_not_accepted" : "passkey_registration_failed"), message }); }
  }
  async function handlePasskeyAuthenticationOptions(req, res) {
    let account = null; const actionContext = readUserActionContext(req, "identity.login.passkey");
    try { const body = await readJsonBody(req); const username = String(body.username || "").trim(); const config = passkeyConfiguration.forRequest(req); account = username ? await auth().get_passkey_login_candidate(username, config.rpID) : null; const options = await generateAuthenticationOptions({ rpID: config.rpID, userVerification: "required", ...(account ? { allowCredentials: account.passkey_credentials.map((item) => ({ id: item.credential_id, transports: item.transports || [] })) } : {}) }); storeChallenge("authenticate", username, options.challenge, config); sendJson(res, 200, options); }
    catch (error) { await recordPasskeyLoginFailure("options", error, account, actionContext?.actionId); const clientError = passkeyClientError("options", error); sendJson(res, clientError.status, clientError); }
  }
  async function handlePasskeyAuthenticationVerify(req, res) {
    let account = null; const actionContext = readUserActionContext(req, "identity.login.passkey");
    try { const body = await readJsonBody(req); const username = String(body.username || "").trim(); const config = passkeyConfiguration.forRequest(req); account = username ? await auth().get_passkey_login_candidate(username, config.rpID) : await auth().get_passkey_login_candidate_by_credential_id(body.credential?.id, config.rpID); const selected = account.passkey_credentials.find((item) => item.credential_id === body.credential?.id); if (!selected) throw Object.assign(new Error("passkey_credential_not_allowed"), { code: "passkey_credential_not_allowed" }); const challenge = readChallenge("authenticate", username); const verification = await verifyAuthenticationResponse({ response: body.credential, expectedChallenge: challenge.challenge, expectedOrigin: challenge.config.origin, expectedRPID: challenge.config.rpID, requireUserVerification: true, credential: { id: selected.credential_id, publicKey: Buffer.from(selected.public_key, "base64url"), counter: Number(selected.counter || 0), transports: selected.transports || [] } }); if (!verification.verified) throw new Error("passkey_authentication_not_verified"); const login = await auth().login_passkey_by_credential_id(selected.credential_id, verification.authenticationInfo.newCounter, config.rpID); if (body.locale) login.account = await auth().update_preferred_locale(login.account.user_id, body.locale); completeLogin(res, login, body); }
    catch (error) { await recordPasskeyLoginFailure("verification", error, account, actionContext?.actionId); const clientError = passkeyClientError("verification", error); sendJson(res, clientError.status, clientError); }
  }
  async function handleOfflineRecoveryStart(req, res) {
    const body = await readJsonBody(req); const username = String(body.username || ""); const rateLimit = recoveryLimit(req, username);
    if (rateLimit.limited) { await recoveryEvent(req, "offline_recovery_rate_limited", "warning", "Offline-Recovery wurde wegen zu vieler Fehlversuche begrenzt.", username); sendJson(res, 429, { error: "offline_recovery_rate_limited", message: "Zu viele Recovery-Versuche. Bitte warte einige Minuten." }); return; }
    try { const recovery = await auth().start_offline_recovery(username, String(body.recovery_set || "")); offlineRecoveryAttempts.delete(rateLimit.key); await recoveryEvent(req, "offline_recovery_started", "info", "Offline-Recovery wurde vorbereitet.", username); sendJson(res, 200, recovery); }
    catch (error) { recordRecoveryFailure(rateLimit.key); await recoveryEvent(req, "offline_recovery_failed", "warning", "Offline-Recovery-Set konnte nicht geprüft werden.", username, error); sendJson(res, error.status || 401, { error: error.code || "offline_recovery_failed", message: "Recovery-Set konnte nicht geprüft werden." }); }
  }
  async function handleOfflineRecoveryPasskeyOptions(req, res) {
    try { const body = await readJsonBody(req); const recoveryToken = String(body.recovery_token || ""); const account = await auth().get_offline_recovery_account(recoveryToken); const config = passkeyConfiguration.forRequest(req, { mutation: true }); const existing = await auth().list_passkeys(account.id); const options = await generateRegistrationOptions({ rpName: "GerNetiX", rpID: config.rpID, userID: Buffer.from(account.id), userName: account.username, userDisplayName: account.username, attestationType: "none", authenticatorSelection: { residentKey: "required", userVerification: "required" }, excludeCredentials: existing.filter((item) => item.rp_id === config.rpID).map((item) => ({ id: item.credential_id, transports: item.transports || [] })) }); storeChallenge("offline-recovery", recoverySubject(recoveryToken), options.challenge, config); sendJson(res, 200, options); }
    catch (error) { sendJson(res, error.status || 401, { error: error.code || "offline_recovery_passkey_unavailable", message: "Neuer Passkey konnte nicht vorbereitet werden." }); }
  }
  async function handleOfflineRecoveryPasskeyVerify(req, res) {
    try { const body = await readJsonBody(req); const recoveryToken = String(body.recovery_token || ""); passkeyConfiguration.forRequest(req, { mutation: true }); await auth().get_offline_recovery_account(recoveryToken); const challenge = readChallenge("offline-recovery", recoverySubject(recoveryToken)); const verification = await verifyRegistrationResponse({ response: body.credential, expectedChallenge: challenge.challenge, expectedOrigin: challenge.config.origin, expectedRPID: challenge.config.rpID, requireUserVerification: true }); if (!verification.verified || !verification.registrationInfo) throw new Error("offline_recovery_passkey_not_verified"); const credential = verification.registrationInfo.credential; const completed = await auth().complete_offline_recovery(recoveryToken, { credentialId: credential.id, publicKey: base64Url(credential.publicKey), counter: credential.counter, transports: credential.transports || [], rpId: challenge.config.rpID }); if (body.locale) completed.account = await auth().update_preferred_locale(completed.account.user_id, body.locale); evictCachedSessionsForUser(completed.account.user_id); await recoveryEvent(req, "offline_recovery_passkey_replaced", "warning", "Offline-Recovery hat den Login-Passkey ersetzt.", completed.account.username); establish(res, completed); sendJson(res, 200, { account: completed.account, next: next(body) }); }
    catch (error) { sendJson(res, error.status || 401, { error: error.code || "offline_recovery_passkey_failed", message: "Zugang konnte nicht wiederhergestellt werden." }); }
  }
  async function handleSupportRecoveryLogin(req, res) {
    let username = "";
    try {
      const body = await readJsonBody(req);
      username = String(body.username || "");
      const result = await auth().login_support_recovery(username, String(body.temporary_password || ""));
      await recoveryEvent(req, "support_recovery_password_accepted", "warning", "Vorläufiges Support-Passwort wurde angenommen; bestehende Sitzungen wurden widerrufen.", username);
      sendJson(res, 200, result);
    } catch (error) {
      await recoveryEvent(req, "support_recovery_password_failed", "warning", "Vorläufiges Support-Passwort wurde abgewiesen.", username, error);
      sendJson(res, error.status || 401, { error: error.code || "support_recovery_invalid", message: "Vorläufiges Passwort ist ungültig oder abgelaufen." });
    }
  }
  async function handleSupportRecoveryPasskeyOptions(req, res) {
    try {
      const body = await readJsonBody(req); const token = String(body.support_recovery_token || "");
      const { account } = await auth().get_support_recovery_account(token);
      const config = passkeyConfiguration.forRequest(req, { mutation: true });
      const existing = await auth().list_passkeys(account.id);
      const options = await generateRegistrationOptions({ rpName: "GerNetiX", rpID: config.rpID, userID: Buffer.from(account.id), userName: account.username, userDisplayName: account.username, attestationType: "none", authenticatorSelection: { residentKey: "required", userVerification: "required" }, excludeCredentials: existing.filter((item) => item.rp_id === config.rpID).map((item) => ({ id: item.credential_id, transports: item.transports || [] })) });
      storeChallenge("support-recovery", recoverySubject(token), options.challenge, config); sendJson(res, 200, options);
    } catch (error) { await recoveryEvent(req, "support_recovery_passkey_options_failed", "warning", "Passkey-Erneuerung für Support-Recovery konnte nicht vorbereitet werden.", "", error); sendJson(res, error.status || 401, { error: error.code || "support_recovery_passkey_unavailable", message: "Neuer Passkey konnte nicht vorbereitet werden." }); }
  }
  async function handleSupportRecoveryPasskeyVerify(req, res) {
    try {
      const body = await readJsonBody(req); const token = String(body.support_recovery_token || "");
      passkeyConfiguration.forRequest(req, { mutation: true });
      await auth().get_support_recovery_account(token);
      const challenge = readChallenge("support-recovery", recoverySubject(token));
      const verification = await verifyRegistrationResponse({ response: body.credential, expectedChallenge: challenge.challenge, expectedOrigin: challenge.config.origin, expectedRPID: challenge.config.rpID, requireUserVerification: true });
      if (!verification.verified || !verification.registrationInfo) throw new Error("support_recovery_passkey_not_verified");
      const credential = verification.registrationInfo.credential;
      const completed = await auth().complete_support_recovery(token, { credentialId: credential.id, publicKey: base64Url(credential.publicKey), counter: credential.counter, transports: credential.transports || [], rpId: challenge.config.rpID });
      evictCachedSessionsForUser(completed.account.user_id); establish(res, completed);
      await recoveryEvent(req, "support_recovery_passkey_completed", "warning", "Support-Recovery hat einen neuen kanonischen Passkey eingerichtet.", completed.account.username);
      sendJson(res, 200, { account: completed.account, next: next(body) });
    } catch (error) { await recoveryEvent(req, "support_recovery_passkey_failed", "warning", "Support-Recovery konnte keinen neuen Passkey abschließen.", "", error); sendJson(res, error.status || 401, { error: error.code || "support_recovery_passkey_failed", message: "Support-Wiederherstellung konnte nicht abgeschlossen werden." }); }
  }
  async function handlePasskeyManagementList(req, res) {
    const session = await readSession(req); if (!session) { sendJson(res, 401, { error: "not_authenticated" }); return; }
    sendJson(res, 200, { items: await auth().list_passkeys(session.account.user_id) });
  }
  async function handlePasskeyManagementOptions(req, res) {
    try {
      const session = await readSession(req); if (!session) { sendJson(res, 401, { error: "not_authenticated" }); return; }
      const config = passkeyConfiguration.forRequest(req, { mutation: true }); const existing = await auth().list_passkeys(session.account.user_id);
      const options = await generateRegistrationOptions({ rpName: "GerNetiX", rpID: config.rpID, userID: Buffer.from(session.account.user_id), userName: session.account.username, userDisplayName: session.account.username, attestationType: "none", authenticatorSelection: { residentKey: "required", userVerification: "required" }, excludeCredentials: existing.filter((item) => item.rp_id === config.rpID).map((item) => ({ id: item.credential_id, transports: item.transports || [] })) });
      storeChallenge("manage-passkey", session.account.user_id, options.challenge, config); sendJson(res, 200, options);
    } catch (error) { sendJson(res, error.status || 400, { error: error.code || "passkey_management_unavailable", message: "Zusätzlicher Passkey konnte nicht vorbereitet werden." }); }
  }
  async function handlePasskeyManagementVerify(req, res) {
    try {
      const session = await readSession(req); if (!session) { sendJson(res, 401, { error: "not_authenticated" }); return; }
      const body = await readJsonBody(req); passkeyConfiguration.forRequest(req, { mutation: true });
      const challenge = readChallenge("manage-passkey", session.account.user_id);
      const verification = await verifyRegistrationResponse({ response: body.credential, expectedChallenge: challenge.challenge, expectedOrigin: challenge.config.origin, expectedRPID: challenge.config.rpID, requireUserVerification: true });
      if (!verification.verified || !verification.registrationInfo) throw new Error("passkey_registration_not_verified");
      const credential = verification.registrationInfo.credential;
      sendJson(res, 201, await auth().add_passkey(session.account.user_id, { credentialId: credential.id, publicKey: base64Url(credential.publicKey), counter: credential.counter, transports: credential.transports || [], rpId: challenge.config.rpID, label: String(body.label || "Zusätzlicher Passkey") }));
    } catch (error) { sendJson(res, error.status || 400, { error: error.code || "passkey_management_failed", message: "Zusätzlicher Passkey konnte nicht gespeichert werden." }); }
  }
  function registrationMessage(error) {
    if (error.code === "username_taken") return "Dieser Benutzername ist bereits vergeben.";
    if (error.code === "email_taken") return "Diese E-Mail-Adresse ist bereits registriert.";
    if (error.code === "password_mismatch") return "Die beiden Passwörter stimmen nicht überein.";
    if (error.code === "terms_not_accepted") return "Bitte stimme den Nutzungsbedingungen zu.";
    return "Konto konnte nicht erstellt werden.";
  }
  function externalLoginMessage(error) {
    if (error.message === "provider_required") return "Bitte wähle einen Login-Anbieter.";
    if (error.message === "email_required") return "Bitte gib eine E-Mail-Adresse an.";
    if (error.code === "external_email_conflict") return "Diese E-Mail-Adresse gehört bereits zu einem anderen Konto.";
    return "Externer Login fehlgeschlagen.";
  }
  return { handleLogin, handleRegister, handleExternalLogin, handleLogout, handleSession, handleSessionTakeover, handleSessionTakeoverCancel, handleSessionSecure, handlePasskeyRegistrationOptions, handlePasskeyRegistrationVerify, handlePasskeyAuthenticationOptions, handlePasskeyAuthenticationVerify, handleOfflineRecoveryStart, handleOfflineRecoveryPasskeyOptions, handleOfflineRecoveryPasskeyVerify, handleSupportRecoveryLogin, handleSupportRecoveryPasskeyOptions, handleSupportRecoveryPasskeyVerify, handlePasskeyManagementList, handlePasskeyManagementOptions, handlePasskeyManagementVerify };
}

module.exports = { createIdentityAuthHandlers };
