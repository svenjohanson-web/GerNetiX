class BuildTargetLock {
  constructor() {
    this.tails = new Map();
  }

  async runExclusive(job, task, onWait) {
    const key = buildTargetKey(job);
    if (!key) return task();

    const previous = this.tails.get(key) || Promise.resolve();
    let release;
    const current = new Promise((resolve) => { release = resolve; });
    const tail = previous.then(() => current);
    const waiting = this.tails.has(key);
    this.tails.set(key, tail);
    if (waiting && typeof onWait === "function") onWait(key);

    await previous;
    try {
      return await task();
    } finally {
      release();
      if (this.tails.get(key) === tail) this.tails.delete(key);
    }
  }
}

function buildTargetKey(job = {}) {
  const projectId = String(job.project_id || "").trim();
  if (!projectId) return "";
  const softwareUnitId = String(job.software_unit_id || buildPackageSoftwareUnitId(job.build_package) || "default").trim();
  const deviceId = String(job.device_id || "default").trim();
  return [projectId, softwareUnitId, deviceId].join("--");
}

function buildPackageSoftwareUnitId(buildPackage) {
  const raw = buildPackage?.files?.["build-job.json"];
  if (typeof raw !== "string") return "";
  try {
    return String(JSON.parse(raw)?.software_unit_id || "").trim();
  } catch {
    return "";
  }
}

module.exports = { BuildTargetLock, buildTargetKey };
