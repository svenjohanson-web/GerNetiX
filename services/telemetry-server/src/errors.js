class TelemetryError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = "TelemetryError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

module.exports = { TelemetryError };
