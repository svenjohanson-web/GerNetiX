"use strict";

class ArtifactRetentionScheduler {
  constructor(options = {}) {
    this.artifactStore = options.artifactStore;
    this.intervalMs = Number(options.intervalMs || 60 * 60 * 1000);
    this.onError = options.onError || (() => {});
    if (!this.artifactStore || typeof this.artifactStore.pruneExpired !== "function") {
      throw new TypeError("Retention-Scheduler braucht einen Artifact Store mit pruneExpired().");
    }
    if (!Number.isSafeInteger(this.intervalMs) || this.intervalMs < 1000) {
      throw new TypeError("Retention-Intervall muss mindestens 1000 ms betragen.");
    }
  }

  async runOnce() { return this.artifactStore.pruneExpired(); }

  start() {
    if (this.timer) return this;
    this.timer = setInterval(() => this.runOnce().catch(this.onError), this.intervalMs);
    this.timer.unref?.();
    return this;
  }

  close() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

module.exports = { ArtifactRetentionScheduler };
