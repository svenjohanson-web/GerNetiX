const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");
const recoveryForm = document.querySelector("#recovery-form");
const modeToggle = document.querySelector("#auth-mode-toggle");
const recoveryModeToggle = document.querySelector("#recovery-mode-toggle");
const guestAccessButton = document.querySelector("#guest-access-button");
const guestAccess = document.querySelector(".guest-access");
const authMenuButton = document.querySelector("#authMenuButton");
const authMenu = document.querySelector("#authMenu");
const languageSelect = document.querySelector("#auth-language");
let i18n = null;

function tr(key, fallback, variables = {}) {
  return i18n ? i18n.t(key, variables, fallback) : fallback;
}

function currentLocale() {
  return i18n?.locale || window.GerNetiXI18n?.resolveLocale?.() || "de";
}

function closeAuthMenu() {
  if (!authMenu || !authMenuButton) return;
  authMenu.hidden = true;
  authMenuButton.setAttribute("aria-expanded", "false");
  authMenuButton.setAttribute("aria-label", tr("menu.open", "Menü öffnen"));
}

authMenuButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  const open = authMenu.hidden;
  authMenu.hidden = !open;
  authMenuButton.setAttribute("aria-expanded", open ? "true" : "false");
  authMenuButton.setAttribute("aria-label", open
    ? tr("menu.close", "Menü schließen")
    : tr("menu.open", "Menü öffnen"));
});
authMenu?.addEventListener("click", (event) => event.stopPropagation());
document.addEventListener("click", closeAuthMenu);
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeAuthMenu(); });
const titleElement = document.querySelector("#login-title");
const statusElement = document.querySelector("#status");
const identifierField = document.querySelector("#login-identifier-field");
const query = new URLSearchParams(window.location.search);
const nextUrl = query.get("next") || "/app/dashboard/";
let mode = query.get("mode") === "register" ? "register" : query.get("mode") === "recovery" ? "recovery" : "login";

initializeI18n();

async function initializeI18n() {
  try {
    i18n = await window.GerNetiXI18n.create();
    i18n.translateDocument();
    languageSelect.value = i18n.locale;
  } catch (error) {
    console.warn("Identity translations could not be initialized.", error);
  }
  applyMode(false);
}

languageSelect?.addEventListener("change", async () => {
  if (!i18n) return;
  await i18n.setLocale(languageSelect.value);
  applyMode(false);
  closeAuthMenu();
});

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = String(new FormData(loginForm).get("identifier") || "").trim();
  statusElement.textContent = tr("auth.status.passkey.requesting", "Passkey wird angefordert …");
  let browserPasskeyRequest = false;
  try {
    const options = await postJson("/api/passkeys/authentication/options", username ? { username } : {});
    browserPasskeyRequest = true;
    const credential = await navigator.credentials.get({ publicKey: parseRequestOptions(options) });
    browserPasskeyRequest = false;
    const result = await postJson("/api/passkeys/authentication/verify", {
      ...(username ? { username } : {}),
      credential: credentialJson(credential),
      next: nextUrl,
      locale: currentLocale(),
    });
    window.location.href = result.next || "/app/dashboard/";
  } catch (error) {
    if (browserPasskeyRequest) await reportPasskeyBrowserError("authentication", error);
    statusElement.textContent = localizedErrorMessage(error, "auth.status.passkey.login_failed", "Passkey-Login fehlgeschlagen.");
  }
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

async function postJson(url, body) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) {
    const error = new Error(payload.message || tr("auth.error.request_failed", "Anfrage fehlgeschlagen."));
    error.code = payload.error || "request_failed";
    throw error;
  }
  return payload;
}
async function reportPasskeyBrowserError(flow, error) {
  try {
    await fetch("/api/passkeys/client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
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
