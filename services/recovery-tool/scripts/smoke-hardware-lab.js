const baseUrl = String(process.env.HARDWARE_LAB_BASE_URL || "http://127.0.0.1:5100").replace(/\/$/, "");
const sourceUrl = process.env.HARDWARE_LAB_SOURCE_URL || "https://www.waveshare.com/esp32-s3-audio-board.htm";
const accountId = process.env.HARDWARE_LAB_ACCOUNT_ID || "hardware-lab-smoke";
const timeoutMs = Number(process.env.HARDWARE_LAB_SMOKE_TIMEOUT_MS || 180000);

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: error.message, code: error.code || "smoke_failed" }, null, 2));
  process.exitCode = 1;
});

async function main() {
  const session = await call("POST", "/api/recovery/hardware-lab/sessions", {
    account_id: accountId,
    board_name: "Waveshare ESP32-S3-AUDIO-Board",
    manufacturer: "Waveshare",
    source_urls: [sourceUrl],
    notes: "Lokaler KI- und Build-Smoke-Test ohne aktiven Pintest.",
  });
  const analyzed = await call("POST", `/api/recovery/hardware-lab/sessions/${encodeURIComponent(session.recovery_session_id)}/analyze-sources`, {});
  const build = await call("POST", `/api/recovery/hardware-lab/sessions/${encodeURIComponent(session.recovery_session_id)}/discovery-firmware-build`, {});
  let current = build;
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (["success", "failed", "cancelled", "replaced"].includes(current.discovery?.firmware_build?.status)) break;
    await new Promise((resolve) => setTimeout(resolve, 1000));
    current = await call("POST", `/api/recovery/hardware-lab/sessions/${encodeURIComponent(session.recovery_session_id)}/discovery-firmware-build-status`, {});
  }
  const result = {
    ok: current.discovery?.firmware_build?.status === "success",
    session_id: session.recovery_session_id,
    ai: {
      provider: analyzed.ai_analysis?.provider,
      model: analyzed.ai_analysis?.model,
      board_name: analyzed.ai_analysis?.profile?.board_name,
      processor_family: analyzed.ai_analysis?.profile?.processor_family,
      mcu_variant: analyzed.ai_analysis?.profile?.mcu_variant,
      platformio_board: analyzed.ai_analysis?.profile?.platformio?.board,
      evidence_count: analyzed.ai_analysis?.profile?.evidence?.length || 0,
      unresolved_question_count: analyzed.ai_analysis?.profile?.unresolved_questions?.length || 0,
      usage: analyzed.ai_analysis?.usage,
    },
    build: {
      job_id: current.discovery?.firmware_build?.build_job_id,
      status: current.discovery?.firmware_build?.status,
      firmware_sha256: current.discovery?.firmware_build?.firmware_sha256,
      artifact_url: current.discovery?.firmware_build?.artifact_url,
      failure_code: current.discovery?.firmware_build?.failure_code,
    },
  };
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

async function call(method, pathname, body) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method,
    headers: { "Content-Type": "application/json" },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.message || payload.error || `HTTP ${response.status}`);
    error.code = payload.error;
    throw error;
  }
  return payload;
}
