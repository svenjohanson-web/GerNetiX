class FlashPlanner {
  constructor(options = {}) {
    this.flashRunner = options.flashRunner || "mock";
  }

  createPlan(input, manifest) {
    const requested = Boolean(input.flash && input.flash.requested);
    if (!requested) {
      return {
        requested: false,
        status: "not_requested",
        runner: this.flashRunner,
        recovery_hint: "Kein USB-Flash angefordert.",
      };
    }

    return {
      requested: true,
      status: "planned",
      runner: this.flashRunner,
      port: input.flash.port || null,
      firmware_version: manifest.firmware.version,
      steps: [
        "Board per USB identifizieren",
        "Initial-Firmware mit GerNetiX-Basissoftware flashen",
        "Provisioning-Manifest in geschuetzte Konfiguration schreiben",
        "Boot, Heartbeat und OTA-Basis pruefen",
      ],
      recovery_hint: "Bei Flash-Abbruch Recovery Tool verwenden; Board darf nicht als supportberechtigt abgeschlossen werden.",
    };
  }
}

module.exports = { FlashPlanner };
