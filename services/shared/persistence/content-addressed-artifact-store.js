"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

class ContentAddressedArtifactStore {
  constructor(root) {
    if (!root) throw new Error("Artifact-Store-Verzeichnis fehlt.");
    this.root = path.resolve(root);
  }

  async put(content, sourceReference) {
    const payload = Buffer.isBuffer(content) ? content : Buffer.from(content || "");
    const source = normalizeSourceReference(sourceReference);
    const sha256 = crypto.createHash("sha256").update(payload).digest("hex");
    const objectKey = `objects/${sha256.slice(0, 2)}/${sha256}`;
    const target = this.resolve(objectKey);
    await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
    try {
      await fs.writeFile(target, payload, { flag: "wx", mode: 0o600 });
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      const existing = await fs.readFile(target);
      if (existing.length !== payload.length || crypto.createHash("sha256").update(existing).digest("hex") !== sha256) {
        throw new Error("Artifact-Store-Objekt stimmt nicht mit seinem Content-Hash überein.");
      }
    }
    return { object_key: objectKey, sha256, size_bytes: payload.length, source_path: source.sourcePath, source_version: source.sourceVersion };
  }

  async get(reference) {
    const objectKey = String(reference?.object_key || "");
    const expectedSha = String(reference?.object_sha256 || reference?.sha256 || "").toLowerCase();
    const content = await fs.readFile(this.resolve(objectKey));
    const actualSha = crypto.createHash("sha256").update(content).digest("hex");
    if (!/^[a-f0-9]{64}$/.test(expectedSha) || actualSha !== expectedSha) throw new Error("Artifact-Store-Integritätsprüfung fehlgeschlagen.");
    return content;
  }

  resolve(objectKey) {
    if (!/^objects\/[a-f0-9]{2}\/[a-f0-9]{64}$/.test(objectKey)) throw new Error("Ungültiger Artifact-Store-Objektschlüssel.");
    return path.join(this.root, ...objectKey.split("/"));
  }
}

function normalizeSourceReference(value) {
  const sourcePath = String(value?.source_path || value?.sourcePath || "").trim();
  const sourceVersion = String(value?.source_version || value?.sourceVersion || "").trim().toLowerCase();
  if (!sourcePath || sourcePath.length > 1024 || !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/.test(sourceVersion)) {
    throw new Error("Artifact braucht Quellpfad und unveränderliche Quellversion.");
  }
  return { sourcePath, sourceVersion };
}

module.exports = { ContentAddressedArtifactStore, normalizeSourceReference };
