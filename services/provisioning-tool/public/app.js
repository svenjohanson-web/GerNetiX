const state = {
  session: null,
  secret: "",
  processorBoards: [],
  firmwareArtifact: null,
  flashMode: null,
  operationTimer: null,
  flashJobPoller: null,
};

document.querySelector("#sessionForm").addEventListener("submit", createSession);
document.querySelector("#processorBoard").addEventListener("change", selectProcessorBoard);
document.querySelector("#credentialResetButton").addEventListener("click", resetActiveCredential);
document.querySelector("#usbFlashButton").addEventListener("click", executeUsbFlash);
document.querySelector("#completeButton").addEventListener("click", completeSession);
document.querySelectorAll("input[name='flashMode']").forEach((input) => input.addEventListener("change", render));
bootstrap();

async function bootstrap() {
  const health = await getJson("/health").catch(() => null);
  document.querySelector("#runnerBadge").textContent = health ? "Provisioning Tool" : "Nicht verbunden";
  const boards = await getJson("/api/provisioning-processor-boards").catch(() => ({ items: [] }));
  state.processorBoards = boards.items || [];
  state.flashMode = await getJson("/api/provisioning-flash-mode").catch(() => null);
  renderProcessorBoards();
  renderFlashMode();
  await selectProcessorBoard();
  render();
}

async function createSession(event) {
  event.preventDefault();
  setStatus("flashStatus", "running", "Session und USB-Factory-Header werden vorbereitet...");
  try {
    const session = await postJson("/api/provisioning-sessions", {
      serial_number: value("#serialNumber"),
      hardware_profile_id: value("#hardwareProfile"),
      provisioning_batch_id: value("#batchId"),
      firmware_version: value("#firmwareVersion"),
      provisioned_by: value("#actor"),
      processor_board_id: value("#processorBoard"),
      capabilities: ["wifi", "ota", "flash_firmware"],
      flash: {
        requested: true,
        port: value("#usbPort"),
        write_factory_header: true,
      },
    });
    const manifest = await getJson(`/api/provisioning-sessions/${encodeURIComponent(session.session_id)}/manifest`);
    state.session = { ...session, manifest };
    state.secret = session.one_time_device_secret || "";
    state.flashMode = await getJson("/api/provisioning-flash-mode").catch(() => state.flashMode);
    render();
  } catch (error) {
    setStatus("flashStatus", "error", error.message);
  }
}

async function resetActiveCredential() {
  const serialNumber = value("#serialNumber");
  if (!serialNumber) {
    setStatus("flashStatus", "error", "Bitte zuerst eine Seriennummer eintragen.");
    return;
  }
  const confirmed = window.confirm(`Aktives Credential fuer ${serialNumber} zuruecksetzen? Danach kann dieses Device neu provisioniert werden.`);
  if (!confirmed) return;
  setStatus("flashStatus", "running", "Aktives Credential wird zurueckgesetzt...");
  try {
    const result = await postJson("/api/provisioning-credentials/reset", {
      serial_number: serialNumber,
      actor: value("#actor"),
      reason: "factory_reprovisioning",
    });
    state.session = null;
    state.secret = "";
    setStatus("flashStatus", "ok", `Credential zurueckgesetzt: ${result.credential_id}`);
    render();
  } catch (error) {
    setStatus("flashStatus", "error", error.message);
  }
}

async function selectProcessorBoard() {
  const board = state.processorBoards.find((item) => item.hardware_item_id === value("#processorBoard")) || state.processorBoards[0];
  if (!board) return;
  document.querySelector("#hardwareProfile").value = board.hardware_profile_id || board.hardware_item_id;
  state.firmwareArtifact = await getJson(`/api/provisioning-firmware-artifact?processor_board_id=${encodeURIComponent(board.hardware_item_id)}`).catch(() => board.factory_firmware_artifact || null);
  state.flashMode = await getJson("/api/provisioning-flash-mode").catch(() => state.flashMode);
  renderFlashMode();
  render();
}

async function executeUsbFlash() {
  if (!state.session) return;
  document.querySelector("#usbFlashButton").disabled = true;
  const runner = selectedFlashMode();
  const port = value("#usbPort");
  resetFlashProgress();
  renderFlashJob({
    status: "running",
    runner,
    port,
    percent: runner === "esptool" ? 0 : 10,
    phase: "starting",
    message: runner === "esptool" ? "Echter USB-Flash wird gestartet..." : "Mock-Flash wird gestartet...",
    logs: [],
  });
  try {
    const job = await postJson(`/api/provisioning-sessions/${encodeURIComponent(state.session.session_id)}/usb-flash-jobs`, {
      port,
      actor: value("#actor"),
      flash_runner: runner,
    });
    await pollFlashJob(job.job_id);
  } catch (error) {
    stopFlashJobPolling();
    if (!error.flashJobRendered) {
      setStatus("flashStatus", "error", error.message);
    }
    document.querySelector("#usbFlashButton").disabled = false;
  }
}

async function completeSession() {
  if (!state.session) return;
  setStatus("flashStatus", "running", "Device Management Registrierung wird abgeschlossen...");
  const completed = await postJson(`/api/provisioning-sessions/${encodeURIComponent(state.session.session_id)}`, {
    completed_by: value("#actor"),
    quality_check_state: "passed",
    connectivity_status: "unknown",
    ota_status: "ready",
    one_time_device_secret: state.secret,
  });
  const manifest = await getJson(`/api/provisioning-sessions/${encodeURIComponent(completed.session_id)}/manifest`);
  state.session = { ...completed, manifest };
  state.secret = "";
  render();
}

function render() {
  const session = state.session;
  const realFlashNeedsArtifact = selectedFlashMode() === "esptool" && !state.flashMode?.artifact_ready;
  document.querySelector("#usbFlashButton").disabled = !session || realFlashNeedsArtifact || session.status === "completed" || hasRealFlashSucceeded(session);
  document.querySelector("#completeButton").disabled = !session || session.status === "completed";
  renderFirmwareArtifact();
  document.querySelector("#sessionMeta").innerHTML = session ? [
    ["session_id", session.session_id],
    ["status", session.status],
    ["device_id", session.device.device_id],
    ["serial_number", session.device.serial_number],
    ["credential_id", session.credential.credential_id],
    ["firmware_artifact", session.manifest?.firmware?.artifact?.artifact_id || state.firmwareArtifact?.artifact_id || ""],
    ["artifact_source", session.manifest?.firmware?.artifact?.source || state.firmwareArtifact?.source || ""],
    ["flash_status", session.flash_plan?.status || ""],
  ].map(meta).join("") : state.firmwareArtifact ? [
    ["firmware_artifact", state.firmwareArtifact.artifact_id],
    ["artifact_source", state.firmwareArtifact.source],
    ["artifact_uri", state.firmwareArtifact.uri],
  ].map(meta).join("") : "";

  if (state.secret) {
    setStatus("secretStatus", "ok", "Einmaliges Device-Secret liegt nur für diesen Vorgang im Tool vor.");
  } else {
    hideStatus("secretStatus");
  }

  const result = session?.usb_flash_result || session?.flash_plan?.last_flash_result;
  if (result) {
    const ok = ["mock_flash_completed", "flashed"].includes(result.status);
    setStatus("flashStatus", ok ? "ok" : "error", `USB-Flash: ${result.status}${result.port ? ` auf ${result.port}` : ""}`);
    if (ok) {
      renderFlashJob({
        status: "completed",
        runner: result.runner,
        port: result.port,
        percent: 100,
        phase: "completed",
        message: `USB-Flash: ${result.status}${result.port ? ` auf ${result.port}` : ""}`,
        logs: [],
      });
    }
  }

  document.querySelector("#detailsBox").textContent = session
    ? JSON.stringify({
        manifest: session.manifest || null,
        flash_plan: session.flash_plan || null,
        usb_flash_result: session.usb_flash_result || null,
        device_management_registration: session.device_management_registration || null,
      }, null, 2)
    : "";
}

function hasRealFlashSucceeded(session) {
  const result = session?.usb_flash_result || session?.flash_plan?.last_flash_result;
  return session?.flash_plan?.status === "usb_flashed" && result?.status === "flashed" && result?.runner !== "mock";
}

function renderProcessorBoards() {
  const select = document.querySelector("#processorBoard");
  select.innerHTML = state.processorBoards.map((board) => `
    <option value="${escapeHtml(board.hardware_item_id)}">${escapeHtml(board.title || board.hardware_item_id)}</option>
  `).join("");
}

function renderFlashMode() {
  if (!state.flashMode) return;
  const real = document.querySelector("#realFlashMode");
  const mock = document.querySelector("input[name='flashMode'][value='mock']");
  const realMode = (state.flashMode.modes || []).find((item) => item.id === "esptool");
  real.disabled = !state.flashMode.allow_real_usb_flash;
  if (real.disabled && real.checked) {
    mock.checked = true;
  }
  if (state.flashMode.default_runner === "esptool" && state.flashMode.allow_real_usb_flash) {
    real.checked = true;
  }
  const text = !state.flashMode.allow_real_usb_flash
    ? "Echter USB-Flash ist deaktiviert. Server mit ALLOW_REAL_USB_FLASH=true starten."
    : realMode?.enabled
      ? "Echter USB-Flash ist bereit."
      : "Echter USB-Flash ist auswaehlbar. Vor dem Flashen muss das serverseitige Firmware-Artefakt vorhanden sein.";
  setStatus("flashStatus", realMode?.enabled ? "ok" : "running", text);
}

function renderFirmwareArtifact() {
  const artifact = state.session?.manifest?.firmware?.artifact || state.firmwareArtifact;
  document.querySelector("#firmwareArtifactMeta").innerHTML = artifact ? [
    ["artifact_id", artifact.artifact_id || ""],
    ["source", artifact.source || ""],
    ["uri", artifact.uri || ""],
    ["version", artifact.version || ""],
    ["sha256", artifact.sha256 || ""],
  ].map(meta).join("") : "";

  if (!artifact?.artifact_id) {
    setStatus("firmwareArtifactStatus", "error", "Kein Firmware-Artefakt fuer das gewaehlte Board bekannt.");
    return;
  }
  if (state.flashMode?.artifact_ready) {
    setStatus("firmwareArtifactStatus", "ok", "Firmware-Artefakt ist serverseitig vorhanden.");
    return;
  }
  setStatus(
    "firmwareArtifactStatus",
    "running",
    "Firmware-Artefakt ist nur referenziert. Es muss im SQLite Artifact Store liegen oder per PROVISIONING_FIRMWARE_FILE_PATH vom Server geladen werden.",
  );
}

function startOperationStatus(message, details = {}) {
  stopOperationStatus();
  const startedAt = new Date();
  const renderOperation = () => {
    const elapsedSeconds = Math.max(0, Math.round((Date.now() - startedAt.getTime()) / 1000));
    setStatus("flashStatus", "running", `${message} seit ${elapsedSeconds}s. Bitte Board nicht trennen.`);
    document.querySelector("#detailsBox").textContent = JSON.stringify({
      operation: {
        status: "running",
        message,
        started_at: startedAt.toISOString(),
        elapsed_seconds: elapsedSeconds,
        note: "Der Server wartet auf den Flash-Prozess. Ergebnis und esptool-Log erscheinen nach Abschluss.",
        ...details,
      },
    }, null, 2);
  };
  renderOperation();
  state.operationTimer = window.setInterval(renderOperation, 1000);
}

function stopOperationStatus() {
  if (!state.operationTimer) return;
  window.clearInterval(state.operationTimer);
  state.operationTimer = null;
}

async function pollFlashJob(jobId) {
  stopFlashJobPolling();
  return new Promise((resolve, reject) => {
    const tick = async () => {
      try {
        const job = await getJson(`/api/provisioning-flash-jobs/${encodeURIComponent(jobId)}`);
        renderFlashJob(job);
        if (job.status === "completed") {
          stopFlashJobPolling();
          const flashed = job.result;
          const manifest = await getJson(`/api/provisioning-sessions/${encodeURIComponent(flashed.session_id)}/manifest`);
          state.session = { ...flashed, manifest };
          render();
          resolve(job);
          return;
        }
        if (job.status === "failed") {
          stopFlashJobPolling();
          const message = formatFlashJobFailure(job);
          setStatus("flashStatus", "error", message);
          document.querySelector("#usbFlashButton").disabled = false;
          const error = new Error(message);
          error.flashJobRendered = true;
          reject(error);
        }
      } catch (error) {
        stopFlashJobPolling();
        reject(error);
      }
    };
    state.flashJobPoller = window.setInterval(tick, 700);
    tick();
  });
}

function stopFlashJobPolling() {
  if (!state.flashJobPoller) return;
  window.clearInterval(state.flashJobPoller);
  state.flashJobPoller = null;
}

function resetFlashProgress() {
  const progress = document.querySelector("#flashProgress");
  progress.classList.remove("hidden");
  document.querySelector("#flashProgressBar").style.width = "0%";
  document.querySelector("#flashProgressPercent").textContent = "0%";
  document.querySelector("#flashProgressText").textContent = "";
  document.querySelector(".progress-track").setAttribute("aria-valuenow", "0");
}

function renderFlashJob(job) {
  const percent = Math.max(0, Math.min(100, Number(job.percent || 0)));
  const progress = document.querySelector("#flashProgress");
  progress.classList.remove("hidden");
  document.querySelector("#flashProgressLabel").textContent = flashPhaseLabel(job.phase, job.runner);
  document.querySelector("#flashProgressPercent").textContent = `${percent}%`;
  document.querySelector("#flashProgressBar").style.width = `${percent}%`;
  document.querySelector(".progress-track").setAttribute("aria-valuenow", String(percent));
  document.querySelector("#flashProgressText").textContent = job.message || "";
  const statusKind = job.status === "failed" ? "error" : job.status === "completed" ? "ok" : "running";
  setStatus("flashStatus", statusKind, job.status === "failed"
    ? formatFlashJobFailure(job)
    : `${job.runner || "usb"}${job.port ? ` auf ${job.port}` : ""}: ${job.message || job.status}`);
  document.querySelector("#detailsBox").textContent = JSON.stringify({
    flash_job: {
      job_id: job.job_id || "",
      status: job.status,
      runner: job.runner,
      port: job.port,
      percent,
      phase: job.phase,
      message: job.message,
      started_at: job.started_at || "",
      updated_at: job.updated_at || "",
      completed_at: job.completed_at || "",
      recent_log: (job.logs || []).slice(-30),
      error: job.error || null,
    },
    result: job.result?.usb_flash_result || null,
  }, null, 2);
}

function formatFlashJobFailure(job = {}) {
  const result = job.result?.usb_flash_result || {};
  const error = job.error || {};
  const exitText = result.exit_code !== undefined && result.exit_code !== null
    ? `Exit-Code ${result.exit_code}`
    : "";
  const signalText = result.signal ? `Signal ${result.signal}` : "";
  const tail = lastLogLine(job.logs) || error.message || lastTextLine(result.stderr) || lastTextLine(result.stdout);
  const detail = tail || job.message || "Kein Detail-Log vom Flash-Prozess erhalten.";
  return [
    "USB-Flash fehlgeschlagen",
    job.runner || result.runner || "",
    job.port || result.port ? `auf ${job.port || result.port}` : "",
    exitText || signalText,
    detail,
  ].filter(Boolean).join(" - ");
}

function lastLogLine(logs = []) {
  const entry = logs.slice().reverse().find((item) => item.line && item.type !== "result");
  return entry?.line || "";
}

function lastTextLine(value = "") {
  const lines = String(value || "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  return lines.length ? lines[lines.length - 1] : "";
}

function flashPhaseLabel(phase, runner) {
  const labels = {
    queued: "USB-Flash wartet",
    starting: "USB-Flash startet",
    connecting: "Board verbinden",
    uploading_stub: "Flash-Stub laden",
    stub_running: "Flash-Stub bereit",
    configuring_flash: "Flash konfigurieren",
    erasing: "Flash loeschen",
    writing: "Firmware schreiben",
    verifying: "Firmware pruefen",
    resetting: "Board neu starten",
    finishing: "Abschluss",
    completed: "USB-Flash abgeschlossen",
    failed: "USB-Flash fehlgeschlagen",
  };
  return labels[phase] || (runner === "mock" ? "Mock-Flash" : "USB-Flash");
}

function selectedFlashMode() {
  return document.querySelector("input[name='flashMode']:checked")?.value || "mock";
}

function setStatus(id, kind, text) {
  const node = document.querySelector(`#${id}`);
  node.className = `status ${kind}`;
  node.textContent = text;
}

function hideStatus(id) {
  const node = document.querySelector(`#${id}`);
  node.className = "status hidden";
  node.textContent = "";
}

function meta([label, value]) {
  return `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`;
}

function value(selector) {
  return document.querySelector(selector).value.trim();
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
