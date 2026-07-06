class InMemoryDeviceManagementRepository {
  constructor(seed = {}) {
    this.devices = new Map((seed.devices || []).map((item) => [item.device_id, clone(item)]));
    this.credentials = new Map((seed.credentials || []).map((item) => [item.device_id, clone(item)]));
    this.challenges = new Map((seed.challenges || []).map((item) => [item.challenge_id, clone(item)]));
    this.pairingSessions = new Map((seed.pairingSessions || []).map((item) => [item.pairing_session_id, clone(item)]));
    this.accountDevices = groupedMap(seed.accountDevices || [], "account_id");
    this.purchaseContexts = groupedMap(seed.purchaseContexts || [], "account_id");
    this.consents = new Map((seed.consents || []).map((item) => [item.consent_id, clone(item)]));
    this.auditEvents = (seed.auditEvents || []).map(clone);
  }

  saveDevice(device) {
    this.devices.set(device.device_id, clone(device));
    return clone(device);
  }

  findDevice(deviceId) {
    return clone(this.devices.get(deviceId));
  }

  listDevices(filter = {}) {
    return Array.from(this.devices.values())
      .filter((device) => !filter.authenticity_status || device.authenticity_status === filter.authenticity_status)
      .map(clone);
  }

  saveCredential(deviceId, credential) {
    this.credentials.set(deviceId, clone(credential));
    return clone(credential);
  }

  findCredential(deviceId) {
    return clone(this.credentials.get(deviceId));
  }

  saveChallenge(challenge) {
    this.challenges.set(challenge.challenge_id, clone(challenge));
    return clone(challenge);
  }

  findChallenge(challengeId) {
    return clone(this.challenges.get(challengeId));
  }

  markChallengeUsed(challengeId) {
    const challenge = this.challenges.get(challengeId);
    if (challenge) {
      challenge.used_at = new Date().toISOString();
      this.challenges.set(challengeId, clone(challenge));
    }
  }

  savePairingSession(session) {
    this.pairingSessions.set(session.pairing_session_id, clone(session));
    return clone(session);
  }

  findPairingSession(sessionId) {
    return clone(this.pairingSessions.get(sessionId));
  }

  saveAccountDevice(accountDevice) {
    const items = this.accountDevices.get(accountDevice.account_id) || [];
    const next = items.filter((item) => item.account_device_id !== accountDevice.account_device_id);
    next.push(clone(accountDevice));
    this.accountDevices.set(accountDevice.account_id, next);
    return clone(accountDevice);
  }

  listAccountDevices(accountId) {
    return (this.accountDevices.get(accountId) || []).map(clone);
  }

  findAccountDevice(accountId, accountDeviceId) {
    return clone((this.accountDevices.get(accountId) || []).find((item) => item.account_device_id === accountDeviceId));
  }

  savePurchaseContext(accountId, purchaseContext) {
    const items = this.purchaseContexts.get(accountId) || [];
    const next = items.filter((item) => item.purchase_context_id !== purchaseContext.purchase_context_id);
    next.push(clone(purchaseContext));
    this.purchaseContexts.set(accountId, next);
    return clone(purchaseContext);
  }

  listPurchaseContexts(accountId) {
    return (this.purchaseContexts.get(accountId) || []).map(clone);
  }

  findPurchaseContext(accountId, purchaseContextId) {
    return clone((this.purchaseContexts.get(accountId) || []).find((item) => item.purchase_context_id === purchaseContextId));
  }

  createConsent(consent) {
    this.consents.set(consent.consent_id, clone(consent));
    return clone(consent);
  }

  findConsent(consentId) {
    return clone(this.consents.get(consentId));
  }

  revokeConsent(consentId) {
    const consent = this.consents.get(consentId);
    if (!consent) return null;
    consent.revoked_at = new Date().toISOString();
    this.consents.set(consentId, clone(consent));
    return clone(consent);
  }

  findValidConsent({ accountId, role, purpose, at = new Date() }) {
    for (const consent of this.consents.values()) {
      if (consent.account_id !== accountId) continue;
      if (consent.granted_to_role !== role && consent.granted_to_role !== "any_internal_role") continue;
      if (consent.purpose !== purpose) continue;
      if (consent.revoked_at) continue;
      if (new Date(consent.valid_from).getTime() > at.getTime()) continue;
      if (new Date(consent.valid_until).getTime() <= at.getTime()) continue;
      return clone(consent);
    }
    return null;
  }

  addAuditEvent(event) {
    const auditEvent = {
      audit_event_id: event.audit_event_id,
      occurred_at: new Date().toISOString(),
      ...event,
    };
    this.auditEvents.push(clone(auditEvent));
    return clone(auditEvent);
  }

  listAuditEvents(filter = {}) {
    return this.auditEvents
      .filter((event) => !filter.account_id || event.account_id === filter.account_id)
      .map(clone);
  }
}

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

function groupedMap(items, groupField) {
  const map = new Map();
  for (const item of items) {
    const key = item[groupField];
    const current = map.get(key) || [];
    current.push(clone(item));
    map.set(key, current);
  }
  return map;
}

module.exports = { InMemoryDeviceManagementRepository };
