const GerNetiXUsbPortDisconnectDetector = (() => {
  function create({ listPorts, pathOf, labelOf, onPorts = () => {}, onState = () => {}, intervalMs = 700, timeoutMs = 45_000 }) {
    let run = null;

    function active() {
      return Boolean(run?.active);
    }

    function stop() {
      if (run?.timer) clearTimeout(run.timer);
      if (run) run.active = false;
      run = null;
    }

    async function poll() {
      const currentRun = run;
      if (!currentRun?.active) return;
      if (Date.now() >= currentRun.deadline) {
        onState({ type: "error", message: "Es wurde innerhalb von 45 Sekunden kein eindeutiger Portwechsel erkannt. Ziehe genau ein Board ab und versuche es erneut.", context: currentRun.context });
        stop();
        return;
      }
      try {
        const ports = await listPorts();
        if (run !== currentRun || !currentRun.active) return;
        onPorts(ports);
        const paths = new Set(ports.map(pathOf).filter(Boolean));
        if (!currentRun.removedPath) {
          const removed = [...currentRun.baselinePaths].filter((path) => !paths.has(path));
          if (removed.length > 1) {
            onState({ type: "error", message: "Mehrere Ports sind gleichzeitig verschwunden. Stecke die Boards wieder ein und starte die Erkennung erneut.", context: currentRun.context });
            stop();
            return;
          }
          if (removed.length === 1) {
            currentRun.removedPath = removed[0];
            currentRun.remainingPaths = new Set(paths);
            onState({
              type: "removed",
              path: removed[0],
              label: currentRun.labels.get(removed[0]) || removed[0],
              context: currentRun.context,
            });
          }
        } else {
          const returnedPath = paths.has(currentRun.removedPath)
            ? currentRun.removedPath
            : [...paths].find((path) => !currentRun.remainingPaths.has(path));
          if (returnedPath) {
            onState({ type: "identified", path: returnedPath, context: currentRun.context });
            stop();
            return;
          }
        }
      } catch (error) {
        if (run !== currentRun) return;
        onState({ type: "error", message: error?.message || "Die USB-Portliste konnte nicht weiter beobachtet werden.", context: currentRun.context });
        stop();
        return;
      }
      if (run === currentRun && currentRun.active) currentRun.timer = setTimeout(poll, intervalMs);
    }

    function start(initialPorts, context = {}) {
      stop();
      if (!Array.isArray(initialPorts) || initialPorts.length < 2) return false;
      run = {
        active: true,
        baselinePaths: new Set(initialPorts.map(pathOf).filter(Boolean)),
        labels: new Map(initialPorts.map((port) => [pathOf(port), labelOf(port)])),
        removedPath: "",
        remainingPaths: new Set(),
        deadline: Date.now() + timeoutMs,
        timer: null,
        context,
      };
      onState({ type: "waiting", context });
      void poll();
      return true;
    }

    return { active, start, stop };
  }

  return { create };
})();

window.GerNetiXUsbPortDisconnectDetector = GerNetiXUsbPortDisconnectDetector;

export {
  GerNetiXUsbPortDisconnectDetector,
};

/* ---- Uebergangsbruecke ---- */
/*
 * Noch klassisch und liest diese Namen global: app-device-build-controller.js, device-wifi-setup-dialog.js.
 * Verschwindet mit dem letzten davon.
 */
Object.assign(globalThis, {
  GerNetiXUsbPortDisconnectDetector,
});
/* ---- /Uebergangsbruecke ---- */
