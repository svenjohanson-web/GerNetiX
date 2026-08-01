const UsbFlashTargetModel = (() => {
  function selectionMode(firmwareCount, portCount) {
    const firmwares = Math.max(0, Number(firmwareCount) || 0);
    const ports = Math.max(0, Number(portCount) || 0);
    if (!firmwares) return "no-firmware";
    if (!ports) return "no-port";
    if (firmwares === 1 && ports === 1) return "single-port";
    if (firmwares === 1) return "single-device-port-conflict";
    return "firmware-port-mapping";
  }

  function selectedAssignments(firmwareIds, portIds, assignments = {}) {
    const knownPorts = new Set((portIds || []).map(String));
    const selected = (firmwareIds || []).flatMap((firmwareId) => {
      const port = String(assignments[String(firmwareId)] || "");
      return port && knownPorts.has(port) ? [{ firmwareId: String(firmwareId), port }] : [];
    });
    if (new Set(selected.map((assignment) => assignment.port)).size !== selected.length) return [];
    return selected;
  }

  return Object.freeze({ selectionMode, selectedAssignments });
})();

globalThis.UsbFlashTargetModel = UsbFlashTargetModel;
if (typeof module !== "undefined") module.exports = UsbFlashTargetModel;
