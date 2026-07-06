class DeviceManagementError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = "DeviceManagementError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

module.exports = { DeviceManagementError };
