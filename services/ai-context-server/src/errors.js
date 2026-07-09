class AiContextError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = "AiContextError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

module.exports = { AiContextError };
