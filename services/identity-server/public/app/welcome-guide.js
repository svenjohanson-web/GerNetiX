import { ApiClient } from "@app/api-client.js";

const GerNetiXWelcomeGuide = (() => {
  let activeStep = 0;
  let account = null;

  function elements() {
    const dialog = document.querySelector("#welcomeGuideDialog");
    return {
      dialog,
      panels: [...(dialog?.querySelectorAll("[data-welcome-step]") || [])],
      dots: [...(dialog?.querySelectorAll("[data-welcome-step-button]") || [])],
      back: dialog?.querySelector("[data-welcome-back]"),
      next: dialog?.querySelector("[data-welcome-next]"),
      close: dialog?.querySelector("[data-welcome-close]"),
      preference: dialog?.querySelector("#welcomeGuideDisabled"),
      preferenceLabel: dialog?.querySelector(".welcome-guide-preference"),
      status: dialog?.querySelector("#welcomeGuideStatus"),
    };
  }

  function showStep(index) {
    const ui = elements();
    if (!ui.dialog || !ui.panels.length) return;
    activeStep = Math.max(0, Math.min(index, ui.panels.length - 1));
    ui.panels.forEach((panel, panelIndex) => {
      const active = panelIndex === activeStep;
      panel.hidden = !active;
      panel.setAttribute("aria-hidden", String(!active));
    });
    ui.dots.forEach((dot, dotIndex) => {
      dot.classList.toggle("active", dotIndex === activeStep);
      dot.setAttribute("aria-current", dotIndex === activeStep ? "step" : "false");
    });
    ui.back.disabled = activeStep === 0;
    ui.next.hidden = activeStep === ui.panels.length - 1;
    ui.close.hidden = activeStep !== ui.panels.length - 1;
    ui.dialog.querySelector(".welcome-guide-scroll")?.scrollTo({ top: 0 });
    ui.panels[activeStep].querySelector("h2")?.focus({ preventScroll: true });
  }

  function removeLoginMarker() {
    const url = new URL(window.location.href);
    if (!url.searchParams.has("welcome")) return;
    url.searchParams.delete("welcome");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  }

  function open(options = {}) {
    const ui = elements();
    if (!ui.dialog) return;
    account = options.account || account;
    ui.preferenceLabel.hidden = !account;
    ui.preference.checked = Boolean(account?.welcome_guide_disabled);
    ui.status.textContent = "";
    showStep(0);
    if (!ui.dialog.open) ui.dialog.showModal();
  }

  function maybeOpen(nextAccount) {
    const requestedAfterLogin = new URLSearchParams(window.location.search).get("welcome") === "1";
    if (!requestedAfterLogin) return;
    removeLoginMarker();
    account = nextAccount || null;
    if (account && !account.welcome_guide_disabled) open({ account });
  }

  async function persistPreference() {
    const ui = elements();
    if (!account || !ui.preference || Boolean(account.welcome_guide_disabled) === ui.preference.checked) return true;
    ui.status.textContent = "Einstellung wird gespeichert …";
    try {
      const result = await ApiClient.patchJson("/api/account/preferences", {
        welcome_guide_disabled: ui.preference.checked,
      });
      Object.assign(account, result.account || { welcome_guide_disabled: result.welcome_guide_disabled });
      ui.status.textContent = "";
      window.dispatchEvent(new CustomEvent("gernetix:account-preferences-updated", { detail: result.account }));
      return true;
    } catch {
      ui.status.textContent = "Die Einstellung konnte nicht gespeichert werden. Bitte versuche es erneut.";
      return false;
    }
  }

  async function close() {
    const ui = elements();
    if (!ui.dialog || !await persistPreference()) return;
    ui.dialog.close();
  }

  async function follow(destination) {
    if (!await persistPreference()) return;
    window.location.assign(destination);
  }

  function bind() {
    const ui = elements();
    if (!ui.dialog || ui.dialog.dataset.bound === "true") return;
    ui.dialog.dataset.bound = "true";
    ui.dialog.addEventListener("cancel", (event) => {
      event.preventDefault();
      void close();
    });
    ui.dialog.addEventListener("click", (event) => {
      const stepButton = event.target.closest("[data-welcome-step-button]");
      if (stepButton) return showStep(Number(stepButton.dataset.welcomeStepButton));
      if (event.target.closest("[data-welcome-back]")) return showStep(activeStep - 1);
      if (event.target.closest("[data-welcome-next]")) return showStep(activeStep + 1);
      if (event.target.closest("[data-welcome-close], [data-welcome-dismiss]")) return void close();
      const destination = event.target.closest("[data-welcome-destination]");
      if (destination) {
        event.preventDefault();
        void follow(destination.getAttribute("href"));
      }
    });
  }

  bind();
  return { maybeOpen, open };
})();

export {
  GerNetiXWelcomeGuide,
};
