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

  async run(job, packageDir) {
    if (this.runner === "platformio") {
      return runPlatformioBuild({
        command: this.platformioCommand,
        packageDir,
        cacheDir: this.cacheDir,
        browserFlashRequested: job.mode === "build_and_usb_flash",
      });
    }

    if (this.runner !== "mock" || !this.allowMockRunner) {
      throw new BuildDeployError("invalid_build_runner", "Nur der echte PlatformIO-Build-Runner ist ausserhalb von Tests erlaubt.", 500);
    }
    return runMockBuild(job, packageDir);
  }
}

async function runMockBuild(job, packageDir) {
  const outputDir = path.join(packageDir, ".gernetix-build");
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

  return {
    status: "succeeded",
    artifacts,
    usb_flash: job.mode === "build_and_usb_flash"
      ? { requested: true, status: "succeeded", upload_port: job.usb_flash?.upload_port || "auto" }
      : { requested: false, status: "not_requested" },
  };
}

async function runPlatformioBuild(options) {
  const logPath = path.join(options.packageDir, "build.log");
  const env = createPlatformioEnv(options.cacheDir);
  const result = await spawnAndCapture(options.command, ["run"], {
    cwd: options.packageDir,
    env,
  });
  let output = result.output;

  if (result.exitCode !== 0) {
    await fs.writeFile(logPath, output);
    throw new BuildDeployError("build_failed", "PlatformIO-Build fehlgeschlagen.", 422, {
      exit_code: result.exitCode,
      build_log: output,
    });
  }

  const usbFlash = options.browserFlashRequested
    ? { requested: true, status: "browser_required", runner: "web_serial", transport: "web_serial" }
    : { requested: false, status: "not_requested" };

  await fs.writeFile(logPath, output);
  const buildDir = path.join(options.packageDir, ".pio", "build");
  const artifactPaths = await findPlatformioArtifacts(buildDir);
  artifactPaths["build.log"] = logPath;
  return { status: "succeeded", artifacts: artifactPaths, usb_flash: usbFlash };
}

function createPlatformioEnv(cacheDir) {
  const env = { ...process.env };
  if (cacheDir) env.PLATFORMIO_CORE_DIR = cacheDir;
  return env;
}

function spawnAndCapture(command, args, options) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options);
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", reject);
    child.on("close", (exitCode) => resolve({ exitCode, output }));
  });
}

async function findPlatformioArtifacts(buildDir) {
  const envDirs = await fs.readdir(buildDir, { withFileTypes: true });
  for (const envDir of envDirs.filter((entry) => entry.isDirectory())) {
    const root = path.join(buildDir, envDir.name);
    const artifacts = {
      "firmware.bin": path.join(root, "firmware.bin"),
      "bootloader.bin": path.join(root, "bootloader.bin"),
      "partitions.bin": path.join(root, "partitions.bin"),
      "boot_app0.bin": path.join(root, "boot_app0.bin"),
      "firmware.elf": path.join(root, "firmware.elf"),
      "firmware.map": path.join(root, "firmware.map"),
      "firmware.hex": path.join(root, "firmware.hex"),
    };
    const existingArtifacts = await filterExistingFiles(artifacts);
    if (existingArtifacts["firmware.elf"] && hasFirmwareImage(existingArtifacts)) return existingArtifacts;
  }

  throw new BuildDeployError("missing_build_artifacts", "PlatformIO hat keine nutzbaren Firmware-Artefakte erzeugt.", 422);
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

module.exports = { FirmwareBuildJobRunner };
