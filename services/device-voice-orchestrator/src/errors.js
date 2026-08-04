class DeviceVoiceError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = "DeviceVoiceError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

module.exports = { DeviceVoiceError };
