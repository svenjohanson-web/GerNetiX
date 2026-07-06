class DeviceJobLock {
  constructor() {
    this.activeByDevice = new Map();
    this.waitingByDevice = new Map();
  }

  canStart(job) {
    return !job.device_id || !this.activeByDevice.has(job.device_id);
  }

  markActive(job) {
    if (job.device_id) this.activeByDevice.set(job.device_id, job.job_id);
  }

  release(job) {
    if (job.device_id && this.activeByDevice.get(job.device_id) === job.job_id) {
      this.activeByDevice.delete(job.device_id);
    }
  }

  replaceWaiting(job) {
    if (!job.device_id) return null;
    const replaced = this.waitingByDevice.get(job.device_id) || null;
    this.waitingByDevice.set(job.device_id, job.job_id);
    return replaced;
  }

  takeWaiting(deviceId) {
    const jobId = this.waitingByDevice.get(deviceId);
    if (jobId) this.waitingByDevice.delete(deviceId);
    return jobId || null;
  }
}

module.exports = { DeviceJobLock };
