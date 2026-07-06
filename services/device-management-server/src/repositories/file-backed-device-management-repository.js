const path = require("node:path");
const { JsonFileStore } = require("../../../shared");
const { InMemoryDeviceManagementRepository } = require("./in-memory-device-management-repository");

class FileBackedDeviceManagementRepository extends InMemoryDeviceManagementRepository {
  constructor(store) {
    super(store.load());
    this.store = store;
  }

  static create(runtimeRoot) {
    return new FileBackedDeviceManagementRepository(new JsonFileStore(path.join(runtimeRoot, "device-management-state.json"), {
      defaultState: emptyState(),
    }));
  }

  saveDevice(device) {
    const result = super.saveDevice(device);
    this.persist();
    return result;
  }

  saveCredential(deviceId, credential) {
    const result = super.saveCredential(deviceId, credential);
    this.persist();
    return result;
  }

  saveChallenge(challenge) {
    const result = super.saveChallenge(challenge);
    this.persist();
    return result;
  }

  markChallengeUsed(challengeId) {
    super.markChallengeUsed(challengeId);
    this.persist();
  }

  savePairingSession(session) {
    const result = super.savePairingSession(session);
    this.persist();
    return result;
  }

  saveAccountDevice(accountDevice) {
    const result = super.saveAccountDevice(accountDevice);
    this.persist();
    return result;
  }

  savePurchaseContext(accountId, purchaseContext) {
    const result = super.savePurchaseContext(accountId, purchaseContext);
    this.persist();
    return result;
  }

  createConsent(consent) {
    const result = super.createConsent(consent);
    this.persist();
    return result;
  }

  revokeConsent(consentId) {
    const result = super.revokeConsent(consentId);
    this.persist();
    return result;
  }

  addAuditEvent(event) {
    const result = super.addAuditEvent(event);
    this.persist();
    return result;
  }

  persist() {
    this.store.save({
      devices: Array.from(this.devices.values()),
      credentials: Array.from(this.credentials.values()),
      challenges: Array.from(this.challenges.values()),
      pairingSessions: Array.from(this.pairingSessions.values()),
      accountDevices: Array.from(this.accountDevices.values()).flat(),
      purchaseContexts: Array.from(this.purchaseContexts.values()).flat(),
      consents: Array.from(this.consents.values()),
      auditEvents: this.auditEvents,
    });
  }
}

function emptyState() {
  return {
    devices: [],
    credentials: [],
    challenges: [],
    pairingSessions: [],
    accountDevices: [],
    purchaseContexts: [],
    consents: [],
    auditEvents: [],
  };
}

module.exports = { FileBackedDeviceManagementRepository };
