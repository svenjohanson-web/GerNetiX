(function initializeWakeWordLab() {
  "use strict";

  const lab = globalThis.NexiWakeWordLab;
  const root = document.querySelector("[data-nexi-wake-lab]");
  if (!lab || !root) return;

  const enrollButton = root.querySelector("[data-wake-enroll]");
  const testButton = root.querySelector("[data-wake-test]");
  const resetButton = root.querySelector("[data-wake-reset]");
  const status = root.querySelector("[data-wake-status]");
  const progress = root.querySelector("[data-wake-progress]");
  const result = root.querySelector("[data-wake-result]");
  const references = [];
  let busy = false;

  function setStatus(message, state = "idle") {
    status.textContent = message;
    root.dataset.wakeState = state;
  }

  function updateControls() {
    const ready = references.length >= lab.TARGET_REFERENCE_COUNT;
    progress.textContent = `${references.length} von ${lab.TARGET_REFERENCE_COUNT} Referenzen`;
    enrollButton.disabled = busy || ready;
    testButton.disabled = busy || !ready;
    resetButton.disabled = busy || references.length === 0;
    enrollButton.textContent = ready
      ? "Referenzen vollständig"
      : `Referenz ${references.length + 1} aufnehmen`;
  }

  async function recordFeatures() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error("unsupported_browser");
    }
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    const chunks = [];
    const recorder = new MediaRecorder(stream);
    recorder.addEventListener("dataavailable", (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    });

    try {
      const stopped = new Promise((resolve, reject) => {
        recorder.addEventListener("stop", resolve, { once: true });
        recorder.addEventListener("error", reject, { once: true });
      });
      recorder.start();
      await new Promise((resolve) => setTimeout(resolve, 1900));
      recorder.stop();
      await stopped;

      const blob = new Blob(chunks, { type: recorder.mimeType || "audio/webm" });
      const AudioContextType = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AudioContextType) throw new Error("unsupported_browser");
      const context = new AudioContextType();
      try {
        const audio = await context.decodeAudioData(await blob.arrayBuffer());
        const features = lab.extractFeatures(audio.getChannelData(0), audio.sampleRate);
        if (!features.length) throw new Error("no_voice");
        return features;
      } finally {
        await context.close();
      }
    } finally {
      for (const track of stream.getTracks()) track.stop();
    }
  }

  function explainError(error) {
    if (error?.name === "NotAllowedError") {
      return "Mikrofonzugriff wurde nicht erlaubt. Erlaube ihn für localhost und versuche es erneut.";
    }
    if (error?.message === "no_voice") {
      return "Keine deutliche Sprache erkannt. Sprich nach dem Start einmal klar „Nexi“.";
    }
    if (error?.message === "unsupported_browser") {
      return "Dieser Browser unterstützt den lokalen Audiotest nicht. Verwende Chrome, Edge oder Safari mit Mikrofonfreigabe.";
    }
    return "Die Aufnahme konnte nicht ausgewertet werden. Bitte versuche es erneut.";
  }

  async function enroll() {
    if (busy || references.length >= lab.TARGET_REFERENCE_COUNT) return;
    busy = true;
    result.hidden = true;
    setStatus("Sprich jetzt einmal klar „Nexi“.", "recording");
    updateControls();
    try {
      references.push(await recordFeatures());
      setStatus(
        references.length >= lab.TARGET_REFERENCE_COUNT
          ? "Kalibrierung abgeschlossen. Du kannst das Aktivierungswort jetzt testen."
          : "Referenz erkannt. Nimm dieselbe Phrase noch einmal auf.",
        references.length >= lab.TARGET_REFERENCE_COUNT ? "ready" : "idle",
      );
    } catch (error) {
      setStatus(explainError(error), "error");
    } finally {
      busy = false;
      updateControls();
    }
  }

  async function testWakeWord() {
    if (busy || references.length < lab.TARGET_REFERENCE_COUNT) return;
    busy = true;
    result.hidden = true;
    setStatus("Sprich jetzt „Nexi“ – oder bewusst ein anderes Wort für einen Negativtest.", "recording");
    updateControls();
    try {
      const evaluation = lab.evaluateCandidate(references, await recordFeatures());
      result.hidden = false;
      result.className = evaluation.detected ? "wake-result detected" : "wake-result rejected";
      result.innerHTML = evaluation.detected
        ? `<strong>Nexi erkannt</strong><span>Lokales Befehlsfenster geöffnet · kalibrierte Übereinstimmung ${evaluation.confidence}%</span>`
        : `<strong>Nicht aktiviert</strong><span>Die Aufnahme war der Referenz nicht ähnlich genug · kalibrierte Übereinstimmung ${evaluation.confidence}%</span>`;
      setStatus(
        evaluation.detected
          ? "Aktivierung erkannt. Nach drei Sekunden endet das Test-Befehlsfenster automatisch."
          : "Keine Aktivierung. Du kannst direkt noch einmal testen.",
        evaluation.detected ? "detected" : "rejected",
      );
      if (evaluation.detected) {
        setTimeout(() => {
          if (!busy) setStatus("Befehlsfenster beendet. Bereit für den nächsten Test.", "ready");
        }, 3000);
      }
    } catch (error) {
      setStatus(explainError(error), "error");
    } finally {
      busy = false;
      updateControls();
    }
  }

  enrollButton.addEventListener("click", enroll);
  testButton.addEventListener("click", testWakeWord);
  resetButton.addEventListener("click", () => {
    references.splice(0, references.length);
    result.hidden = true;
    setStatus("Kalibrierung gelöscht. Nimm drei neue Referenzen auf.");
    updateControls();
  });
  updateControls();
})();
