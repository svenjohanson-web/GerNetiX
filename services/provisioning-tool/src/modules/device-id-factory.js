const crypto = require("node:crypto");

class DeviceIdFactory {
  createDeviceId(serialNumber) {
    const normalized = String(serialNumber || "").trim().toUpperCase();
    const digest = crypto.createHash("sha256").update(normalized).digest("hex").slice(0, 16);
    return `device_${digest}`;
  }
}

module.exports = { DeviceIdFactory };
