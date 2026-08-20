// GerNetiX platform module extracted from app.js.
import { postJson } from "@app/app-runtime-utils.js";
import { state } from "@app/platform-state.js";

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
}

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

export {
  createOfflineRecoverySet,
  renderAccountSetup,
};

