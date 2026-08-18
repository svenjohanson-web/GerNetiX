// GerNetiX platform module extracted from app.js.
function renderAccountSetup() {
  const button = document.querySelector("#createOfflineRecoverySetButton");
  const status = document.querySelector("#offlineRecoverySetStatus");
  const action = document.querySelector("#offlineRecoverySetAction");
  if (!button || !status || !action || !state.account) return;
  const configured = Boolean(state.account.offline_recovery_set_configured);
  action.textContent = configured ? "Recovery-Set neu erzeugen →" : "Recovery-Set erstellen →";
  status.textContent = configured
    ? "Ein Recovery-Set ist eingerichtet. Beim Neuerzeugen wird der bisherige Code ungültig."
    : "Noch kein Offline-Recovery-Set eingerichtet.";
  void loadAccountPasskeys();
  void loadContactNotificationSettings();
}

let contactNotificationSettings = null;

async function loadContactNotificationSettings() {
  const status = document.querySelector("#accountContactEmailStatus");
  if (!status) return;
  try {
    contactNotificationSettings = await getJson("/api/account/contact-notifications");
    renderContactNotificationSettings();
  } catch (error) {
    status.textContent = error.message || "Kontaktweg konnte nicht geladen werden.";
  }
}

function renderContactNotificationSettings() {
  if (!contactNotificationSettings) return;
  const input = document.querySelector("#accountContactEmail");
  const status = document.querySelector("#accountContactEmailStatus");
  const fieldset = document.querySelector("#accountCommunityNotificationPreferences");
  const removeButton = document.querySelector("#removeAccountContactEmail");
  const verified = contactNotificationSettings.status === "verified";
  const suppressed = contactNotificationSettings.community_email_suppression?.active === true;
  if (input) input.value = contactNotificationSettings.pending_email || contactNotificationSettings.email || "";
  if (status) {
    status.textContent = contactNotificationSettings.status === "verification_pending"
      ? `Bestätigung für ${contactNotificationSettings.pending_email} steht noch aus.`
      : verified && suppressed
        ? `${contactNotificationSettings.email} ist bestätigt, Community-E-Mails sind nach einer dauerhaften Unzustellbarkeit pausiert. Speichere die Adresse erneut, um sie nochmals zu bestätigen.`
      : verified
        ? `${contactNotificationSettings.email} ist bestätigt.`
        : "Keine E-Mail-Adresse hinterlegt.";
  }
  if (fieldset) {
    fieldset.disabled = !verified;
    for (const [key, enabled] of Object.entries(contactNotificationSettings.notification_preferences || {})) {
      const checkbox = fieldset.querySelector(`input[name="${key}"]`);
      if (checkbox) checkbox.checked = enabled === true;
    }
  }
  if (removeButton) {
    removeButton.hidden = !contactNotificationSettings.email || state.account?.account_type === "email_account";
  }
}

async function submitContactEmail(event) {
  event.preventDefault();
  const input = document.querySelector("#accountContactEmail");
  const status = document.querySelector("#accountContactEmailStatus");
  if (!input || !status) return;
  status.textContent = "Bestätigungslink wird gesendet …";
  try {
    contactNotificationSettings = await postJson("/api/account/contact-email", { email: input.value });
    renderContactNotificationSettings();
  } catch (error) {
    status.textContent = error.message || "E-Mail-Adresse konnte nicht vorbereitet werden.";
  }
}

async function removeContactEmail() {
  if (!window.confirm("E-Mail-Adresse und alle Community-E-Mail-Hinweise entfernen?")) return;
  const status = document.querySelector("#accountContactEmailStatus");
  try {
    contactNotificationSettings = await deleteJson("/api/account/contact-email");
    renderContactNotificationSettings();
  } catch (error) {
    if (status) status.textContent = error.message || "E-Mail-Adresse konnte nicht entfernt werden.";
  }
}

async function updateCommunityNotificationPreferences() {
  const fieldset = document.querySelector("#accountCommunityNotificationPreferences");
  const status = document.querySelector("#accountNotificationPreferenceStatus");
  if (!fieldset || !status) return;
  const patch = Object.fromEntries(Array.from(fieldset.querySelectorAll("input[type=checkbox]"))
    .map((input) => [input.name, input.checked]));
  fieldset.disabled = true;
  status.textContent = "Einstellungen werden gespeichert …";
  try {
    contactNotificationSettings = await patchJson("/api/account/contact-notifications", patch);
    status.textContent = "Einstellungen gespeichert.";
  } catch (error) {
    status.textContent = error.message || "Einstellungen konnten nicht gespeichert werden.";
  } finally {
    renderContactNotificationSettings();
  }
}

document.querySelector("#accountContactEmailForm")?.addEventListener("submit", submitContactEmail);
document.querySelector("#removeAccountContactEmail")?.addEventListener("click", removeContactEmail);
document.querySelector("#accountCommunityNotificationPreferences")?.addEventListener("change", () => updateCommunityNotificationPreferences());

async function loadAccountPasskeys() {
  const target = document.querySelector("#accountPasskeyList");
  if (!target) return;
  try {
    const response = await getJson("/api/passkeys/manage");
    const items = response.items || [];
    target.innerHTML = items.length ? items.map((item) => `<article><strong>${escapeHtml(item.label || "Passkey")}</strong><span>${escapeHtml(item.rp_id || "unbekannte Domain")} · ${escapeHtml(new Date(item.created_at).toLocaleString("de-DE"))}</span></article>`).join("") : "<p>Noch kein aktiver Passkey erfasst.</p>";
  } catch (error) { target.textContent = error.message || "Passkeys konnten nicht geladen werden."; }
}

async function addAccountPasskey() {
  const button = document.querySelector("#addPasskeyButton");
  const status = document.querySelector("#passkeyManagementStatus");
  if (!button || !status) return;
  button.disabled = true; status.textContent = "Zusätzlicher Passkey wird vorbereitet …";
  try {
    const options = await postJson("/api/passkeys/manage/options", {});
    const credential = await navigator.credentials.create({ publicKey: accountParseCreationOptions(options) });
    await postJson("/api/passkeys/manage/verify", { label: navigator.userAgent.includes("Mac") ? "Mac-Passkey" : "Zusätzlicher Passkey", credential: accountCredentialJson(credential) });
    status.textContent = "Zusätzlicher Passkey wurde gespeichert.";
    await loadAccountPasskeys();
  } catch (error) { status.textContent = error.message || "Passkey konnte nicht hinzugefügt werden."; }
  finally { button.disabled = false; }
}

function accountParseCreationOptions(options) {
  if (PublicKeyCredential.parseCreationOptionsFromJSON) return PublicKeyCredential.parseCreationOptionsFromJSON(options);
  return { ...options, challenge: accountBase64UrlToBuffer(options.challenge), user: { ...options.user, id: accountBase64UrlToBuffer(options.user.id) }, excludeCredentials: (options.excludeCredentials || []).map((item) => ({ ...item, id: accountBase64UrlToBuffer(item.id) })) };
}
function accountCredentialJson(credential) {
  if (credential.toJSON) return credential.toJSON();
  const response = credential.response;
  return { id: credential.id, rawId: accountBufferToBase64Url(credential.rawId), type: credential.type, response: { clientDataJSON: accountBufferToBase64Url(response.clientDataJSON), attestationObject: accountBufferToBase64Url(response.attestationObject), transports: response.getTransports ? response.getTransports() : [] } };
}
function accountBase64UrlToBuffer(value) { const base64 = String(value).replace(/-/g, "+").replace(/_/g, "/"); const binary = atob(base64); return Uint8Array.from(binary, (character) => character.charCodeAt(0)); }
function accountBufferToBase64Url(value) { const binary = String.fromCharCode(...new Uint8Array(value)); return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); }

document.querySelector("#addPasskeyButton")?.addEventListener("click", () => addAccountPasskey());

async function createOfflineRecoverySet() {
  const configured = Boolean(state.account?.offline_recovery_set_configured);
  if (configured && !window.confirm("Das bisherige Offline-Recovery-Set wird ungültig. Möchtest du wirklich einen neuen Code erzeugen?")) return;
  const button = document.querySelector("#createOfflineRecoverySetButton");
  const status = document.querySelector("#offlineRecoverySetStatus");
  if (!button || !status) return;
  button.disabled = true;
  status.textContent = "Recovery-Set wird erzeugt ...";
  try {
    const response = await postJson("/api/account/offline-recovery-set", {});
    state.account = response.account;
    document.querySelector("#offlineRecoverySetValue").textContent = response.recovery_set || "";
    document.querySelector("#offlineRecoverySetDialog")?.showModal();
    renderAccountSetup();
  } catch (error) {
    status.textContent = error.message || "Recovery-Set konnte nicht erzeugt werden.";
  } finally {
    button.disabled = false;
  }
}
