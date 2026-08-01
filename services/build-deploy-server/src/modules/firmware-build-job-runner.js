const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { BuildDeployError } = require("../errors");

class FirmwareBuildJobRunner {
  constructor(options) {
    this.runner = options.runner;
    this.platformioCommand = options.platformioCommand;
    this.cacheDir = options.cacheDir;
    this.allowMockRunner = options.allowMockRunner === true;
  }

  async run(job, packageDir, options = {}) {
    if (this.runner === "platformio") {
      return runPlatformioBuild({
        command: this.platformioCommand,
        packageDir,
        cacheDir: this.cacheDir,
        browserFlashRequested: job.mode === "build_and_usb_flash",
        buildDir: options.buildDir,
        onProgress: options.onProgress,
        signal: options.signal,
      });
    }

    if (this.runner !== "mock" || !this.allowMockRunner) {
      throw new BuildDeployError("invalid_build_runner", "Nur der echte PlatformIO-Build-Runner ist ausserhalb von Tests erlaubt.", 500);
    }
    return runMockBuild(job, packageDir, options.buildDir, options.signal);
  }
}

async function runMockBuild(job, packageDir, buildDir, signal) {
  throwIfAborted(signal);
  const outputDir = buildDir || path.join(packageDir, ".gernetix-build");
  await fs.mkdir(outputDir, { recursive: true });

  const metadata = {
    job_id: job.job_id,
    mode: job.mode || "build",
    created_at: new Date().toISOString(),
    package_files: await listFiles(packageDir),
  };

  const artifacts = {
    "firmware.bin": path.join(outputDir, "firmware.bin"),
    "firmware.elf": path.join(outputDir, "firmware.elf"),
    "firmware.map": path.join(outputDir, "firmware.map"),
    "firmware.hex": path.join(outputDir, "firmware.hex"),
    "build.log": path.join(outputDir, "build.log"),
  };

  await fs.writeFile(artifacts["firmware.bin"], Buffer.from(JSON.stringify(metadata)));
  await fs.writeFile(artifacts["firmware.elf"], `mock elf for ${job.job_id}\n`);
  await fs.writeFile(artifacts["firmware.map"], `mock map for ${job.job_id}\n`);
  await fs.writeFile(artifacts["firmware.hex"], `:00000001FF\n`);
  const flashLine = job.mode === "build_and_usb_flash"
    ? `Mock USB flash completed for ${job.usb_flash?.upload_port || "auto"}\n`
    : "";
  await fs.writeFile(artifacts["build.log"], `Mock build completed for ${job.job_id}\n${flashLine}`);
  throwIfAborted(signal);

  return {
    status: "succeeded",
    artifacts,
    usb_flash: job.mode === "build_and_usb_flash"
      ? { requested: true, status: "succeeded", upload_port: job.usb_flash?.upload_port || "auto" }
      : { requested: false, status: "not_requested" },
  };
}

async function runPlatformioBuild(options) {
  const buildDir = options.buildDir || path.join(options.packageDir, ".pio", "build");
  const logPath = path.join(buildDir, "build.log");
  const env = createPlatformioEnv(options.cacheDir, options.packageDir, buildDir);
  const spawnOptions = {
    cwd: options.packageDir,
    env,
    onOutput: options.onProgress,
    signal: options.signal,
  };
  let result = await spawnAndCapture(options.command, ["run"], spawnOptions);
  let output = result.output;

  if (result.exitCode !== 0 && isCorruptedEspIdfComponentCache(output)) {
    const retryMessage = "ESP-IDF-Abhängigkeitscache beschädigt. GerNetiX bereinigt nur dieses Build-Ziel und versucht den Build einmal erneut.";
    if (typeof options.onProgress === "function") options.onProgress(retryMessage);
    await clearEspIdfTargetCache(options.packageDir, buildDir);
    result = await spawnAndCapture(options.command, ["run"], spawnOptions);
    output = `${output}\n${retryMessage}\n${result.output}`;
  }

  if (result.exitCode !== 0) {
    await fs.mkdir(buildDir, { recursive: true });
    await fs.writeFile(logPath, output);
    throw new BuildDeployError("build_failed", "PlatformIO-Build fehlgeschlagen.", 422, {
      exit_code: result.exitCode,
      build_log: output,
    });
  }

  const usbFlash = options.browserFlashRequested
    ? { requested: true, status: "browser_required", runner: "web_serial", transport: "web_serial" }
    : { requested: false, status: "not_requested" };

  await fs.mkdir(buildDir, { recursive: true });
  await fs.writeFile(logPath, output);
  const { artifacts: artifactPaths, flashManifest } = await findPlatformioArtifacts(buildDir, {
    requireBrowserFlashPackage: options.browserFlashRequested,
  });
  artifactPaths["build.log"] = logPath;
  return { status: "succeeded", artifacts: artifactPaths, flash_manifest: flashManifest, usb_flash: usbFlash };
}

function createPlatformioEnv(cacheDir, packageDir, buildDir) {
  const env = { ...process.env };
  if (cacheDir) env.PLATFORMIO_CORE_DIR = cacheDir;
  if (packageDir) {
    // The ESP-IDF Component Manager otherwise uses one process-global download
    // cache. Parallel software targets can then delete/unpack the same component
    // concurrently and leave both builds with a corrupted dependency.
    env.IDF_COMPONENT_CACHE_PATH = path.resolve(packageDir, "..", "idf-component-cache");
    env.PLATFORMIO_BUILD_CACHE_DIR = path.resolve(packageDir, "..", "platformio-object-cache");
  }
  if (buildDir) env.PLATFORMIO_BUILD_DIR = path.resolve(buildDir);
  return env;
}

function isCorruptedEspIdfComponentCache(output) {
  const text = String(output || "");
  if (/downloaded component ["'].+["'] is corrupted/i.test(text)) return true;
  return /directory not empty/i.test(text)
    && /(?:Espressif[\\/]ComponentManager|managed_components|espressif__)/i.test(text);
}

async function clearEspIdfTargetCache(packageDir, buildDir = path.join(packageDir, ".pio", "build")) {
  await Promise.all([
    fs.rm(path.resolve(packageDir, "..", "idf-component-cache"), { recursive: true, force: true }),
    fs.rm(path.resolve(packageDir, "..", "platformio-object-cache"), { recursive: true, force: true }),
    fs.rm(buildDir, { recursive: true, force: true }),
    fs.rm(path.join(packageDir, "managed_components"), { recursive: true, force: true }),
    fs.rm(path.join(packageDir, "dependencies.lock"), { force: true }),
  ]);
}

function spawnAndCapture(command, args, options) {
  return new Promise((resolve, reject) => {
    if (options.signal?.aborted) {
      reject(cancelledError());
      return;
    }
    const detached = process.platform !== "win32";
    const child = spawn(command, args, { ...options, signal: undefined, detached });
    let output = "";
    let pendingLine = "";
    let forceKillTimer = null;
    let settled = false;
    const finish = (callback, value) => {
      if (settled) return;
      settled = true;
      if (forceKillTimer) clearTimeout(forceKillTimer);
      options.signal?.removeEventListener("abort", abort);
      callback(value);
    };
    const kill = (signal) => {
      try {
        if (detached && child.pid) process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
    };
    const abort = () => {
      try { kill("SIGTERM"); } catch {}
      forceKillTimer = setTimeout(() => {
        try { kill("SIGKILL"); } catch {}
      }, 3000);
      forceKillTimer.unref?.();
    };
    const report = (chunk) => {
      output += chunk;
      if (typeof options.onOutput !== "function") return;
      pendingLine += chunk;
      const lines = pendingLine.split(/\r?\n/);
      pendingLine = lines.pop() || "";
      for (const line of lines) options.onOutput(line);
    };
    child.stdout.on("data", (chunk) => { report(String(chunk)); });
    child.stderr.on("data", (chunk) => { report(String(chunk)); });
    options.signal?.addEventListener("abort", abort, { once: true });
    child.on("error", (error) => finish(reject, error));
    child.on("close", (exitCode) => {
      if (pendingLine && typeof options.onOutput === "function") options.onOutput(pendingLine);
      if (options.signal?.aborted) finish(reject, cancelledError(output));
      else finish(resolve, { exitCode, output });
    });
  });
}

function throwIfAborted(signal) {
  if (signal?.aborted) throw cancelledError();
}

function cancelledError(buildLog = "") {
  return new BuildDeployError("build_cancelled", "Build wurde abgebrochen.", 409, {
    ...(buildLog ? { build_log: buildLog } : {}),
  });
}

async function findPlatformioArtifacts(buildDir, options = {}) {
  const envDirs = await fs.readdir(buildDir, { withFileTypes: true });
  let incompleteFlashPackage = false;
  for (const envDir of envDirs.filter((entry) => entry.isDirectory())) {
    const root = path.join(buildDir, envDir.name);
    const flashArgumentArtifacts = await platformioFlashArgumentArtifacts(root);
    const artifactCandidates = {
      "firmware.bin": [flashArgumentArtifacts["firmware.bin"], path.join(root, "firmware.bin")],
      "bootloader.bin": [flashArgumentArtifacts["bootloader.bin"], path.join(root, "bootloader.bin"), path.join(root, "bootloader", "bootloader.bin")],
      "partitions.bin": [flashArgumentArtifacts["partitions.bin"], path.join(root, "partitions.bin"), path.join(root, "partition_table", "partition-table.bin")],
      "boot_app0.bin": [flashArgumentArtifacts["boot_app0.bin"], path.join(root, "boot_app0.bin")],
      "firmware.elf": path.join(root, "firmware.elf"),
      "firmware.map": path.join(root, "firmware.map"),
      "firmware.hex": path.join(root, "firmware.hex"),
    };
    const artifacts = {};
    for (const [name, candidates] of Object.entries(artifactCandidates)) {
      artifacts[name] = Array.isArray(candidates) ? await firstExistingFile(candidates) : candidates;
    }
    const existingArtifacts = await filterExistingFiles(artifacts);
    if (existingArtifacts["firmware.elf"] && hasFirmwareImage(existingArtifacts)) {
      const completeBrowserFlashPackage = ["bootloader.bin", "partitions.bin", "firmware.bin"]
        .every((name) => existingArtifacts[name]);
      if (options.requireBrowserFlashPackage && !completeBrowserFlashPackage) {
        incompleteFlashPackage = true;
        continue;
      }
      return {
        artifacts: existingArtifacts,
        flashManifest: await readPlatformioFlashManifest(root, existingArtifacts),
      };
    }
  }

  if (incompleteFlashPackage) {
    throw new BuildDeployError(
      "incomplete_usb_flash_package",
      "PlatformIO hat die Firmware gebaut, aber Bootloader oder Partitionstabelle fuer den USB-Flash fehlen.",
      422,
    );
  }
  throw new BuildDeployError("missing_build_artifacts", "PlatformIO hat keine nutzbaren Firmware-Artefakte erzeugt.", 422);
}

async function platformioFlashArgumentArtifacts(root) {
  const result = {};
  for (const item of await readPlatformioFlashArgumentEntries(root)) {
    const name = canonicalFlashArtifactName(item.file);
    if (!name || result[name]) continue;
    const resolved = path.resolve(root, item.file);
    if (resolved !== root && !resolved.startsWith(`${root}${path.sep}`)) continue;
    result[name] = resolved;
  }
  return result;
}

async function firstExistingFile(candidates) {
  for (const candidate of candidates.filter(Boolean)) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {}
  }
  return "";
}

async function readPlatformioFlashManifest(root, artifacts) {
  const allowed = new Set(Object.keys(artifacts));
  const manifest = [];
  for (const item of await readPlatformioFlashArgumentEntries(root)) {
    const name = canonicalFlashArtifactName(item.file);
    if (!allowed.has(name)) continue;
    manifest.push({ name, address: item.address });
  }
  const appAddress = await firstEsp32AppPartitionOffset(artifacts["partitions.bin"]);
  const firmware = manifest.find((item) => item.name === "firmware.bin");
  if (firmware && Number.isInteger(appAddress)) firmware.address = appAddress;
  return manifest;
}

async function firstEsp32AppPartitionOffset(partitionFile) {
  if (!partitionFile) return null;
  let table;
  try {
    table = await fs.readFile(partitionFile);
  } catch {
    return null;
  }
  const offsets = [];
  for (let position = 0; position + 32 <= table.length; position += 32) {
    if (table.readUInt16LE(position) !== 0x50aa) break;
    if (table[position + 2] === 0x00) offsets.push(table.readUInt32LE(position + 4));
  }
  return offsets.length ? Math.min(...offsets) : null;
}

async function readPlatformioFlashArgumentEntries(root) {
  let content = "";
  try {
    content = await fs.readFile(path.join(root, "flash_args"), "utf8");
  } catch {
    return [];
  }
  const tokens = content.match(/(?:[^\s"']+|"[^"]*"|'[^']*')+/g) || [];
  const entries = [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (!/^0x[0-9a-f]+$/i.test(tokens[index])) continue;
    entries.push({
      address: Number.parseInt(tokens[index], 16),
      file: tokens[index + 1].replace(/^['"]|['"]$/g, "").replace(/\\/g, "/"),
    });
    index += 1;
  }
  return entries;
}

function canonicalFlashArtifactName(fileName) {
  const baseName = path.posix.basename(String(fileName || "").replace(/\\/g, "/")).toLowerCase();
  if (baseName === "partition-table.bin" || baseName === "partitions.bin") return "partitions.bin";
  if (["bootloader.bin", "boot_app0.bin", "firmware.bin"].includes(baseName)) return baseName;
  return "";
}

function hasFirmwareImage(artifacts) {
  return Boolean(artifacts["firmware.bin"] || artifacts["firmware.hex"]);
}

async function filterExistingFiles(artifacts) {
  const existing = {};
  for (const [name, filePath] of Object.entries(artifacts)) {
    try {
      await fs.access(filePath);
      existing[name] = filePath;
    } catch {
      // Optional PlatformIO artifacts differ by target platform.
    }
  }
  return existing;
}

async function listFiles(rootDir) {
  const result = [];
  await walk(rootDir, rootDir, result);
  return result.sort();
}

async function walk(rootDir, currentDir, result) {
  const entries = await fs.readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(currentDir, entry.name);
    if (entry.isDirectory()) {
      await walk(rootDir, fullPath, result);
    } else {
      result.push(path.relative(rootDir, fullPath).replace(/\\/g, "/"));
    }
  }
}

module.exports = {
  FirmwareBuildJobRunner,
  clearEspIdfTargetCache,
  createPlatformioEnv,
  findPlatformioArtifacts,
  isCorruptedEspIdfComponentCache,
  readPlatformioFlashManifest,
  spawnAndCapture,
};
