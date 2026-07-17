class PublicDemoError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = "PublicDemoError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

module.exports = { PublicDemoError };
