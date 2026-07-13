const fs = require("node:fs/promises");
const path = require("node:path");
const { BuildDeployError } = require("../errors");

class BuildPackageStore {
  constructor(options) {
    this.tempDir = options.tempDir;
    this.incrementalCacheDir = options.incrementalCacheDir;
  }

  async materialize(job) {
    const files = job.build_package && job.build_package.files;
    if (!files || typeof files !== "object" || Array.isArray(files)) {
      throw new BuildDeployError(
        "invalid_build_package",
        "BuildPackage muss als build_package.files Objekt uebergeben werden.",
      );
    }

    const persistentCacheDir = this.incrementalProjectCacheDir(job);
    const jobDir = persistentCacheDir || path.join(this.tempDir, sanitizeName(job.job_id));
    const packageDir = persistentCacheDir ? path.join(jobDir, "workspace") : path.join(jobDir, "build-package");
    if (!persistentCacheDir) await fs.rm(jobDir, { recursive: true, force: true });
    await fs.mkdir(packageDir, { recursive: true });

    try {
      const expectedPaths = new Set();
      for (const [relativePath, content] of Object.entries(files)) {
        const targetPath = resolveInside(packageDir, relativePath);
        expectedPaths.add(path.relative(packageDir, targetPath));
      }
      await removeStalePackageFiles(packageDir, expectedPaths);
      for (const [relativePath, content] of Object.entries(files)) {
        const targetPath = resolveInside(packageDir, relativePath);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await writeFileIfChanged(targetPath, normalizeContent(content));
      }
    } catch (error) {
      if (!persistentCacheDir) await this.cleanup({ jobDir, persistent: false });
      throw error;
    }

    return { jobDir, packageDir, persistent: Boolean(persistentCacheDir) };
  }

  async preserveIncrementalCache(job, packageDir) {
    if (job.project_id) return;
    const cacheDir = this.incrementalProjectCacheDir(job);
    if (!cacheDir) return;
    const platformioBuildDir = path.join(packageDir, ".pio");
    try {
      await fs.access(platformioBuildDir);
    } catch {
      return;
    }
    const nextCacheDir = `${cacheDir}.next`;
    await fs.rm(nextCacheDir, { recursive: true, force: true });
    await fs.mkdir(path.dirname(cacheDir), { recursive: true });
    await fs.cp(platformioBuildDir, nextCacheDir, { recursive: true });
    await fs.rm(cacheDir, { recursive: true, force: true });
    await fs.rename(nextCacheDir, cacheDir);
  }

  incrementalProjectCacheDir(job) {
    if (!this.incrementalCacheDir || !job.project_id) return null;
    const targetKey = `${job.project_id}--${job.device_id || "default"}`;
    return path.join(this.incrementalCacheDir, sanitizeName(targetKey));
  }

  async cleanup(workspace) {
    const normalized = typeof workspace === "string" ? { jobDir: workspace, persistent: false } : workspace;
    if (!normalized?.persistent) await fs.rm(normalized.jobDir, { recursive: true, force: true });
  }
}

async function writeFileIfChanged(filePath, content) {
  try {
    const current = await fs.readFile(filePath);
    const next = Buffer.isBuffer(content) ? content : Buffer.from(content);
    if (current.equals(next)) return false;
  } catch {
    // Missing files are written below.
  }
  await fs.writeFile(filePath, content);
  return true;
}

async function removeStalePackageFiles(packageDir, expectedPaths) {
  const existing = await listFiles(packageDir, { skipPlatformio: true });
  await Promise.all(existing
    .filter((relativePath) => !expectedPaths.has(relativePath))
    .map((relativePath) => fs.rm(path.join(packageDir, relativePath), { force: true })));
}

async function listFiles(rootDir, options = {}) {
  const result = [];
  await walkFiles(rootDir, rootDir, result, options);
  return result;
}

async function walkFiles(rootDir, currentDir, result, options) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (options.skipPlatformio && currentDir === rootDir && entry.name === ".pio") continue;
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) await walkFiles(rootDir, fullPath, result, options);
    else result.push(path.relative(rootDir, fullPath));
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
