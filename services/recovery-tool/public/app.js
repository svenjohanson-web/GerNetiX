const state = {
  session: null,
  hardwareLabSession: null,
};

document.querySelector("#hardwareLabForm").addEventListener("submit", createHardwareLabSession);
document.querySelector("#labAnalyzeButton").addEventListener("click", analyzeHardwareSources);
document.querySelector("#labBuildButton").addEventListener("click", requestDiscoveryFirmwareBuild);
document.querySelector("#labBuildStatusButton").addEventListener("click", synchronizeDiscoveryFirmwareBuild);
document.querySelector("#labVerificationButton").addEventListener("click", requestGerNetiXVerification);
document.querySelector("#labVerificationConsent").addEventListener("change", renderHardwareLab);
document.querySelector("#detectForm").addEventListener("submit", createSession);
document.querySelector("#confirmButton").addEventListener("click", confirmCapabilities);
document.querySelector("#credentialButton").addEventListener("click", renewCredentials);
document.querySelector("#connectivityButton").addEventListener("click", resetConnectivity);
document.querySelector("#registerButton").addEventListener("click", registerDevice);
bootstrap();

async function bootstrap() {
  const health = await getJson("/health").catch(() => null);
  document.querySelector("#healthBadge").textContent = health ? "Hardware-Labor bereit" : "Nicht verbunden";
  const sessions = health ? await getJson("/api/recovery/sessions").catch(() => ({ items: [] })) : { items: [] };
  state.hardwareLabSession = (sessions.items || []).filter((session) => session.recovery_type === "ai_guided_hardware_lab").at(-1) || null;
  render();
}

async function createHardwareLabSession(event) {
  event.preventDefault();
  setLabStatus("running", "Board-Kandidat und verpflichtender Discovery-Ablauf werden angelegt...");
  try {
    state.hardwareLabSession = await postJson("/api/recovery/hardware-lab/sessions", {
      account_id: value("#labAccountId"),
      board_name: value("#labBoardName"),
      manufacturer: value("#labManufacturer"),
      source_urls: value("#labSourceUrls").split(/\r?\n/).filter(Boolean),
      notes: value("#labNotes"),
    });
    setLabStatus("ok", "Board-Kandidat angelegt. Als Nächstes wird die Discovery-Firmware angefordert.");
    renderHardwareLab();
  } catch (error) {
    setLabStatus("error", error.message);
  }
}

async function requestDiscoveryFirmwareBuild() {
  const session = state.hardwareLabSession;
  if (!session) return;
  setLabStatus("running", "Discovery-Firmware-Build wird angefordert...");
  try {
    state.hardwareLabSession = await postJson(`/api/recovery/hardware-lab/sessions/${encodeURIComponent(session.recovery_session_id)}/discovery-firmware-build`, {});
    setLabStatus("ok", "Build angefordert. Aktualisiere den Status, bis die Firmware bereitsteht.");
    renderHardwareLab();
  } catch (error) {
    setLabStatus("error", error.message);
  }
}

async function analyzeHardwareSources() {
  const session = state.hardwareLabSession;
  if (!session) return;
  setLabStatus("running", "Herstellerseiten und Datenblätter werden sicher geladen und mit der konfigurierten OpenAI-Route analysiert...");
  try {
    state.hardwareLabSession = await postJson(`/api/recovery/hardware-lab/sessions/${encodeURIComponent(session.recovery_session_id)}/analyze-sources`, {});
    setLabStatus("ok", "KI-Boardprofil erstellt. Prüfe den Kandidaten und fordere anschließend die passive Discovery-Firmware an.");
    renderHardwareLab();
  } catch (error) {
    setLabStatus("error", error.message);
  }
}

async function synchronizeDiscoveryFirmwareBuild() {
  const session = state.hardwareLabSession;
  if (!session) return;
  setLabStatus("running", "Buildstatus wird vom Build-&-Deploy-Server gelesen...");
  try {
    state.hardwareLabSession = await postJson(`/api/recovery/hardware-lab/sessions/${encodeURIComponent(session.recovery_session_id)}/discovery-firmware-build-status`, {});
    const status = state.hardwareLabSession.discovery?.firmware_build?.status;
    setLabStatus(status === "success" ? "ok" : status === "failed" ? "error" : "running", status === "success"
      ? "Discovery-Firmware erfolgreich gebaut. Sie kann jetzt auf das reale Board geflasht und ausgeführt werden."
      : status === "failed" ? "Discovery-Firmware-Build fehlgeschlagen." : `Buildstatus: ${status}.`);
    renderHardwareLab();
  } catch (error) {
    setLabStatus("error", error.message);
  }
}

async function requestGerNetiXVerification() {
  const session = state.hardwareLabSession;
  if (!session) return;
  setLabStatus("running", "GerNetiX-Prüfanfrage wird übermittelt...");
  try {
    state.hardwareLabSession = await postJson(`/api/recovery/hardware-lab/sessions/${encodeURIComponent(session.recovery_session_id)}/gernetix-verification-request`, {
      consent_to_share_profile: document.querySelector("#labVerificationConsent").checked,
      customer_message: value("#labVerificationMessage"),
    });
    setLabStatus("ok", "Prüfanfrage eingereicht. Versanddaten wurden noch nicht erhoben.");
    renderHardwareLab();
  } catch (error) {
    setLabStatus("error", error.message);
  }
}

async function createSession(event) {
  event.preventDefault();
  setStatus("running", "Recovery Session wird aus USB-Erkennung vorbereitet...");
  try {
    const session = await postJson("/api/recovery/sessions", {
      account_id: value("#accountId"),
      detection: {
        usb_path: value("#usbPath"),
        serial_number: value("#serialNumber"),
        vendor_id: value("#vendorId"),
        product_id: value("#productId"),
        chip_family: value("#chipFamily"),
        bootloader_detected: true,
      },
    });
    state.session = session;
    setStatus("ok", "Board erkannt. Bitte Angaben pruefen.");
    render();
  } catch (error) {
    setStatus("error", error.message);
  }
}

async function confirmCapabilities() {
  if (!state.session) return;
  setStatus("running", "Faehigkeiten werden bestaetigt...");
  const answers = Object.fromEntries(Array.from(document.querySelectorAll("[data-question-id]")).map((input) => [
    input.dataset.questionId,
    input.checked,
  ]));
  state.session = await postJson(`/api/recovery/sessions/${encodeURIComponent(state.session.recovery_session_id)}/capabilities`, {
    answers,
    capabilities: state.session.capabilities || [],
  });
  setStatus("ok", "Recovery-Angaben sind bestaetigt.");
  render();
}

async function renewCredentials() {
  if (!state.session) return;
  setStatus("running", "Oeffentliche Device-Identitaet wird uebernommen...");
  const renewed = await postJson(`/api/recovery/sessions/${encodeURIComponent(state.session.recovery_session_id)}/renew-credentials`, {
    public_key_pem: value("#devicePublicKey"),
    certificate_pem: value("#deviceCertificate"),
  });
  state.session = renewed;
  setStatus("ok", "Public-Key-Credential wurde erneuert; kein Shared Secret wurde gespeichert.");
  render();
}

async function resetConnectivity() {
  if (!state.session) return;
  setStatus("running", "Connectivity-Recovery wird vorbereitet...");
  state.session = await postJson(`/api/recovery/sessions/${encodeURIComponent(state.session.recovery_session_id)}/connectivity-reset`, {});
  setStatus("ok", "Connectivity-Recovery vorbereitet. WLAN-Passwoerter werden nicht zentral gespeichert.");
  render();
}

async function registerDevice() {
  if (!state.session) return;
  setStatus("running", "Device wird im Device Management registriert...");
  state.session = await postJson(`/api/recovery/sessions/${encodeURIComponent(state.session.recovery_session_id)}/register-community-device`, {
    credential: state.session.credential,
    account_id: value("#accountId"),
  });
  setStatus("ok", "Device ist als Recovery-/Community-Device registriert.");
  render();
}

function render() {
  renderHardwareLab();
  const session = state.session;
  const hasSession = Boolean(session);
  document.querySelector("#confirmButton").disabled = !hasSession;
  document.querySelector("#credentialButton").disabled = !hasSession;
  document.querySelector("#connectivityButton").disabled = !hasSession;
  document.querySelector("#registerButton").disabled = !hasSession;
  document.querySelector("#sessionMeta").innerHTML = session ? [
    ["Session", session.recovery_session_id],
    ["Status", session.status],
    ["Device", session.device_id],
    ["Hardwareprofil", session.hardware_profile_id],
    ["Chip", session.detection?.chip_family || ""],
    ["USB", session.detection?.usb_path || ""],
  ].map(meta).join("") : "";
  document.querySelector("#questionList").innerHTML = session ? (session.guided_questions || []).map((question) => `
    <article class="question">
      <label>
        <input type="checkbox" data-question-id="${escapeHtml(question.question_id)}" ${question.default_answer ? "checked" : ""} />
        <span>${escapeHtml(question.prompt)}</span>
      </label>
    </article>
  `).join("") : "";
  document.querySelector("#detailsBox").textContent = session
    ? JSON.stringify({
        recovery_session: redactSession(session),
        private_key_received_by_tool: false,
      }, null, 2)
    : "";
}

function renderHardwareLab() {
  const session = state.hardwareLabSession;
  const buildStatus = session?.discovery?.firmware_build?.status || "not_started";
  const examinationStatus = session?.discovery?.examination?.status || "not_started";
  const aiStatus = session?.ai_analysis?.status || "not_started";
  const canAnalyze = Boolean(session) && !["completed"].includes(aiStatus) && !String(session?.status || "").endsWith("running");
  const canRequestBuild = aiStatus === "completed" && !["requested", "accepted", "queued", "running", "success"].includes(buildStatus) && examinationStatus !== "passed";
  const canPollBuild = Boolean(session?.discovery?.firmware_build?.build_job_id) && !["success", "failed", "cancelled", "replaced"].includes(buildStatus);
  const consented = document.querySelector("#labVerificationConsent").checked;
  const canRequestVerification = examinationStatus === "passed" && consented && !session?.gernetix_verification_request;
  document.querySelector("#labAnalyzeButton").disabled = !canAnalyze;
  document.querySelector("#labBuildButton").disabled = !canRequestBuild;
  document.querySelector("#labBuildStatusButton").disabled = !canPollBuild;
  document.querySelector("#labVerificationButton").disabled = !canRequestVerification;
  document.querySelector("#labSessionMeta").innerHTML = session ? [
    ["Vorgang", session.recovery_session_id],
    ["Board", session.candidate_profile?.board_name || ""],
    ["Status", session.status],
    ["KI-Analyse", aiStatus],
    ["KI-Modell", session.ai_analysis?.model || "-"],
    ["Discovery-Build", buildStatus],
    ["Hardwareprüfung", examinationStatus],
  ].map(meta).join("") : "";
  renderHardwareAiResult(session);
  const completed = new Set(session?.discovery?.examination?.completed_phases || []);
  document.querySelector("#labPhaseList").innerHTML = (session?.discovery?.required_phases || []).map((phase) =>
    `<li class="${completed.has(phase) ? "is-complete" : ""}">${escapeHtml(hardwareLabPhaseLabel(phase))}</li>`
  ).join("");
  document.querySelector("#labDetailsBox").textContent = session ? JSON.stringify({
    candidate_profile: session.candidate_profile,
    discovery: session.discovery,
    gernetix_verification_request: session.gernetix_verification_request,
  }, null, 2) : "";
  const firmwareLink = document.querySelector("#labFirmwareDownload");
  const artifactUrl = session?.discovery?.firmware_build?.artifact_url;
  firmwareLink.classList.toggle("hidden", !artifactUrl);
  firmwareLink.href = artifactUrl || "#";
}

function renderHardwareAiResult(session) {
  const node = document.querySelector("#labAiResult");
  const profile = session?.ai_analysis?.profile;
  node.classList.toggle("hidden", !profile);
  if (!profile) { node.innerHTML = ""; return; }
  const questions = (profile.unresolved_questions || []).slice(0, 8);
  node.innerHTML = `
    <h3>${escapeHtml(profile.board_name || "Board-Kandidat")}</h3>
    <p>${escapeHtml([profile.manufacturer, profile.mcu_variant, profile.module_name].filter(Boolean).join(" · "))}</p>
    <p>PlatformIO: <strong>${escapeHtml(profile.platformio?.board || "noch offen")}</strong> · Flash: ${escapeHtml(formatBytes(profile.flash_bytes))} · PSRAM: ${escapeHtml(formatBytes(profile.psram_bytes))}</p>
    <p>${escapeHtml((profile.capabilities || []).join(", ") || "Noch keine belegten Capabilities")}</p>
    ${questions.length ? `<strong>Offene Fragen</strong><ul>${questions.map((question) => `<li>${escapeHtml(question)}</li>`).join("")}</ul>` : ""}
  `;
}

function formatBytes(value) {
  if (!Number.isFinite(value)) return "unbekannt";
  if (value >= 1024 * 1024) return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  if (value >= 1024) return `${(value / 1024).toFixed(1)} KB`;
  return `${value} B`;
}

function hardwareLabPhaseLabel(phase) {
  return ({
    chip_and_memory: "Chip, Flash, RAM und PSRAM untersuchen",
    boot_flash_and_recovery: "Boot-, Flash- und Recovery-Verhalten prüfen",
    safe_bus_and_peripheral_scan: "Busse und Peripherie mit sicherem Pinprofil untersuchen",
    runtime_and_connectivity: "Runtime, USB, WLAN und OTA prüfen",
    source_comparison: "Messwerte mit Herstellerquellen vergleichen",
  })[phase] || phase;
}

function redactSession(session) {
  const copy = { ...session };
  return copy;
}

function setStatus(kind, text) {
  const node = document.querySelector("#statusBox");
  node.className = `status ${kind}`;
  node.textContent = text;
}

function setLabStatus(kind, text) {
  const node = document.querySelector("#labStatusBox");
  node.className = `status ${kind}`;
  node.textContent = text;
}

function value(selector) {
  return document.querySelector(selector).value.trim();
}

function meta([label, value]) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

async function getJson(url) {
  const response = await fetch(url);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `Request failed: ${url}`);
  return payload;
}

async function postJson(url, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.message || payload.error || `Request failed: ${url}`);
  return payload;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[char]);
}
