class BuildDeployError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = "BuildDeployError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

module.exports = { BuildDeployError };
