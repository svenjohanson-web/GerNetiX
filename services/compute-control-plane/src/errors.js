"use strict";

class ComputeError extends Error {
  constructor(code, message, status = 400, details = {}) {
    super(message);
    this.name = "ComputeError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

module.exports = { ComputeError };
