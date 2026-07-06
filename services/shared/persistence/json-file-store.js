const fs = require("node:fs");
const path = require("node:path");

class JsonFileStore {
  constructor(filePath, options = {}) {
    this.filePath = filePath;
    this.defaultState = options.defaultState || {};
  }

  load() {
    if (!fs.existsSync(this.filePath)) return structuredCloneSafe(this.defaultState);
    const content = fs.readFileSync(this.filePath, "utf8");
    if (!content.trim()) return structuredCloneSafe(this.defaultState);
    return JSON.parse(content);
  }

  save(state) {
    fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
    const tempPath = `${this.filePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
    fs.renameSync(tempPath, this.filePath);
    return state;
  }

  update(mutator) {
    const current = this.load();
    const next = mutator(current);
    return this.save(next);
  }
}

function structuredCloneSafe(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = { JsonFileStore };
