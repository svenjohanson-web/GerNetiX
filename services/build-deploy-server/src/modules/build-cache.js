const fs = require("node:fs/promises");

class BuildCache {
  constructor(options) {
    this.cacheDir = options.cacheDir;
  }

  async ensureReady() {
    if (!this.cacheDir) return { cache_dir: "platformio-default" };
    await fs.mkdir(this.cacheDir, { recursive: true });
    return { cache_dir: this.cacheDir };
  }
}

module.exports = { BuildCache };
