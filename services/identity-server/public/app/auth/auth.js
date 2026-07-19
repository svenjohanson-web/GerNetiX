const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");
const modeToggle = document.querySelector("#auth-mode-toggle");
const guestAccessButton = document.querySelector("#guest-access-button");
const guestHint = document.querySelector("#guest-hint");
const authMenuButton = document.querySelector("#authMenuButton");
const authMenu = document.querySelector("#authMenu");

function closeAuthMenu() {
  if (!authMenu || !authMenuButton) return;
  authMenu.hidden = true;
  authMenuButton.setAttribute("aria-expanded", "false");
  authMenuButton.setAttribute("aria-label", "Menü öffnen");
}

authMenuButton?.addEventListener("click", (event) => {
  event.stopPropagation();
  const open = authMenu.hidden;
  authMenu.hidden = !open;
  authMenuButton.setAttribute("aria-expanded", open ? "true" : "false");
  authMenuButton.setAttribute("aria-label", open ? "Menü schließen" : "Menü öffnen");
});
authMenu?.addEventListener("click", (event) => event.stopPropagation());
document.addEventListener("click", closeAuthMenu);
document.addEventListener("keydown", (event) => { if (event.key === "Escape") closeAuthMenu(); });
const titleElement = document.querySelector("#login-title");
const statusElement = document.querySelector("#status");
const identifierField = document.querySelector("#login-identifier-field");
const query = new URLSearchParams(window.location.search);
const nextUrl = query.get("next") || "/app/dashboard/";
let mode = query.get("mode") === "register" ? "register" : "login";

applyMode(false);

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  const username = String(new FormData(loginForm).get("identifier") || "").trim();
  statusElement.textContent = "Passkey wird angefordert …";
  let browserPasskeyRequest = false;
  try {
    const options = await postJson("/api/passkeys/authentication/options", username ? { username } : {});
    browserPasskeyRequest = true;
    const credential = await navigator.credentials.get({ publicKey: parseRequestOptions(options) });
    browserPasskeyRequest = false;
    const result = await postJson("/api/passkeys/authentication/verify", { ...(username ? { username } : {}), credential: credentialJson(credential), next: nextUrl });
    window.location.href = result.next || "/app/dashboard/";
  } catch (error) {
    if (browserPasskeyRequest) await reportPasskeyBrowserError("authentication", error);
    statusElement.textContent = error.message || "Passkey-Login fehlgeschlagen.";
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
  statusElement.textContent = "Passkey wird eingerichtet …";
  let browserPasskeyRequest = false;
  try {
    const options = await postJson("/api/passkeys/registration/options", { username });
    browserPasskeyRequest = true;
    const credential = await navigator.credentials.create({ publicKey: parseCreationOptions(options) });
    browserPasskeyRequest = false;
    const result = await postJson("/api/passkeys/registration/verify", { username, accepted_terms: data.get("accepted_terms") === "on", credential: credentialJson(credential) });
    statusElement.textContent = result.message || "Konto wurde angelegt.";
    window.setTimeout(() => { window.location.href = result.next || "/app/dashboard/"; }, 900);
  } catch (error) {
    if (browserPasskeyRequest) await reportPasskeyBrowserError("registration", error);
    statusElement.textContent = registrationFailureMessage(error);
  }
});

modeToggle.addEventListener("click", () => { mode = mode === "login" ? "register" : "login"; applyMode(true); });
guestAccessButton.addEventListener("click", async () => {
  statusElement.textContent = "Gastzugang wird angelegt …";
  try { const result = await postJson("/api/account/guest", {}); window.location.href = result.next || "/app/dashboard/"; }
  catch (error) { statusElement.textContent = error.message || "Gastzugang konnte nicht angelegt werden."; }
});

function applyMode(updateUrl) {
  const registration = mode === "register";
  loginForm.classList.toggle("hidden", registration);
  registerForm.classList.toggle("hidden", !registration);
  guestAccessButton.classList.toggle("hidden", registration);
  guestHint.classList.toggle("hidden", registration);
  titleElement.textContent = registration ? "Konto anlegen" : "Anmelden";
  modeToggle.textContent = registration ? "Zur Anmeldung" : "Konto anlegen";
  statusElement.textContent = "";
  if (updateUrl) { const params = new URLSearchParams(window.location.search); registration ? params.set("mode", "register") : params.delete("mode"); window.history.replaceState({}, "", `${window.location.pathname}${params.toString() ? `?${params}` : ""}`); }
}

async function postJson(url, body) {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || "Anfrage fehlgeschlagen.");
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
    SecurityError: "Die Passkey-Domain ist ungültig.",
    NotAllowedError: "Die Passkey-Erstellung wurde abgebrochen oder ist abgelaufen.",
    NotSupportedError: "Passkeys werden in diesem Browser nicht unterstützt.",
  }[error?.name] || error?.message || "Die Passkey-Erstellung konnte nicht abgeschlossen werden.";
  return `Konto wurde nicht angelegt. Grund: ${reason}`;
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
