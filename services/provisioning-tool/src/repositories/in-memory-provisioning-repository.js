class InMemoryProvisioningRepository {
  constructor(seed = {}) {
    this.sessions = new Map((seed.sessions || []).map((item) => [item.session_id, clone(item)]));
    this.activeCredentialByDevice = new Map(seed.activeCredentialByDevice || []);
    for (const session of this.sessions.values()) {
      if (session.credential && session.device) {
        this.activeCredentialByDevice.set(session.device.device_id, session.credential.credential_id);
      }
    }
  }

  hasActiveCredential(deviceId) {
    return this.activeCredentialByDevice.has(deviceId);
  }

  clearActiveCredential(deviceId) {
    const credentialId = this.activeCredentialByDevice.get(deviceId) || null;
    this.activeCredentialByDevice.delete(deviceId);
    return credentialId;
  }

  findSessionsByDevice(deviceId) {
    return Array.from(this.sessions.values())
      .filter((session) => session.device?.device_id === deviceId)
      .map(clone);
  }

  saveSession(session) {
    this.sessions.set(session.session_id, clone(session));
    this.activeCredentialByDevice.set(session.device.device_id, session.credential.credential_id);
    return clone(session);
  }

  updateSession(sessionId, patch) {
    const current = this.sessions.get(sessionId);
    if (!current) return null;
    const next = { ...current, ...patch };
    this.sessions.set(sessionId, clone(next));
    return clone(next);
  }

  findSession(sessionId) {
    return clone(this.sessions.get(sessionId));
  }
}

function clone(value) {
  return value ? JSON.parse(JSON.stringify(value)) : null;
}

module.exports = { InMemoryProvisioningRepository };
