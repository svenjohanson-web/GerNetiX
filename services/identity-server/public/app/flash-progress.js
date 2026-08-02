window.GerNetiXFlashProgress = (() => {
  const phaseLabels = {
    preparing: "Flash wird vorbereitet",
    connecting: "Board wird verbunden",
    writing: "Firmware wird geschrieben",
    verifying: "Geschriebene Firmware wird geprüft",
    resetting: "Board wird neu gestartet",
    completed: "Flash abgeschlossen",
  };

  function normalizePercent(value) {
    if (value === null || value === undefined || value === "") return null;
    const percent = Number(value);
    if (!Number.isFinite(percent)) return null;
    return Math.max(0, Math.min(100, Math.round(percent)));
  }

  function progressFromJob(job = {}) {
    const directPercent = normalizePercent(job.percent);
    if (directPercent !== null) return directPercent;
    const lines = Array.isArray(job.logs) ? job.logs : [];
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = typeof lines[index] === "string" ? lines[index] : lines[index]?.line;
      const match = String(line || "").match(/(\d{1,3})\s*%/);
      if (match) return normalizePercent(match[1]);
    }
    return null;
  }

  function messageFromJob(job = {}, fallback = "Flash läuft...") {
    if (String(job.message || "").trim()) return String(job.message).trim();
    const phase = String(job.phase || "").trim();
    if (phaseLabels[phase]) return phaseLabels[phase];
    const lines = Array.isArray(job.logs) ? job.logs : [];
    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const line = typeof lines[index] === "string" ? lines[index] : lines[index]?.line;
      if (String(line || "").trim()) return String(line).trim();
    }
    return fallback;
  }

  function render(target, kind, message, percent = null) {
    const status = typeof target === "string" ? document.querySelector(target) : target;
    if (!status) return;
    const normalizedPercent = normalizePercent(percent);
    status.className = `flash-status ${kind}`;
    status.replaceChildren();
    if (kind !== "running") {
      status.textContent = message;
      return;
    }

    const heading = document.createElement("div");
    heading.className = "flash-progress-heading";
    const label = document.createElement("span");
    label.className = "flash-progress-message";
    label.textContent = message;
    const value = document.createElement("strong");
    value.className = "flash-progress-value";
    value.textContent = normalizedPercent === null ? "läuft" : `${normalizedPercent} %`;
    heading.append(label, value);

    const track = document.createElement("div");
    track.className = `flash-progress-track${normalizedPercent === null ? " indeterminate" : ""}`;
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-label", message);
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "100");
    if (normalizedPercent !== null) track.setAttribute("aria-valuenow", String(normalizedPercent));
    const bar = document.createElement("span");
    if (normalizedPercent !== null) bar.style.width = `${normalizedPercent}%`;
    track.append(bar);
    status.append(heading, track);
  }

  function renderJob(target, job, fallback) {
    render(target, "running", messageFromJob(job, fallback), progressFromJob(job));
  }

  return { messageFromJob, normalizePercent, progressFromJob, render, renderJob };
})();
