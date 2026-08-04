const GerNetiXHardwareLab = (() => {
  const labState = { session: null, loaded: false, loading: false, bound: false };

  function bind() {
    if (labState.bound) return;
    labState.bound = true;
    document.querySelector("#hardwareLabForm")?.addEventListener("submit", createSession);
    document.querySelector("#labAnalyzeButton")?.addEventListener("click", analyzeSources);
    document.querySelector("#labBuildButton")?.addEventListener("click", requestBuild);
    document.querySelector("#labBuildStatusButton")?.addEventListener("click", synchronizeBuild);
    document.querySelector("#labVerificationButton")?.addEventListener("click", requestVerification);
    document.querySelector("#labVerificationConsent")?.addEventListener("change", render);
  }

  async function enter() {
    if (labState.loaded || labState.loading) return;
    labState.loading = true;
    try {
      const result = await getJson("/api/platform/hardware-lab/sessions");
      labState.session = (result.items || []).at(-1) || null;
      labState.loaded = true;
      render();
    } catch (error) {
      setStatus("error", error.message);
    } finally {
      labState.loading = false;
    }
  }

  async function createSession(event) {
    event.preventDefault();
    setStatus("running", "Board-Kandidat und verpflichtender Discovery-Ablauf werden angelegt …");
    await run(async () => {
      labState.session = await postJson("/api/platform/hardware-lab/sessions", {
        board_name: value("#labBoardName"),
        manufacturer: value("#labManufacturer"),
        source_urls: value("#labSourceUrls").split(/\r?\n/).map((item) => item.trim()).filter(Boolean),
        notes: value("#labNotes"),
      });
      labState.loaded = true;
      setStatus("ok", "Board-Kandidat angelegt. Analysiere jetzt die Herstellerquellen mit der KI.");
    });
  }

  async function analyzeSources() {
    await act("analyze-sources", "Herstellerseiten und Datenblätter werden sicher geladen und mit der konfigurierten OpenAI-Route analysiert …", "KI-Boardprofil erstellt. Prüfe den Kandidaten und fordere anschließend die passive Discovery-Firmware an.");
  }

  async function requestBuild() {
    await act("discovery-firmware-build", "Discovery-Firmware-Build wird angefordert …", "Build angefordert. Aktualisiere den Status, bis die Firmware bereitsteht.");
  }

  async function synchronizeBuild() {
    await act("discovery-firmware-build-status", "Buildstatus wird aus Build & Deploy gelesen …", "Buildstatus wurde aktualisiert.");
  }

  async function requestVerification() {
    const session = labState.session;
    if (!session) return;
    setStatus("running", "GerNetiX-Prüfanfrage wird übermittelt …");
    await run(async () => {
      labState.session = await postJson(endpoint(session, "gernetix-verification-request"), {
        consent_to_share_profile: document.querySelector("#labVerificationConsent").checked,
        customer_message: value("#labVerificationMessage"),
      });
      setStatus("ok", "Prüfanfrage eingereicht. Versanddaten wurden nicht erhoben.");
    });
  }

  async function act(action, progressText, successText) {
    const session = labState.session;
    if (!session) return;
    setStatus("running", progressText);
    await run(async () => {
      labState.session = await postJson(endpoint(session, action), {});
      const buildStatus = labState.session.discovery?.firmware_build?.status;
      if (action === "discovery-firmware-build-status" && buildStatus === "failed") setStatus("error", "Discovery-Firmware-Build fehlgeschlagen.");
      else if (action === "discovery-firmware-build-status" && buildStatus === "success") setStatus("ok", "Discovery-Firmware erfolgreich gebaut. Sie kann jetzt auf dem realen Board ausgeführt werden.");
      else setStatus("ok", successText);
    });
  }

  async function run(operation) {
    try { await operation(); } catch (error) { setStatus("error", error.message); }
    render();
  }

  function render() {
    const root = document.querySelector("#hardwareLabView");
    if (!root) return;
    const session = labState.session;
    const buildStatus = session?.discovery?.firmware_build?.status || "not_started";
    const examinationStatus = session?.discovery?.examination?.status || "not_started";
    const aiStatus = session?.ai_analysis?.status || "not_started";
    const canAnalyze = Boolean(session) && aiStatus !== "completed" && !String(session.status || "").endsWith("running");
    const canBuild = aiStatus === "completed" && !["requested", "accepted", "queued", "running", "success"].includes(buildStatus) && examinationStatus !== "passed";
    const canPoll = Boolean(session?.discovery?.firmware_build?.build_job_id) && !["success", "failed", "cancelled", "replaced"].includes(buildStatus);
    const consented = document.querySelector("#labVerificationConsent")?.checked;
    setDisabled("#labAnalyzeButton", !canAnalyze);
    setDisabled("#labBuildButton", !canBuild);
    setDisabled("#labBuildStatusButton", !canPoll);
    setDisabled("#labVerificationButton", !(examinationStatus === "passed" && consented && !session?.gernetix_verification_request));
    document.querySelector("#labSessionMeta").innerHTML = session ? [
      ["Vorgang", session.recovery_session_id], ["Board", session.candidate_profile?.board_name || ""], ["Status", session.status],
      ["KI-Analyse", aiStatus], ["KI-Modell", session.ai_analysis?.model || "–"], ["Discovery-Build", buildStatus], ["Hardwareprüfung", examinationStatus],
    ].map(meta).join("") : "";
    renderAiResult(session);
    const completed = new Set(session?.discovery?.examination?.completed_phases || []);
    document.querySelector("#labPhaseList").innerHTML = (session?.discovery?.required_phases || []).map((phase) => `<li class="${completed.has(phase) ? "is-complete" : ""}">${escapeHtml(phaseLabel(phase))}</li>`).join("");
    document.querySelector("#labDetailsBox").textContent = session ? JSON.stringify({ candidate_profile: session.candidate_profile, discovery: session.discovery, gernetix_verification_request: session.gernetix_verification_request }, null, 2) : "Noch kein Laborvorgang angelegt.";
    const download = document.querySelector("#labFirmwareDownload");
    const artifactUrl = session?.discovery?.firmware_build?.artifact_url;
    download.classList.toggle("hidden", !artifactUrl);
    download.href = artifactUrl || "#";
  }

  function renderAiResult(session) {
    const node = document.querySelector("#labAiResult");
    const profile = session?.ai_analysis?.profile;
    node.classList.toggle("hidden", !profile);
    if (!profile) { node.innerHTML = ""; return; }
    const questions = (profile.unresolved_questions || []).slice(0, 8);
    node.innerHTML = `<h3>${escapeHtml(profile.board_name || "Board-Kandidat")}</h3><p>${escapeHtml([profile.manufacturer, profile.mcu_variant, profile.module_name].filter(Boolean).join(" · "))}</p><p>PlatformIO: <strong>${escapeHtml(profile.platformio?.board || "noch offen")}</strong> · Flash: ${escapeHtml(formatBytes(profile.flash_bytes))} · PSRAM: ${escapeHtml(formatBytes(profile.psram_bytes))}</p><p>${escapeHtml((profile.capabilities || []).join(", ") || "Noch keine belegten Capabilities")}</p>${questions.length ? `<strong>Offene Fragen</strong><ul>${questions.map((question) => `<li>${escapeHtml(question)}</li>`).join("")}</ul>` : ""}`;
  }

  function endpoint(session, action) { return `/api/platform/hardware-lab/sessions/${encodeURIComponent(session.recovery_session_id)}/${action}`; }
  function value(selector) { return document.querySelector(selector)?.value.trim() || ""; }
  function setDisabled(selector, disabled) { const node = document.querySelector(selector); if (node) node.disabled = disabled; }
  function setStatus(kind, text) { const node = document.querySelector("#labStatusBox"); if (!node) return; node.className = `hardware-lab-status ${kind}`; node.textContent = text; }
  function meta([label, valueText]) { return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(valueText)}</dd></div>`; }
  function formatBytes(bytes) { if (!Number.isFinite(bytes)) return "unbekannt"; if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB`; if (bytes >= 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${bytes} B`; }
  function phaseLabel(phase) { return ({ chip_and_memory: "Chip, Flash, RAM und PSRAM untersuchen", boot_flash_and_recovery: "Boot-, Flash- und Recovery-Verhalten prüfen", safe_bus_and_peripheral_scan: "Busse und Peripherie mit sicherem Pinprofil untersuchen", runtime_and_connectivity: "Runtime, USB, WLAN und OTA prüfen", source_comparison: "Messwerte mit Herstellerquellen vergleichen" })[phase] || phase; }

  return { bind, enter, render };
})();
