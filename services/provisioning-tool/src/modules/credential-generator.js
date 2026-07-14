const crypto = require("node:crypto");

class CredentialGenerator {
  createCredential(deviceId) {
    const credentialId = createId("cred");
    const keyReference = `device-key://${deviceId}/${credentialId}`;

    return {
      credential_id: credentialId,
      credential_type: "ECDSA_P256_X509",
      algorithm: "ECDSA_P256_SHA256",
      key_reference: keyReference,
      status: "active",
      created_at: new Date().toISOString(),
    };
  }
}

function createId(prefix) {
  return `${prefix}_${crypto.randomUUID()}`;
}

module.exports = { CredentialGenerator };
