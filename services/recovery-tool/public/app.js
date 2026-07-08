const state = {
  session: null,
  secret: "",
};

document.querySelector("#detectForm").addEventListener("submit", createSession);
document.querySelector("#confirmButton").addEventListener("click", confirmCapabilities);
document.querySelector("#credentialButton").addEventListener("click", renewCredentials);
document.querySelector("#connectivityButton").addEventListener("click", resetConnectivity);
document.querySelector("#registerButton").addEventListener("click", registerDevice);
bootstrap();

async function bootstrap() {
  const health = await getJson("/health").catch(() => null);
  document.querySelector("#healthBadge").textContent = health ? "Recovery Tool bereit" : "Nicht verbunden";
  render();
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
  setStatus("running", "Neue Credentials werden erzeugt...");
  const renewed = await postJson(`/api/recovery/sessions/${encodeURIComponent(state.session.recovery_session_id)}/renew-credentials`, {});
  state.session = renewed;
  state.secret = renewed.one_time_device_secret || "";
  setStatus("ok", "One-Time Device Secret wurde erzeugt. Es wird nicht dauerhaft gespeichert.");
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
    one_time_device_secret: state.secret,
    account_id: value("#accountId"),
  });
  state.secret = "";
  setStatus("ok", "Device ist als Recovery-/Community-Device registriert.");
  render();
}

function render() {
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
        one_time_secret_available: Boolean(state.secret),
      }, null, 2)
    : "";
}

function redactSession(session) {
  const copy = { ...session };
  delete copy.one_time_device_secret;
  return copy;
}

function setStatus(kind, text) {
  const node = document.querySelector("#statusBox");
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
