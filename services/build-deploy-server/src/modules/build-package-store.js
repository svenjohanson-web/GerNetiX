const fs = require("node:fs/promises");
const path = require("node:path");
const { BuildDeployError } = require("../errors");

class BuildPackageStore {
  constructor(options) {
    this.tempDir = options.tempDir;
  }

  async materialize(job) {
    const files = job.build_package && job.build_package.files;
    if (!files || typeof files !== "object" || Array.isArray(files)) {
      throw new BuildDeployError(
        "invalid_build_package",
        "BuildPackage muss als build_package.files Objekt uebergeben werden.",
      );
    }

    const jobDir = path.join(this.tempDir, sanitizeName(job.job_id));
    const packageDir = path.join(jobDir, "build-package");
    await fs.rm(jobDir, { recursive: true, force: true });
    await fs.mkdir(packageDir, { recursive: true });

    try {
      for (const [relativePath, content] of Object.entries(files)) {
        const targetPath = resolveInside(packageDir, relativePath);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.writeFile(targetPath, normalizeContent(content));
      }
    } catch (error) {
      await this.cleanup(jobDir);
      throw error;
    }

    return { jobDir, packageDir };
  }

  async cleanup(jobDir) {
    await fs.rm(jobDir, { recursive: true, force: true });
  }
}

function resolveInside(rootDir, relativePath) {
  const normalized = path.normalize(String(relativePath || ""));
  if (!normalized || normalized.startsWith("..") || path.isAbsolute(normalized)) {
    throw new BuildDeployError("unsafe_build_package_path", "BuildPackage enthaelt einen ungueltigen Dateipfad.");
  }

  const targetPath = path.join(rootDir, normalized);
  if (!targetPath.startsWith(rootDir)) {
    throw new BuildDeployError("unsafe_build_package_path", "BuildPackage enthaelt einen Pfad ausserhalb des Workspaces.");
  }
  return targetPath;
}

function normalizeContent(content) {
  if (typeof content === "string") return content;
  if (content && typeof content.base64 === "string") return Buffer.from(content.base64, "base64");
  return JSON.stringify(content, null, 2);
}

function sanitizeName(value) {
  return String(value || "").replace(/[^a-zA-Z0-9_.-]/g, "_");
}

module.exports = { BuildPackageStore };
