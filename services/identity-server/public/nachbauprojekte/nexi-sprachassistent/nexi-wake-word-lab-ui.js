(function initializeWakeWordLab() {
  "use strict";

  const root = document.querySelector("[data-nexi-wake-lab]");
  const serialFactory = globalThis.GerNetiXSerialService;
  if (!root || !serialFactory) return;

  const TARGET_REFERENCE_COUNT = 3;
  const serial = serialFactory.create();
  const portSelect = root.querySelector("[data-wake-port]");
  const refreshButton = root.querySelector("[data-wake-refresh]");
  const enrollButton = root.querySelector("[data-wake-enroll]");
  const testButton = root.querySelector("[data-wake-test]");
  const resetButton = root.querySelector("[data-wake-reset]");
  const status = root.querySelector("[data-wake-status]");
  const progress = root.querySelector("[data-wake-progress]");
  const result = root.querySelector("[data-wake-result]");
  let referenceCount = 0;
  let profileReady = false;
  let busy = false;

  function selectedPort() {
    return portSelect.value || "";
  }

  function responsePayload(response) {
    return response && typeof response.payload === "object" ? response.payload : {};
  }

  function setStatus(message, state = "idle") {
    status.textContent = message;
    root.dataset.wakeState = state;
  }

  function updateControls() {
    const hasPort = Boolean(selectedPort());
    progress.textContent = hasPort
      ? `${referenceCount} von ${TARGET_REFERENCE_COUNT} Referenzen auf dem Board`
      : "Kein Board verbunden";
    portSelect.disabled = busy;
    refreshButton.disabled = busy;
    enrollButton.disabled = busy || !hasPort || profileReady;
    testButton.disabled = busy || !hasPort || !profileReady;
    resetButton.disabled = busy || !hasPort || referenceCount === 0;
    enrollButton.textContent = profileReady
      ? "Referenzen vollständig"
      : `Referenz ${Math.min(referenceCount + 1, TARGET_REFERENCE_COUNT)} aufnehmen`;
  }

  function explainError(error) {
    if (error?.code === "serial_request_timeout" || error?.code === "serial_service_request_timeout") {
      return "Das Board hat nicht rechtzeitig geantwortet. Drücke RESET, warte kurz und suche das Board erneut.";
    }
    if (error?.code === "serial_port_not_available") {
      return "Das ausgewählte Board ist nicht mehr verbunden. Prüfe das USB-Kabel und suche erneut.";
    }
    if (error?.code === "serial_request_rejected") {
      return "Das Board unterstützt diese Stimmaufnahme noch nicht. Installiere zuerst die aktuelle Nexi-Firmware.";
    }
    return "Der lokale USB-Dienst oder das Board ist nicht erreichbar. Prüfe Kabel und GerNetiX Serial Service.";
  }

  async function boardRequest(action, timeoutMs = 15000) {
    const port = selectedPort();
    if (!port) throw Object.assign(new Error("port_missing"), { code: "serial_port_not_available" });
    return serial.serialRequest(port, action, {}, { timeoutMs });
  }

  function applyBoardStatus(payload) {
    referenceCount = Math.max(0, Math.min(TARGET_REFERENCE_COUNT, Number(payload.reference_count) || 0));
    profileReady = payload.ready === true || referenceCount >= TARGET_REFERENCE_COUNT;
  }

  async function readBoardStatus() {
    const payload = responsePayload(await boardRequest("nexi_voice_status"));
    applyBoardStatus(payload);
    setStatus(
      profileReady
        ? "Das persönliche Aktivierungswort ist auf diesem Board eingerichtet."
        : referenceCount > 0
          ? "Das Board ist bereit für die nächste Referenz."
          : "Das Board ist bereit für die erste Aufnahme.",
      profileReady ? "ready" : "idle",
    );
  }

  async function refreshPorts() {
    if (busy) return;
    busy = true;
    result.hidden = true;
    setStatus("Suche angeschlossene Boards …");
    updateControls();
    try {
      const previous = selectedPort();
      const ports = await serial.ports();
      portSelect.replaceChildren();
      for (const port of ports) {
        const option = document.createElement("option");
        option.value = String(port.path || port.port || "");
        option.textContent = String(port.label || option.value);
        portSelect.append(option);
      }
      if (previous && ports.some((port) => (port.path || port.port) === previous)) portSelect.value = previous;
      if (!ports.length) {
        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Kein Board gefunden";
        portSelect.append(option);
        referenceCount = 0;
        profileReady = false;
        setStatus("Kein Board gefunden. Verbinde Nexi mit einem USB-Datenkabel und suche erneut.", "error");
      } else {
        await readBoardStatus();
      }
    } catch (error) {
      referenceCount = 0;
      profileReady = false;
      setStatus(explainError(error), "error");
    } finally {
      busy = false;
      updateControls();
    }
  }

  async function enroll() {
    if (busy || profileReady || !selectedPort()) return;
    busy = true;
    result.hidden = true;
    setStatus("Sprich jetzt einmal klar „Hey Nexi“ in Richtung des Boards.", "recording");
    updateControls();
    try {
      const payload = responsePayload(await boardRequest("nexi_voice_enroll", 30000));
      applyBoardStatus(payload);
      if (payload.accepted !== true) {
        setStatus("Das Board hat keine deutliche Phrase erkannt. Sprich näher am Board und versuche es erneut.", "rejected");
      } else {
        setStatus(
          profileReady
            ? "Alle drei Referenzen wurden lokal auf dem Board gespeichert. Du kannst die Erkennung jetzt testen."
            : "Referenz erkannt. Das Board ist für die nächste Aufnahme bereit.",
          profileReady ? "ready" : "idle",
        );
      }
    } catch (error) {
      setStatus(explainError(error), "error");
    } finally {
      busy = false;
      updateControls();
    }
  }

  async function testWakeWord() {
    if (busy || !profileReady || !selectedPort()) return;
    busy = true;
    result.hidden = true;
    setStatus("Sprich jetzt „Hey Nexi“ – oder für einen Negativtest bewusst ein anderes Wort.", "recording");
    updateControls();
    try {
      const payload = responsePayload(await boardRequest("nexi_voice_test", 30000));
      const detected = payload.detected === true;
      result.hidden = false;
      result.className = detected ? "wake-result detected" : "wake-result rejected";
      result.innerHTML = detected
        ? "<strong>Nexi erkannt</strong><span>Das Board hat dein persönliches Aktivierungswort erkannt.</span>"
        : "<strong>Nicht aktiviert</strong><span>Die Aufnahme war den gespeicherten Referenzen nicht ähnlich genug.</span>";
      setStatus(
        detected ? "Aktivierung auf dem Board erkannt." : "Keine Aktivierung. Du kannst direkt noch einmal testen.",
        detected ? "detected" : "rejected",
      );
    } catch (error) {
      setStatus(explainError(error), "error");
    } finally {
      busy = false;
      updateControls();
    }
  }

  async function resetProfile() {
    if (busy || !selectedPort()) return;
    if (!globalThis.confirm("Die persönlichen „Hey Nexi“-Merkmale auf diesem Board löschen und neu beginnen?")) return;
    busy = true;
    result.hidden = true;
    setStatus("Lösche die persönlichen Merkmale auf dem Board …");
    updateControls();
    try {
      applyBoardStatus(responsePayload(await boardRequest("nexi_voice_reset")));
      setStatus("Die persönlichen Merkmale wurden auf dem Board gelöscht. Bereit für die erste Aufnahme.");
    } catch (error) {
      setStatus(explainError(error), "error");
    } finally {
      busy = false;
      updateControls();
    }
  }

  refreshButton.addEventListener("click", refreshPorts);
  portSelect.addEventListener("change", async () => {
    busy = true;
    result.hidden = true;
    updateControls();
    try { await readBoardStatus(); } catch (error) { setStatus(explainError(error), "error"); }
    finally { busy = false; updateControls(); }
  });
  enrollButton.addEventListener("click", enroll);
  testButton.addEventListener("click", testWakeWord);
  resetButton.addEventListener("click", resetProfile);
  updateControls();
  refreshPorts();
})();
