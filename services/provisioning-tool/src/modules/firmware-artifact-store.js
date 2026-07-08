const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { SqliteStateStore, jsonColumn } = require("../../../shared");
const { ProvisioningError } = require("../errors");

class FirmwareArtifactStore {
  constructor(options = {}) {
    this.runtimeRoot = options.runtimeRoot || path.join(__dirname, "..", ".runtime");
    this.stateStore = options.stateStore || null;
    this.stateStore?.ensureSchema?.(firmwareArtifactSchema());
    const loaded = this.stateStore ? this.stateStore.load().artifacts || [] : [];
    this.artifacts = new Map([...(options.artifacts || []), ...loaded].map((artifact) => [artifact.artifact_id, normalizeArtifact(artifact)]));
  }

  static sqlite(sqlitePath, runtimeRoot) {
    return new FirmwareArtifactStore({
      runtimeRoot,
      stateStore: new SqliteStateStore(sqlitePath, "provisioning-firmware-artifacts", {
        defaultState: { artifacts: [] },
        collectionMap: { artifacts: "artifacts" },
      }),
    });
  }

  listArtifacts() {
    return Array.from(this.artifacts.values()).map(redactArtifact);
  }

  getArtifact(artifactId) {
    const artifact = this.artifacts.get(artifactId);
    return artifact ? redactArtifact(artifact) : null;
  }

  upsertArtifact(input = {}) {
    const artifactId = required(input.artifact_id || input.id, "artifact_id");
    const artifact = normalizeArtifact({
      artifact_id: artifactId,
      title: input.title || artifactId,
      version: input.version || "latest",
      source: input.source || "sqlite",
      uri: input.uri || `sqlite://provisioning_firmware_artifacts/${artifactId}`,
      file_name: input.file_name || "firmware.bin",
      content_base64: input.content_base64 || "",
      local_file_path: input.local_file_path || "",
      sha256: input.sha256 || "",
      flash_strategy: input.flash_strategy || "esp32_merged_bin",
      flash_offset: input.flash_offset || "0x0",
      created_at: input.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    if (!artifact.content_base64 && !artifact.local_file_path) {
      throw new ProvisioningError("firmware_artifact_missing_content", "Firmware-Artefakt braucht content_base64 oder local_file_path.", 400);
    }
    const bytes = artifact.content_base64
      ? Buffer.from(artifact.content_base64, "base64")
      : fs.readFileSync(path.resolve(artifact.local_file_path));
    artifact.size_bytes = bytes.length;
    artifact.sha256 = artifact.sha256 || sha256(bytes);
    this.artifacts.set(artifact.artifact_id, artifact);
    this.persist();
    return redactArtifact(artifact);
  }

  materialize(artifactRef = {}) {
    const artifactId = required(artifactRef.artifact_id, "artifact_id");
    const artifact = this.artifacts.get(artifactId);
    if (!artifact) {
      throw new ProvisioningError(
        "firmware_artifact_not_found",
        "Factory-Firmware-Artefakt wurde nicht im Provisioning Artifact Store gefunden.",
        409,
        { artifact_id: artifactId, uri: artifactRef.uri || "" },
      );
    }
    const bytes = artifact.content_base64
      ? Buffer.from(artifact.content_base64, "base64")
      : fs.readFileSync(path.resolve(artifact.local_file_path));
    const actualHash = sha256(bytes);
    if (artifact.sha256 && artifact.sha256 !== actualHash) {
      throw new ProvisioningError("firmware_artifact_hash_mismatch", "Firmware-Artefakt SHA-256 passt nicht.", 409, {
        artifact_id: artifactId,
        expected_sha256: artifact.sha256,
        actual_sha256: actualHash,
      });
    }
    const stagingDir = path.join(this.runtimeRoot, "firmware-artifacts", safeName(artifactId));
    fs.mkdirSync(stagingDir, { recursive: true });
    const filePath = path.join(stagingDir, safeName(artifact.file_name || "firmware.bin"));
    fs.writeFileSync(filePath, bytes);
    return {
      ...redactArtifact(artifact),
      local_staging_path: stagingDir,
      materialized_file_path: filePath,
      materialized_at: new Date().toISOString(),
    };
  }

  persist() {
    if (!this.stateStore) return;
    const artifacts = Array.from(this.artifacts.values());
    this.stateStore.save({ artifacts });
    this.stateStore.replaceCollection?.("artifacts", artifacts, "artifact_id");
    this.stateStore.replaceTable?.("provisioning_firmware_artifacts", artifacts, artifactColumns());
  }
}

function firmwareArtifactSchema() {
  return [
    `CREATE TABLE IF NOT EXISTS provisioning_firmware_artifacts (
      artifact_id TEXT PRIMARY KEY,
      title TEXT,
      version TEXT,
      source TEXT,
      uri TEXT,
      file_name TEXT,
      sha256 TEXT,
      size_bytes INTEGER,
      flash_strategy TEXT,
      flash_offset TEXT,
      created_at TEXT,
      updated_at TEXT,
      raw_json TEXT NOT NULL
    );`,
  ];
}

function artifactColumns() {
  return {
    artifact_id: "artifact_id",
    title: "title",
    version: "version",
    source: "source",
    uri: "uri",
    file_name: "file_name",
    sha256: "sha256",
    size_bytes: "size_bytes",
    flash_strategy: "flash_strategy",
    flash_offset: "flash_offset",
    created_at: "created_at",
    updated_at: "updated_at",
    raw_json: jsonColumn((row) => row),
  };
}

function normalizeArtifact(input = {}) {
  return {
    artifact_id: input.artifact_id || "",
    title: input.title || input.artifact_id || "",
    version: input.version || "latest",
    source: input.source || "sqlite",
    uri: input.uri || "",
    file_name: input.file_name || "firmware.bin",
    content_base64: input.content_base64 || "",
    local_file_path: input.local_file_path || "",
    sha256: input.sha256 || "",
    size_bytes: Number(input.size_bytes || 0),
    flash_strategy: input.flash_strategy || "esp32_merged_bin",
    flash_offset: input.flash_offset || "0x0",
    created_at: input.created_at || "",
    updated_at: input.updated_at || "",
  };
}

function redactArtifact(artifact) {
  return {
    artifact_id: artifact.artifact_id,
    title: artifact.title,
    version: artifact.version,
    source: artifact.source,
    uri: artifact.uri,
    file_name: artifact.file_name,
    sha256: artifact.sha256,
    size_bytes: artifact.size_bytes,
    flash_strategy: artifact.flash_strategy,
    flash_offset: artifact.flash_offset,
    local_staging_path: artifact.local_staging_path || "",
    materialized_file_path: artifact.materialized_file_path || "",
  };
}

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new ProvisioningError("missing_required_field", `Pflichtfeld fehlt: ${field}`);
  return normalized;
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function safeName(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_.-]/g, "_");
}

module.exports = { FirmwareArtifactStore };
