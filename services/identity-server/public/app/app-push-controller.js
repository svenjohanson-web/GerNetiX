// GerNetiX platform module extracted from app.js.
import { getJson, postJson } from "@app/app-runtime-utils.js";
import { state } from "@app/platform-state.js";

async function enablePushNotifications() {
  const status = document.querySelector("#pushStatus");
  const projectId = selectedPushProjectId();
  if (!projectId) { status.textContent = "Lege zuerst ein Projekt an oder waehle eines aus."; return; }
  if (!window.isSecureContext || !("PushManager" in window) || !("Notification" in window)) { status.textContent = "Push ist nur in der installierten HTTPS-App auf diesem iPhone verfuegbar."; return; }
  try {
    const registration = await navigator.serviceWorker.ready;
    const config = await getJson("/api/push/public-key");
    if (!config.enabled) { status.textContent = "Push wird vom Server noch vorbereitet."; return; }
    if (Notification.permission === "default" && await Notification.requestPermission() !== "granted") { status.textContent = "Push-Erlaubnis wurde nicht erteilt."; return; }
    if (Notification.permission !== "granted") { status.textContent = "Push ist in den iPhone-Einstellungen deaktiviert."; return; }
    const subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToBytes(config.public_key) });
    await postJson(`/api/push/projects/${encodeURIComponent(projectId)}/subscribe`, subscription.toJSON());
    status.textContent = "Push-Meldungen sind auf diesem Geraet fuer das ausgewaehlte Projekt aktiv.";
  } catch (error) { status.textContent = error.message || "Push konnte nicht aktiviert werden."; }
}
async function sendPushTestNotification() {
  const status = document.querySelector("#pushStatus");
  const projectId = selectedPushProjectId();
  if (!projectId) { status.textContent = "Waehle zuerst ein Projekt aus."; return; }
  try {
    const result = await postJson(`/api/push/projects/${encodeURIComponent(projectId)}/test`, {});
    status.textContent = result.push?.enabled ? "Testnachricht wurde an die aktivierten Geraete dieses Projekts gesendet." : "Push wird vom Server noch vorbereitet.";
  } catch (error) { status.textContent = error.message || "Testnachricht konnte nicht gesendet werden."; }
}
function selectedPushProjectId() {
  return String(document.querySelector("#pushProjectSelect")?.value || state.activeProjectId || "").trim();
}
function base64UrlToBytes(value) { const padded = String(value).replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(String(value).length / 4) * 4, "="); return Uint8Array.from(atob(padded), (char) => char.charCodeAt(0)); }

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/app/push-sw.js").catch(() => {});
}

export {
  enablePushNotifications,
  sendPushTestNotification,
};

