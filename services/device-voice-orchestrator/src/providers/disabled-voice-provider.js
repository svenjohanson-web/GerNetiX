const { DeviceVoiceError } = require("../errors");

class DisabledVoiceProvider {
  isAvailable() {
    return false;
  }

  async process() {
    throw new DeviceVoiceError(
      "voice_provider_disabled",
      "Der GerNetiX Voice-Provider ist nicht konfiguriert.",
      503,
    );
  }
}

module.exports = { DisabledVoiceProvider };
