(() => {
  let revoked = false;

  window.addEventListener("gernetix:session-revoked", (event) => {
    if (revoked) return;
    revoked = true;
    const dialog = document.querySelector("#sessionRevokedDialog");
    if (!dialog) {
      window.location.assign("/app/auth/?reason=session-replaced");
      return;
    }

    if (event.detail?.reason !== "replaced") {
      dialog.querySelector("#sessionRevokedTitle").textContent = "Diese Sitzung wurde beendet";
      dialog.querySelector("#sessionRevokedDescription").textContent = "Diese Sitzung hat keinen Zugriff mehr. Melde dich erneut an oder sichere dein Konto, wenn du die Abmeldung nicht erwartet hast.";
    }
    dialog.addEventListener("cancel", (cancelEvent) => cancelEvent.preventDefault());
    dialog.showModal();
    dialog.querySelector("a")?.focus();
  });
})();
