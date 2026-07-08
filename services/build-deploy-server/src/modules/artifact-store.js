const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const path = require("node:path");

class ArtifactStore {
  constructor(options) {
    this.artifactDir = options.artifactDir;
    this.publicBaseUrl = options.publicBaseUrl || "";
  }

  async saveBuildArtifacts(jobId, buildOutput) {
    const targetDir = path.join(this.artifactDir, sanitizeName(jobId));
    await fs.rm(targetDir, { recursive: true, force: true });
    await fs.mkdir(targetDir, { recursive: true });

    const artifacts = {};
    for (const artifactName of Object.keys(buildOutput.artifacts).sort()) {
      const sourcePath = buildOutput.artifacts[artifactName];
      if (!sourcePath) continue;
      const targetPath = path.join(targetDir, artifactName);
      await fs.copyFile(sourcePath, targetPath);
      const metadata = await describeFile(targetPath);
      artifacts[artifactName] = {
        file_name: artifactName,
        path: targetPath,
        size_bytes: metadata.size_bytes,
        sha256: metadata.sha256,
        download_url: this.publicBaseUrl
          ? `${this.publicBaseUrl.replace(/\/$/, "")}/artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(artifactName)}`
          : `/artifacts/${encodeURIComponent(jobId)}/${encodeURIComponent(artifactName)}`,
      };
    }

    return artifacts;
  }
}

async function describeFile(filePath) {
  const content = await fs.readFile(filePath);
  return {
    size_bytes: content.length,
    sha256: crypto.createHash("sha256").update(content).digest("hex"),
  };
}

function sanitizeName(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_.-]/g, "_");
}

module.exports = { ArtifactStore, describeFile };
