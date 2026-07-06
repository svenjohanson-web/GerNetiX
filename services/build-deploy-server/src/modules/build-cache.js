const fs = require("node:fs/promises");

class BuildCache {
  constructor(options) {
    this.cacheDir = options.cacheDir;
  }

  async ensureReady() {
    await fs.mkdir(this.cacheDir, { recursive: true });
    return { cache_dir: this.cacheDir };
  }
}

module.exports = { BuildCache };
