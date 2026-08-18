const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");
const recoveryForm = document.querySelector("#recovery-form");
const modeToggle = document.querySelector("#auth-mode-toggle");
const recoveryModeToggle = document.querySelector("#recovery-mode-toggle");
const guestAccessButton = document.querySelector("#guest-access-button");
const guestAccess = document.querySelector(".guest-access");
const activeSessionDialog = document.querySelector("#active-session-dialog");
const activeSessionStatus = document.querySelector("#active-session-status");
let i18n = null;
let pendingLogin = null;

function tr(key, fallback, variables = {}) {
  return i18n ? i18n.t(key, variables, fallback) : fallback;
}

function currentLocale() {
  return i18n?.locale || window.GerNetiXI18n?.resolveLocale?.() || "de";
}

const titleElement = document.querySelector("#login-title");
const statusElement = document.querySelector("#status");
const identifierField = document.querySelector("#login-identifier-field");
const query = new URLSearchParams(window.location.search);
const nextUrl = query.get("next") || "/app/dashboard/";
let mode = query.get("mode") === "register" ? "register" : query.get("mode") === "recovery" ? "recovery" : "login";
const securingAccount = false;

initializeI18n();
activeSessionDialog.addEventListener("cancel", (event) => event.preventDefault());

async function initializeI18n() {
  i18n = window.GerNetiXPublicI18n || null;
  if (!i18n) {
    document.addEventListener("gernetix:public-i18n-ready", (event) => {
      i18n = event.detail;
      applyMode(false);
    }, { once: true });
  }
  applyMode(false);
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const action = window.GerNetiXActionOps?.begin("identity.login.passkey", { timeoutMs: 120000 });
  const username = String(new FormData(loginForm).get("identifier") || "").trim();
  statusElement.textContent = tr("auth.status.passkey.requesting", "Passkey wird angefordert …");
  let browserPasskeyRequest = false;
  let actionStage = "options";
  try {
    await ensureIdentityLoginReady();
    const options = await actionStep(action, "auth.options", () => postJson(
      "/api/passkeys/authentication/options",
      username ? { username } : {},
      actionHeaders(action),
    ), "authentication_options_failed");
    actionStage = "webauthn";
    browserPasskeyRequest = true;
    const credential = await actionStep(action, "auth.webauthn", () => navigator.credentials.get({ publicKey: parseRequestOptions(options) }), passkeyActionReason);
    browserPasskeyRequest = false;
    actionStage = "verification";
    const result = await actionStep(action, "auth.verify", () => postJson("/api/passkeys/authentication/verify", {
      ...(username ? { username } : {}),
      credential: credentialJson(credential),
      next: nextUrl,
      locale: currentLocale(),
    }, actionHeaders(action)), passkeyActionReason);
    await actionStep(action, "auth.session", async () => result, "authentication_verification_failed");
    action?.succeed();
    window.location.href = result.next || "/app/dashboard/";
  } catch (error) {
    if (browserPasskeyRequest) await reportPasskeyBrowserError("authentication", error, action);
    if (error?.code === "active_session_exists" && error?.payload?.pending_login_token) {
      action?.succeed();
      showActiveSessionDialog(error.payload);
      return;
    }
    action?.fail(actionStage === "options" ? "authentication_options_failed" : passkeyActionReason(error));
    const message = passkeyLoginFailureMessage(error);
    statusElement.textContent = action?.failureMessage(message) || message;
  }
});

document.querySelector("#cancel-session-takeover").addEventListener("click", async () => {
  await completePendingSessionAction("/api/session/takeover/cancel", "Anmeldung wurde abgebrochen.", () => hideActiveSessionDialog());
});

document.querySelector("#confirm-session-takeover").addEventListener("click", async () => {
  await completePendingSessionAction("/api/session/takeover", "Sitzung wird gewechselt …", (result) => {
    window.location.href = result.next || pendingLogin?.next || nextUrl;
  });
});

document.querySelector("#secure-account").addEventListener("click", async () => {
  await completePendingSessionAction("/api/session/secure", "Andere Sitzungen werden beendet …", (result) => {
    window.location.href = result.next || "/app/account-setup/?security=review";
  });
});

document.querySelector("#show-identifier-login").addEventListener("click", () => {
  identifierField.classList.remove("hidden");
  document.querySelector("#login-identifier").focus();
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(registerForm);
  const username = data.get("username");
  statusElement.textContent = tr("auth.status.passkey.creating", "Passkey wird eingerichtet …");
  let browserPasskeyRequest = false;
  try {
    const options = await postJson("/api/passkeys/registration/options", { username });
    browserPasskeyRequest = true;
    const credential = await navigator.credentials.create({ publicKey: parseCreationOptions(options) });
    browserPasskeyRequest = false;
    const result = await postJson("/api/passkeys/registration/verify", {
      username,
      accepted_terms: data.get("accepted_terms") === "on",
      credential: credentialJson(credential),
      next: nextUrl,
      locale: currentLocale(),
    });
    statusElement.textContent = tr("auth.status.account.created", "Konto wurde angelegt.");
    window.setTimeout(() => { window.location.href = result.next || "/app/dashboard/"; }, 900);
  } catch (error) {
    if (browserPasskeyRequest) await reportPasskeyBrowserError("registration", error);
    statusElement.textContent = registrationFailureMessage(error);
  }
});

modeToggle.addEventListener("click", () => { mode = mode === "login" ? "register" : "login"; applyMode(true); });
recoveryModeToggle.addEventListener("click", () => { mode = "recovery"; applyMode(true); });
recoveryForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = new FormData(recoveryForm);
  statusElement.textContent = tr("auth.status.recovery.checking", "Recovery-Set wird geprüft …");
  let browserPasskeyRequest = false;
  try {
    const recovery = await postJson("/api/recovery/offline/start", Object.fromEntries(data));
    statusElement.textContent = tr("auth.status.recovery.confirmed", "Recovery-Set bestätigt. Neuer Passkey wird eingerichtet …");
    const options = await postJson("/api/recovery/offline/passkey/options", { recovery_token: recovery.recovery_token });
    browserPasskeyRequest = true;
    const credential = await navigator.credentials.create({ publicKey: parseCreationOptions(options) });
    browserPasskeyRequest = false;
    const result = await postJson("/api/recovery/offline/passkey/verify", {
      recovery_token: recovery.recovery_token,
      credential: credentialJson(credential),
      next: nextUrl,
      locale: currentLocale(),
    });
    statusElement.textContent = tr("auth.status.recovery.restored", "Zugang wurde wiederhergestellt.");
    window.setTimeout(() => { window.location.href = result.next || "/app/dashboard/"; }, 600);
  } catch (error) {
    if (browserPasskeyRequest) await reportPasskeyBrowserError("registration", error);
    statusElement.textContent = localizedErrorMessage(error, "auth.status.recovery.failed", "Zugang konnte nicht wiederhergestellt werden.");
  }
});
guestAccessButton.addEventListener("click", async () => {
  statusElement.textContent = tr("auth.status.guest.creating", "Gastzugang wird angelegt …");
  try {
    const result = await postJson("/api/account/guest", { next: nextUrl, locale: currentLocale() });
    window.location.href = result.next || "/app/dashboard/";
  } catch (error) {
    statusElement.textContent = localizedErrorMessage(error, "auth.status.guest.failed", "Gastzugang konnte nicht angelegt werden.");
  }
});

function applyMode(updateUrl) {
  const registration = mode === "register";
  const recovery = mode === "recovery";
  loginForm.classList.toggle("hidden", registration || recovery);
  registerForm.classList.toggle("hidden", !registration);
  recoveryForm.classList.toggle("hidden", !recovery);
  guestAccess.classList.toggle("hidden", registration || recovery);
  titleElement.textContent = registration
    ? tr("auth.register.step", "Konto anlegen")
    : recovery
      ? tr("auth.recovery.title", "Zugang wiederherstellen")
      : tr("auth.login.title", "Anmelden");
  if (recovery && securingAccount) {
    titleElement.textContent = "Konto sichern";
    recoveryForm.querySelector(".form-hint").textContent = "Alle bisherigen Sitzungen wurden beendet. Bestätige jetzt dein Offline-Recovery-Set und richte anschließend einen neuen Passkey ein.";
  }
  modeToggle.textContent = registration
    ? tr("auth.mode.login", "Zur Anmeldung")
    : tr("auth.mode.register", "Konto anlegen");
  statusElement.textContent = "";
  if (updateUrl) {
    const params = new URLSearchParams(window.location.search);
    registration ? params.set("mode", "register") : recovery ? params.set("mode", "recovery") : params.delete("mode");
    window.history.replaceState({}, "", `${window.location.pathname}${params.toString() ? `?${params}` : ""}`);
  }
}

async function postJson(url, body, headers = {}) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.message || tr("auth.error.request_failed", "Anfrage fehlgeschlagen."));
    error.code = payload.error || "request_failed";
    error.status = response.status;
    error.payload = payload;
    throw error;
  }
  return payload;
}

async function ensureIdentityLoginReady() {
  const response = await fetch("/health", { headers:{ Accept:"application/json" }, cache:"no-store" });
  if (response.ok) return;
  let payload={};
  try { payload=await response.json(); } catch {}
  const persistenceUnavailable=payload?.dependencies?.postgres?.status==="unavailable";
  const error=new Error(persistenceUnavailable
    ? tr("auth.error.login.persistence_unavailable", "Anmeldung nicht möglich: Die zentrale Kontodatenbank ist momentan nicht erreichbar.")
    : tr("auth.error.login.identity_unreachable", "Der Identity-Dienst ist momentan nicht erreichbar."));
  error.code=persistenceUnavailable?"identity_persistence_unavailable":"identity_unreachable";
  error.status=response.status;
  throw error;
}

function showActiveSessionDialog(payload) {
  pendingLogin = {
    token: payload.pending_login_token,
    next: payload.next || nextUrl,
    expiresAt: payload.pending_login_expires_at || "",
  };
  activeSessionStatus.textContent = "";
  activeSessionDialog.showModal();
  document.querySelector("#confirm-session-takeover").focus();
}

function hideActiveSessionDialog() {
  pendingLogin = null;
  activeSessionDialog.close();
  applyMode(false);
  statusElement.textContent = tr("auth.status.session.cancelled", "Anmeldung wurde abgebrochen. Die bisherige Sitzung bleibt aktiv.");
}

async function completePendingSessionAction(endpoint, progressMessage, onSuccess) {
  if (!pendingLogin?.token) return;
  const buttons = activeSessionDialog.querySelectorAll("button");
  buttons.forEach((button) => { button.disabled = true; });
  activeSessionStatus.textContent = progressMessage;
  try {
    const result = await postJson(endpoint, { pending_login_token: pendingLogin.token });
    onSuccess(result);
  } catch (error) {
    activeSessionStatus.textContent = error?.code === "pending_login_expired"
      ? "Der Anmeldeversuch ist abgelaufen. Bitte melde dich erneut an."
      : error.message || "Der Sitzungswechsel konnte nicht abgeschlossen werden.";
    buttons.forEach((button) => { button.disabled = false; });
  }
}
function actionHeaders(action) {
  return action ? { "X-GerNetiX-Action-Id": action.id, "X-GerNetiX-Action-Type": action.type } : {};
}
function actionStep(action, spanType, operation, reasonCode) {
  return action ? action.step(spanType, operation, reasonCode) : operation();
}
function passkeyActionReason(error) {
  const reason = error?.code || error?.name;
  if (reason === "NotAllowedError") return "passkey_cancelled";
  if (reason === "NotSupportedError") return "passkey_not_supported";
  if (reason === "SecurityError") return "passkey_origin_invalid";
  if (["TypeError", "identity_unreachable", "identity_persistence_unavailable"].includes(reason)) return "identity_unreachable";
  if (["invalid_credentials", "account_not_found", "passkey_not_configured", "account_disabled", "account_not_verified", "guest_expired"].includes(reason)) return "account_unavailable";
  return "authentication_verification_failed";
}
async function reportPasskeyBrowserError(flow, error, action = null) {
  try {
    await fetch("/api/passkeys/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...actionHeaders(action) },
      body: JSON.stringify({ flow, error_name: error?.name || "UnknownError" }),
    });
  } catch {}
}
function registrationFailureMessage(error) {
  const reason = {
    SecurityError: tr("auth.error.security", "Die Passkey-Domain ist ungültig."),
    NotAllowedError: tr("auth.error.not_allowed", "Die Passkey-Erstellung wurde abgebrochen oder ist abgelaufen."),
    NotSupportedError: tr("auth.error.not_supported", "Passkeys werden in diesem Browser nicht unterstützt."),
  }[error?.name] || localizedErrorMessage(error, "auth.error.registration_failed", "Die Passkey-Erstellung konnte nicht abgeschlossen werden.");
  return tr("auth.error.registration_reason", "Konto wurde nicht angelegt. Grund: {reason}", { reason });
}

function passkeyLoginFailureMessage(error) {
  const keyByReason = {
    invalid_credentials: "auth.error.login.account_not_found",
    account_not_found: "auth.error.login.account_not_found",
    passkey_not_configured: "auth.error.login.passkey_not_configured",
    account_disabled: "auth.error.login.account_disabled",
    account_not_verified: "auth.error.login.account_not_verified",
    guest_expired: "auth.error.login.guest_expired",
    identity_persistence_unavailable: "auth.error.login.persistence_unavailable",
    identity_unreachable: "auth.error.login.identity_unreachable",
    passkey_authentication_unavailable: "auth.error.login.authentication_unavailable",
    passkey_challenge_expired: "auth.error.login.challenge_expired",
    passkey_verification_failed: "auth.error.login.verification_failed",
    NotAllowedError: "auth.error.login.not_allowed",
    SecurityError: "auth.error.security",
    NotSupportedError: "auth.error.not_supported",
    TypeError: "auth.error.login.identity_unreachable",
  };
  const reason = error?.code || error?.name;
  const translationKey = keyByReason[reason];
  return translationKey
    ? tr(translationKey, error.message || "Passkey-Login fehlgeschlagen.")
    : tr("auth.status.passkey.login_failed", "Passkey-Login fehlgeschlagen.");
}

function localizedErrorMessage(error, fallbackKey, fallbackText) {
  const keyByCode = {
    invalid_username: "auth.error.invalid_username",
    username_already_exists: "auth.error.username_already_exists",
    terms_not_accepted: "auth.error.terms_not_accepted",
  };
  const translationKey = keyByCode[error?.code];
  return translationKey ? tr(translationKey, error.message || fallbackText) : error?.message || tr(fallbackKey, fallbackText);
}
function parseCreationOptions(options) {
  if (PublicKeyCredential.parseCreationOptionsFromJSON) return PublicKeyCredential.parseCreationOptionsFromJSON(options);
  return { ...options, challenge: base64UrlToBuffer(options.challenge), user: { ...options.user, id: base64UrlToBuffer(options.user.id) }, excludeCredentials: (options.excludeCredentials || []).map((item) => ({ ...item, id: base64UrlToBuffer(item.id) })) };
}
function parseRequestOptions(options) {
  if (PublicKeyCredential.parseRequestOptionsFromJSON) return PublicKeyCredential.parseRequestOptionsFromJSON(options);
  return { ...options, challenge: base64UrlToBuffer(options.challenge), allowCredentials: (options.allowCredentials || []).map((item) => ({ ...item, id: base64UrlToBuffer(item.id) })) };
}
function credentialJson(credential) {
  if (credential.toJSON) return credential.toJSON();
  const response = credential.response;
  const json = { id: credential.id, rawId: bufferToBase64Url(credential.rawId), type: credential.type, response: { clientDataJSON: bufferToBase64Url(response.clientDataJSON) } };
  if (response.attestationObject) { json.response.attestationObject = bufferToBase64Url(response.attestationObject); json.response.transports = response.getTransports ? response.getTransports() : []; }
  else { json.response.authenticatorData = bufferToBase64Url(response.authenticatorData); json.response.signature = bufferToBase64Url(response.signature); json.response.userHandle = response.userHandle ? bufferToBase64Url(response.userHandle) : undefined; }
  return json;
}
function base64UrlToBuffer(value) { const base64 = String(value).replace(/-/g, "+").replace(/_/g, "/"); const binary = atob(base64); return Uint8Array.from(binary, (character) => character.charCodeAt(0)); }
function bufferToBase64Url(value) { const binary = String.fromCharCode(...new Uint8Array(value)); return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }
