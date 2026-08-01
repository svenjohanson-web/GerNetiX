const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const { BuildDeployError } = require("../errors");
const { firmwareBuildPackageProblems } = require("../../../shared/firmware-project-contract");

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
    if (job.build_package.contract) {
      const contractProblems = firmwareBuildPackageProblems(job.build_package.contract, files);
      if (contractProblems.length) {
        throw new BuildDeployError(
          "invalid_firmware_build_package_contract",
          `BuildPackage verletzt den Firmware-Vertrag: ${contractProblems.join("; ")}`,
          422,
        );
      }
      if (job.software_unit_id && job.software_unit_id !== job.build_package.contract.software_unit_id) {
        throw new BuildDeployError(
          "firmware_build_target_mismatch",
          "BuildJob und BuildPackage verweisen auf unterschiedliche Software-Einheiten.",
          422,
        );
      }
    }

    const persistentCacheDir = this.incrementalProjectCacheDir(job);
    const jobDir = persistentCacheDir || path.join(this.tempDir, sanitizeName(job.job_id));
    const packageDir = persistentCacheDir ? path.join(jobDir, "workspace") : path.join(jobDir, "build-package");
    const buildDir = path.join(jobDir, "build-jobs", jobStorageKey(job.job_id));
    const packageManifestPath = path.join(jobDir, ".gernetix-package-files.json");
    const platformioConfigHashPath = path.join(jobDir, ".gernetix-platformio-config.sha256");
    if (!persistentCacheDir) await fs.rm(jobDir, { recursive: true, force: true });
    else await fs.rm(buildDir, { recursive: true, force: true });
    await fs.mkdir(packageDir, { recursive: true });

    try {
      const platformioConfigHash = persistentCacheDir
        ? await invalidatePlatformioCacheForChangedConfiguration(
          packageDir,
          platformioConfigHashPath,
          files["platformio.ini"],
        )
        : "";
      const expectedPaths = new Set();
      for (const [relativePath, content] of Object.entries(files)) {
        const targetPath = resolveInside(packageDir, relativePath);
        expectedPaths.add(path.relative(packageDir, targetPath));
      }
      const previousPackagePaths = await readPackageManifest(packageManifestPath);
      await removeStalePackageFiles(packageDir, expectedPaths, previousPackagePaths);
      for (const [relativePath, content] of Object.entries(files)) {
        const targetPath = resolveInside(packageDir, relativePath);
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await writeFileIfChanged(targetPath, normalizeContent(content));
      }
      await fs.writeFile(packageManifestPath, JSON.stringify(Array.from(expectedPaths).sort(), null, 2));
      await repairIncompleteEspIdfCache(packageDir);
      if (platformioConfigHash) await fs.writeFile(platformioConfigHashPath, `${platformioConfigHash}\n`);
    } catch (error) {
      if (!persistentCacheDir) await this.cleanup({ jobDir, persistent: false });
      throw error;
    }

    return { jobDir, packageDir, buildDir, persistent: Boolean(persistentCacheDir) };
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
    const softwareUnitId = job.software_unit_id || buildPackageSoftwareUnitId(job.build_package);
    const targetKey = [job.project_id, softwareUnitId, job.device_id || "default", `g${Number(job.cache_generation || 0)}`]
      .filter(Boolean)
      .join("--");
    return path.join(this.incrementalCacheDir, sanitizeName(targetKey));
  }

  async cleanIncrementalProjectCache(projectId) {
    if (!this.incrementalCacheDir) return 0;
    const projectKey = sanitizeName(projectId);
    if (!projectKey) return 0;
    const entries = await fs.readdir(this.incrementalCacheDir, { withFileTypes: true }).catch(() => []);
    const cacheDirectories = entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(`${projectKey}--`))
      .map((entry) => path.join(this.incrementalCacheDir, entry.name));
    await Promise.all(cacheDirectories.map((cacheDir) => fs.rm(cacheDir, { recursive: true, force: true })));
    return cacheDirectories.length;
  }

  async cleanup(workspace) {
    const normalized = typeof workspace === "string" ? { jobDir: workspace, persistent: false } : workspace;
    if (!normalized?.persistent) {
      await fs.rm(normalized.jobDir, { recursive: true, force: true });
      return;
    }
    if (normalized.buildDir) await fs.rm(normalized.buildDir, { recursive: true, force: true });
  }
}

function jobStorageKey(jobId) {
  const value = String(jobId || "job");
  const prefix = sanitizeName(value).slice(0, 48) || "job";
  const digest = crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
  return `${prefix}--${digest}`;
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

async function invalidatePlatformioCacheForChangedConfiguration(packageDir, hashPath, content) {
  if (content === undefined) return "";
  const normalized = normalizeContent(content);
  const hash = crypto.createHash("sha256").update(normalized).digest("hex");
  const previousHash = await fs.readFile(hashPath, "utf8").then((value) => value.trim()).catch(() => "");
  if (previousHash !== hash) {
    await Promise.all([
      fs.rm(path.join(packageDir, ".pio"), { recursive: true, force: true }),
      fs.rm(path.join(packageDir, "managed_components"), { recursive: true, force: true }),
      fs.rm(path.join(packageDir, "dependencies.lock"), { force: true }),
      fs.rm(path.join(packageDir, "sdkconfig"), { force: true }),
      fs.rm(path.join(packageDir, "sdkconfig.old"), { force: true }),
    ]);
  }
  return hash;
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

async function readPackageManifest(manifestPath) {
  try {
    const paths = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    return Array.isArray(paths) ? paths.map((value) => String(value)) : [];
  } catch {
    return [];
  }
}

async function removeStalePackageFiles(packageDir, expectedPaths, previousPackagePaths) {
  await Promise.all(previousPackagePaths
    .filter((relativePath) => !expectedPaths.has(relativePath))
    .map((relativePath) => fs.rm(resolveInside(packageDir, relativePath), { force: true })));
}

async function repairIncompleteEspIdfCache(packageDir) {
  const managedComponentsDir = path.join(packageDir, "managed_components");
  const platformioBuildDir = path.join(packageDir, ".pio", "build");
  let environments;
  try {
    environments = await fs.readdir(platformioBuildDir, { withFileTypes: true });
  } catch {
    return false;
  }

  for (const environment of environments.filter((entry) => entry.isDirectory())) {
    const ninjaFile = path.join(platformioBuildDir, environment.name, "build.ninja");
    const ninja = await fs.readFile(ninjaFile, "utf8").catch(() => "");
    if (!/managed_components[\\/]/.test(ninja)) continue;
    if (await managedComponentsAreComplete(packageDir, managedComponentsDir, ninja)) continue;

    await fs.rm(path.join(packageDir, ".pio"), { recursive: true, force: true });
    await fs.rm(managedComponentsDir, { recursive: true, force: true });
    await Promise.all(["dependencies.lock", "sdkconfig", "sdkconfig.old"]
      .map((fileName) => fs.rm(path.join(packageDir, fileName), { force: true })));
    return true;
  }
  return false;
}

async function managedComponentsAreComplete(packageDir, managedComponentsDir, ninja) {
  let componentEntries;
  try {
    componentEntries = await fs.readdir(managedComponentsDir, { withFileTypes: true });
  } catch {
    return false;
  }

  const componentDirs = componentEntries.filter((entry) => entry.isDirectory());
  if (componentDirs.length === 0) return false;
  for (const component of componentDirs) {
    if (!await pathExists(path.join(managedComponentsDir, component.name, "CMakeLists.txt"))) return false;
  }

  const referencedSources = ninja
    .split(/\r?\n/)
    .filter((line) => line.startsWith("build "))
    .flatMap((line) => line.split(/\s+/))
    .filter((token) => /managed_components[\\/].*\.(?:c|cc|cpp|cxx|s|S)$/.test(token));
  for (const referencedSource of referencedSources) {
    const sourcePath = path.isAbsolute(referencedSource)
      ? path.normalize(referencedSource)
      : path.resolve(packageDir, referencedSource);
    const relativeSource = path.relative(packageDir, sourcePath);
    if (relativeSource.startsWith("..") || path.isAbsolute(relativeSource)) continue;
    if (!await pathExists(sourcePath)) return false;
  }

  return true;
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
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
