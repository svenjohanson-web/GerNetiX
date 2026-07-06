class AdminToolError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = "AdminToolError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

module.exports = { AdminToolError };
