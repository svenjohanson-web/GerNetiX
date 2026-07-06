const crypto = require("node:crypto");

class CredentialGenerator {
  createCredential(deviceId) {
    const secret = crypto.randomBytes(32).toString("base64url");
    const credentialId = createId("cred");
    const keyReference = `device-key://${deviceId}/${credentialId}`;
    const secretHash = crypto.createHash("sha256").update(secret).digest("hex");

    return {
      credential_id: credentialId,
      credential_type: "HMAC_SHA256",
      key_reference: keyReference,
      one_time_device_secret: secret,
      secret_sha256: secretHash,
      status: "active",
      created_at: new Date().toISOString(),
    };
  }
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

module.exports = { CredentialGenerator };
