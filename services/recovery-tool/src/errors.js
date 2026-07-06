class RecoveryToolError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = "RecoveryToolError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

module.exports = { RecoveryToolError };
