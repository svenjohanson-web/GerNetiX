class HardwareShopError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = "HardwareShopError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

module.exports = { HardwareShopError };
