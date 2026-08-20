import { renderAiRating } from "@app/app-billing-controller.js";
import { escapeHtml, getJson, postJson } from "@app/app-runtime-utils.js";
import { state } from "@app/platform-state.js";

const GerNetiXHardwareLab = (() => {
  const labState = { session: null, loaded: false, loading: false, usageLoaded: false, usageLoading: false, usageError: "", bound: false, busy: false, pendingMessages: [], recordedUsageEvents: new Set() };

  function bind() {
    if (labState.bound) return;
    labState.bound = true;
    document.querySelector("#labChatForm")?.addEventListener("submit", sendChatMessage);
    document.querySelector("#labBuildButton")?.addEventListener("click", requestBuild);
    document.querySelector("#labBuildStatusButton")?.addEventListener("click", synchronizeBuild);
    document.querySelector("#labVerificationButton")?.addEventListener("click", requestVerification);
    document.querySelector("#labVerificationConsent")?.addEventListener("change", render);
  }

  async function enter() {
    void loadUsage();
    if (labState.loaded || labState.loading) return;
    labState.loading = true;
    setConnection("Lädt …", true);
    try {
      const result = await getJson("/api/platform/hardware-lab/sessions");
      labState.session = (result.items || []).at(-1) || null;
      rememberUsageEvents(labState.session);
      labState.loaded = true;
      render();
    } catch (error) {
      setStatus("error", error.message);
    } finally {
      labState.loading = false;
      setConnection("Bereit", false);
    }
  }

  async function loadUsage() {
    if (labState.usageLoaded || labState.usageLoading) return;
    if (Array.isArray(state.aiUsage?.rating?.sources) && state.aiUsage.rating.sources.length) {
      labState.usageLoaded = true;
      renderUsage(labState.session);
      return;
    }
    labState.usageLoading = true;
    labState.usageError = "";
    renderUsage(labState.session);
    try {
      const result = await getJson("/api/platform/hardware-lab/ai-usage");
      state.aiUsage = { ...(state.aiUsage || {}), rating: result.rating || {} };
      labState.usageLoaded = true;
    } catch (error) {
      labState.usageError = error.message || "KI-Nutzung konnte nicht geladen werden.";
    } finally {
      labState.usageLoading = false;
      renderUsage(labState.session);
    }
  }

  async function sendChatMessage(event) {
    event.preventDefault();
    const input = document.querySelector("#labChatInput");
    const message = input?.value.trim();
    if (!message || labState.busy) return;
    input.value = "";
    const userMessage = { role: "user", content: message };
    const pendingMessage = { role: "assistant", content: "Ich prüfe deine Antwort für den aktuellen Schritt.", state: "pending" };
    labState.pendingMessages.push(userMessage, pendingMessage);
    render();
    const sent = await run("Die KI bearbeitet den aktuellen Einrichtungsschritt …", async () => {
      if (!labState.session) {
        labState.session = await postJson("/api/platform/hardware-lab/sessions", { initial_message: message });
        labState.loaded = true;
      }
      labState.session = await postJson(endpoint(labState.session, "chat"), { message });
      recordNewUsage(labState.session);
      labState.pendingMessages = labState.pendingMessages.filter((item) => item !== userMessage && item !== pendingMessage);
      setStatus("ok", labState.session?.lab_chat?.assistant_state?.completed
        ? "Die Board-Einrichtung ist vollständig. Als Nächstes kann die sichere Discovery-Prüfung beginnen."
        : "Der aktuelle Schritt wurde gespeichert. Die KI führt dich mit einer Frage weiter.");
    }, {
      onError(error) {
        pendingMessage.state = "error";
        pendingMessage.content = chatErrorMessage(error);
        setStatus("notice", "Die Verbindung ist weiterhin bereit. Die Anfrage konnte diesmal nicht verarbeitet werden.");
      },
    });
    if (sent) labState.pendingMessages = labState.pendingMessages.filter((item) => item !== userMessage && item !== pendingMessage);
    render();
  }

  async function requestBuild() {
    await act("discovery-firmware-build", "Die sichere Discovery-Testsoftware wird gebaut …", "Build angefordert. Die KI kann den Status als nächsten Schritt prüfen.");
  }

  async function synchronizeBuild() {
    await act("discovery-firmware-build-status", "Buildstatus wird geprüft …", "Buildstatus wurde aktualisiert.");
  }

  async function requestVerification() {
    const session = labState.session;
    if (!session) return;
    await run("GerNetiX-Gegenprüfung wird angefragt …", async () => {
      labState.session = await postJson(endpoint(session, "gernetix-verification-request"), {
        consent_to_share_profile: document.querySelector("#labVerificationConsent").checked,
        customer_message: value("#labVerificationMessage"),
      });
      setStatus("ok", "Prüfanfrage eingereicht. Versanddaten wurden nicht erhoben.");
    });
  }

  async function act(action, progressText, successText) {
    const session = labState.session;
    if (!session || labState.busy) return;
    await run(progressText, async () => {
      labState.session = await postJson(endpoint(session, action), {});
      const buildStatus = labState.session.discovery?.firmware_build?.status;
      if (action === "discovery-firmware-build-status" && buildStatus === "failed") setStatus("error", "Der Build der Testsoftware ist fehlgeschlagen.");
      else if (action === "discovery-firmware-build-status" && buildStatus === "success") setStatus("ok", "Die Testsoftware ist fertig und kann heruntergeladen werden.");
      else setStatus("ok", successText);
    });
  }

  async function run(progressText, operation, options = {}) {
    labState.busy = true;
    setConnection("KI arbeitet …", true);
    setStatus("running", progressText);
    render();
    let succeeded = false;
    try { await operation(); succeeded = true; } catch (error) {
      if (typeof options.onError === "function") options.onError(error);
      else setStatus("error", error.message);
    }
    labState.busy = false;
    setConnection("Bereit", false);
    render();
    return succeeded;
  }

  function render() {
    const root = document.querySelector("#hardwareLabView");
    if (!root) return;
    const session = labState.session;
    const profile = session?.ai_analysis?.profile || session?.candidate_profile || null;
    const buildStatus = session?.discovery?.firmware_build?.status || "not_started";
    const examinationStatus = session?.discovery?.examination?.status || "not_started";
    const aiStatus = session?.ai_analysis?.status || "not_started";
    const showBuild = session?.lab_chat?.assistant_state?.completed === true && aiStatus === "completed" && !["requested", "accepted", "queued", "running", "success"].includes(buildStatus) && examinationStatus !== "passed";
    const showPoll = Boolean(session?.discovery?.firmware_build?.build_job_id) && !["success", "failed", "cancelled", "replaced"].includes(buildStatus);
    const artifactUrl = session?.discovery?.firmware_build?.artifact_url;
    const consented = document.querySelector("#labVerificationConsent")?.checked;

    renderUsage(session);
    toggle("#labSuggestedActions", !(showBuild || showPoll || artifactUrl));
    toggle("#labBuildButton", !showBuild);
    toggle("#labBuildStatusButton", !showPoll);
    setDisabled("#labBuildButton", labState.busy);
    setDisabled("#labBuildStatusButton", labState.busy);
    setDisabled("#labChatInput", labState.busy);
    setDisabled("#labChatSendButton", labState.busy);
    setDisabled("#labVerificationButton", !(examinationStatus === "passed" && consented && !session?.gernetix_verification_request));

    renderChat(session, profile);
    renderProfile(session, profile);
    renderWorkflow(session);
    renderProposedTests(session);
    document.querySelector("#labDetailsBox").textContent = session ? JSON.stringify({ candidate_profile: session.candidate_profile, discovery: session.discovery, lab_chat: session.lab_chat, gernetix_verification_request: session.gernetix_verification_request }, null, 2) : "Noch kein Laborvorgang angelegt.";
    const download = document.querySelector("#labFirmwareDownload");
    download?.classList.toggle("hidden", !artifactUrl);
    if (download) download.href = artifactUrl || "#";
  }

  function renderChat(session, profile) {
    const node = document.querySelector("#labChatMessages");
    if (!node) return;
    const messages = [{ role: "assistant", content: session
      ? `Ich begleite dich beim Anlegen von „${profile?.board_name || "deinem Board"}“. Wir bearbeiten immer genau einen Schritt; bestätigte Ergebnisse landen direkt rechts in der Board-Akte.`
      : "Hallo! Beschreibe mir einfach dein Board – so, wie du es auch einer Person erklären würdest. Du kannst einen Produktlink einfügen, sichtbare Beschriftungen nennen oder direkt mit einer Frage beginnen. Ich erkenne die Grunddaten und frage nur das nach, was noch fehlt." }];
    if (session?.lab_chat?.assistant_state?.completed) {
      messages.push({ role: "assistant", content: profileSummary(profile) });
    } else if (session?.ai_analysis?.status === "failed") {
      messages.push({ role: "assistant", content: "Die Quellenanalyse ist noch nicht gelungen. Prüfe die Webadressen oder sage mir im Chat, welche Angaben du bereits direkt auf dem Board erkennen kannst." });
    }
    messages.push(...(session?.lab_chat?.messages || []), ...labState.pendingMessages);
    node.innerHTML = messages.map((message) => `<article class="hardware-lab-message ai-chat__message ${message.role === "user" ? "is-user user" : "is-assistant assistant"} ${message.state ? `is-${message.state}` : ""}"><span>${message.role === "user" ? "Du" : "AI"}</span><p>${formatMessage(message.content)}${message.state === "pending" ? "<small>KI verarbeitet die Nachricht …</small>" : message.state === "error" ? "<small>Du kannst die Nachricht erneut senden.</small>" : ""}</p></article>`).join("");
    node.scrollTop = node.scrollHeight;
  }

  function renderUsage(session) {
    const target = document.querySelector("#labAiUsage");
    if (!target) return;
    const sources = state.aiUsage?.rating?.sources;
    if (!Array.isArray(sources) || !sources.length) {
      target.innerHTML = labState.usageError
        ? `<p class="hardware-lab-usage-loading is-error">${escapeHtml(labState.usageError)}</p>`
        : `<p class="hardware-lab-usage-loading"><span>KI-Nutzung</span><strong>Wird geladen …</strong></p>`;
    } else if (typeof renderAiRating === "function") renderAiRating("#labAiUsage", true);
    const usage = session?.lab_chat?.usage || session?.ai_analysis?.usage;
    if (!usage) return;
    const messages = session?.lab_chat?.messages || [];
    const lastAssistant = [...messages].reverse().find((message) => message.role === "assistant");
    const details = [
      usage.input_tokens != null ? `Eingabe ${formatCount(usage.input_tokens)}` : "",
      usage.output_tokens != null ? `Antwort ${formatCount(usage.output_tokens)}` : "",
      usage.total_tokens != null ? `Gesamt ${formatCount(usage.total_tokens)}` : "",
      lastAssistant?.model || session?.ai_analysis?.model || "",
    ].filter(Boolean);
    if (details.length) target.insertAdjacentHTML("beforeend", `<p class="hardware-lab-last-usage"><strong>Letzter KI-Aufruf</strong><span>${details.map((detail) => escapeHtml(detail)).join(" · ")}</span></p>`);
  }

  function usageEntries(session) {
    return [session?.ai_analysis?.usage, session?.lab_chat?.usage].filter((usage) => usage?.event_id);
  }

  function rememberUsageEvents(session) {
    usageEntries(session).forEach((usage) => labState.recordedUsageEvents.add(usage.event_id));
  }

  function recordNewUsage(session) {
    const fresh = usageEntries(session).filter((usage) => !labState.recordedUsageEvents.has(usage.event_id));
    fresh.forEach((usage) => labState.recordedUsageEvents.add(usage.event_id));
    const totalTokens = fresh.reduce((sum, usage) => sum + Number(usage.total_tokens ?? (Number(usage.input_tokens || 0) + Number(usage.output_tokens || 0))), 0);
    const rating = state.aiUsage?.rating;
    const sources = rating?.sources;
    if (!totalTokens || !Array.isArray(sources)) return;
    const source = sources.find((item) => item.source_id === "openai_gpt");
    if (!source) return;
    source.month_tokens = Number(source.month_tokens || 0) + totalTokens;
    source.used_percent = Number(source.token_limit) > 0
      ? Number(Math.min(100, (source.month_tokens / Number(source.token_limit)) * 100).toFixed(2))
      : 0;
    const limited = sources.filter((item) => !item.unlimited && Number(item.token_limit) > 0);
    rating.used_percent = limited.length ? Math.max(...limited.map((item) => Number(item.used_percent || 0))) : 0;
  }

  function formatCount(value) { return `${Number(value || 0).toLocaleString("de-DE")} Token`; }

  function chatErrorMessage(error) {
    if (error?.code === "hardware_lab_ai_usage_rejected" && error?.payload?.details?.rejection_reason === "insufficient_credits") {
      window.dispatchEvent(new CustomEvent("ai-credit-purchase-required", { detail: { usagePreflight: error.payload.details } }));
      return "Für diese Anfrage reichen die verfügbaren KI-Credits nicht aus. Du kannst Guthaben ergänzen und die Nachricht anschließend erneut senden.";
    }
    if (error?.code === "hardware_lab_chat_not_configured") return "Der OpenAI-Zugang für den KI-Hardware-Assistenten ist noch nicht vollständig eingerichtet.";
    return `Ich konnte die Anfrage gerade nicht verarbeiten: ${error?.message || "Unbekannter Fehler"}`;
  }

  function renderProfile(session, profile) {
    const title = document.querySelector("#labProfileTitle");
    const identity = document.querySelector("#labProfileIdentity");
    if (title) title.textContent = profile?.board_name || "Noch kein Board";
    if (identity) identity.textContent = profile ? [profile.manufacturer, profile.mcu_variant, profile.module_name].filter(Boolean).join(" · ") || "Hersteller und Prozessor noch unbekannt" : "Die erkannten Eigenschaften erscheinen hier während des Dialogs.";
    const percent = profileCompleteness(profile);
    const progress = document.querySelector("#labProfileProgress");
    if (progress) progress.textContent = `${percent} % erkannt`;
    const facts = document.querySelector("#labSessionMeta");
    if (facts) facts.innerHTML = profile ? [
      ["Prozessor", profile.mcu_variant || profile.processor_family || "Unbekannt"],
      ["Modul", profile.module_name || "Unbekannt"],
      ["Aktueller Schritt", assistantStepLabel(session?.lab_chat?.assistant_state?.step)],
      ["Profilstatus", session?.discovery?.examination?.status === "passed" ? "Geprüft" : session?.lab_chat?.assistant_state?.completed ? "Einrichtung abgeschlossen" : "In Arbeit"],
    ].map(keyFact).join("") : emptyProperty("Noch keine Grunddaten erkannt.");
    const memory = document.querySelector("#labProfileMemory");
    if (memory) memory.innerHTML = profile ? [
      ["Interner RAM", formatBytes(profile.ram_bytes)], ["Flash", formatBytes(profile.flash_bytes)],
      ["Externer RAM / PSRAM", formatBytes(profile.psram_bytes)], ["Build-Ziel", profile.platformio?.board || "Noch offen"],
    ].map(propertyCard).join("") : emptyProperty("Noch keine Speicherwerte erkannt.");
    const capabilities = document.querySelector("#labProfileCapabilities");
    if (capabilities) capabilities.innerHTML = (profile?.capabilities || []).length ? profile.capabilities.map((item) => `<span>${escapeHtml(readable(item))}</span>`).join("") : emptyProperty("Noch keine Schnittstellen erkannt.");
    const peripherals = document.querySelector("#labProfilePeripherals");
    if (peripherals) peripherals.innerHTML = (profile?.integrated_peripherals || []).length ? profile.integrated_peripherals.map((item) => `<div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml([readable(item.kind), item.interface, item.driver].filter(Boolean).join(" · "))}</span><small>${confidenceLabel(item.confidence)}</small></div>`).join("") : emptyProperty("Display, Audio, Sensoren und weitere Bauteile erscheinen hier.");
    const pins = document.querySelector("#labProfilePins");
    const confirmedPins = (profile?.pin_candidates || []).filter((pin) => Number.isInteger(pin.gpio) && ["confirmed", "documented"].includes(pin.confidence)).slice(0, 16);
    if (pins) pins.innerHTML = confirmedPins.length ? confirmedPins.map((pin) => `<div><code>GPIO ${pin.gpio}</code><strong>${escapeHtml(readable(pin.function))}</strong><span>${directionLabel(pin.direction)}</span><small>${confidenceLabel(pin.confidence)}</small></div>`).join("") : emptyProperty("Bestätigte Taster-, LED- und Bus-Zuordnungen erscheinen erst, wenn sie wirklich belegt sind.");
    const questions = document.querySelector("#labProfileQuestions");
    const currentQuestion = session?.lab_chat?.assistant_state?.current_question;
    if (questions) questions.innerHTML = currentQuestion
      ? `<li>${escapeHtml(currentQuestion)}</li>`
      : `<li class="is-empty">${session?.lab_chat?.assistant_state?.completed ? "Die Einrichtung ist vollständig." : profile ? "Die KI bestimmt gerade den nächsten sinnvollen Schritt." : "Die erste Frage erscheint nach deiner Nachricht."}</li>`;
  }

  function renderWorkflow(session) {
    const completed = new Set(session?.discovery?.examination?.completed_phases || []);
    const phases = session?.discovery?.required_phases || ["chip_and_memory", "boot_flash_and_recovery", "safe_bus_and_peripheral_scan", "runtime_and_connectivity", "source_comparison"];
    const node = document.querySelector("#labPhaseList");
    if (node) node.innerHTML = phases.map((phase) => `<li class="${completed.has(phase) ? "is-complete" : ""}">${escapeHtml(phaseLabel(phase))}</li>`).join("");
  }

  function renderProposedTests(session) {
    const tests = session?.lab_chat?.proposed_tests || [];
    const section = document.querySelector("#labProposedTestsSection");
    section?.classList.toggle("hidden", tests.length === 0);
    const node = document.querySelector("#labProposedTests");
    if (node) node.innerHTML = tests.map((test) => `<article><strong>${escapeHtml(test.title)}</strong><p>${escapeHtml(test.description)}</p><span>${test.risk === "passive" ? "Passiv" : test.risk === "low" ? "Niedriges Risiko" : "Prüfung erforderlich"}${test.requires_confirmation ? " · Bestätigung nötig" : ""}</span></article>`).join("");
  }

  function profileSummary(profile) {
    const found = [profile?.mcu_variant, Number.isFinite(profile?.flash_bytes) ? `${formatBytes(profile.flash_bytes)} Flash` : "", Number.isFinite(profile?.psram_bytes) ? `${formatBytes(profile.psram_bytes)} PSRAM` : ""].filter(Boolean).join(", ");
    const open = profile?.unresolved_questions?.length || 0;
    return `Ich habe die Quellen ausgewertet${found ? ` und ${found} erkannt` : ""}. ${open ? `${open} Angaben sind noch offen. Frag mich danach oder beschreibe, was du auf dem Board siehst.` : "Das Profil ist bereit für die sichere Hardwareprüfung."}`;
  }

  function profileCompleteness(profile) {
    if (!profile) return 0;
    const checks = [profile.board_name && profile.board_name !== "Noch unbekanntes Board", profile.manufacturer, profile.mcu_variant || profile.module_name, Number.isFinite(profile.ram_bytes), Number.isFinite(profile.flash_bytes), Number.isFinite(profile.psram_bytes), profile.platformio?.board, profile.capabilities?.length, profile.integrated_peripherals?.length];
    return Math.round((checks.filter(Boolean).length / checks.length) * 100);
  }

  function endpoint(session, action) { return `/api/platform/hardware-lab/sessions/${encodeURIComponent(session.recovery_session_id)}/${action}`; }
  function value(selector) { return document.querySelector(selector)?.value.trim() || ""; }
  function setDisabled(selector, disabled) { const node = document.querySelector(selector); if (node) node.disabled = disabled; }
  function toggle(selector, hidden) { document.querySelector(selector)?.classList.toggle("hidden", hidden); }
  function setConnection(text, busy) { const node = document.querySelector("#labChatConnection"); if (node) { node.textContent = text; node.classList.toggle("is-busy", busy); } }
  function setStatus(kind, text) { const node = document.querySelector("#labStatusBox"); if (!node) return; node.className = `hardware-lab-status ${kind}`; node.textContent = text; }
  function keyFact([label, text]) { return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(text)}</dd></div>`; }
  function propertyCard([label, text]) { return `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(text)}</strong></div>`; }
  function emptyProperty(text) { return `<p class="hardware-lab-empty">${escapeHtml(text)}</p>`; }
  function formatBytes(bytes) { if (!Number.isFinite(bytes)) return "Unbekannt"; if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(bytes % 1048576 ? 1 : 0)} MB`; if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB`; return `${bytes} B`; }
  function formatMessage(text) { return escapeHtml(String(text || "")).replace(/\n/g, "<br>"); }
  function readable(value) { return String(value || "").replace(/[._-]+/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
  function directionLabel(value) { return ({ input: "Eingang", output: "Ausgang", bus: "Bus", unknown: "Richtung offen" })[value] || "Richtung offen"; }
  function confidenceLabel(value) { return ({ confirmed: "Bestätigt", documented: "Dokumentiert", inferred: "KI-Hinweis", unknown: "Noch offen" })[value] || "Noch offen"; }
  function assistantStepLabel(value) { return ({ intake: "Board beschreiben", sources: "Quelle prüfen", identity: "Board erkennen", processor: "Prozessor erkennen", memory: "Speicher erkennen", interfaces: "Ausstattung erkennen", pins: "Anschlüsse bestätigen", discovery: "Discovery vorbereiten", complete: "Fertig" })[value] || "Board beschreiben"; }
  function phaseLabel(phase) { return ({ chip_and_memory: "Chip und Speicher", boot_flash_and_recovery: "Boot, Flash und Recovery", safe_bus_and_peripheral_scan: "Busse und Peripherie", runtime_and_connectivity: "Runtime und Konnektivität", source_comparison: "Abgleich mit Quellen" })[phase] || phase; }

  return { bind, enter, render };
})();

export {
  GerNetiXHardwareLab,
};

/* ---- Uebergangsbruecke ---- */
/*
 * Noch klassisch und liest diese Namen global: app-shell-controller.js.
 * Verschwindet mit dem letzten davon.
 */
Object.assign(globalThis, {
  GerNetiXHardwareLab,
});
/* ---- /Uebergangsbruecke ---- */
