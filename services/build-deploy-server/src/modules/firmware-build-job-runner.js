const fs = require("node:fs/promises");
const path = require("node:path");
const { spawn } = require("node:child_process");
const { BuildDeployError } = require("../errors");

class FirmwareBuildJobRunner {
  constructor(options) {
    this.runner = options.runner;
    this.platformioCommand = options.platformioCommand;
    this.cacheDir = options.cacheDir;
  }

  async run(job, packageDir) {
    if (this.runner === "platformio") {
      return runPlatformioBuild({
        command: this.platformioCommand,
        packageDir,
        cacheDir: this.cacheDir,
      });
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
    "build.log": path.join(outputDir, "build.log"),
  };

  await fs.writeFile(artifacts["firmware.bin"], Buffer.from(JSON.stringify(metadata)));
  await fs.writeFile(artifacts["firmware.elf"], `mock elf for ${job.job_id}\n`);
  await fs.writeFile(artifacts["firmware.map"], `mock map for ${job.job_id}\n`);
  await fs.writeFile(artifacts["build.log"], `Mock build completed for ${job.job_id}\n`);

  return { status: "succeeded", artifacts };
}

async function runPlatformioBuild(options) {
  const logPath = path.join(options.packageDir, "build.log");
  const result = await spawnAndCapture(options.command, ["run"], {
    cwd: options.packageDir,
    env: {
      ...process.env,
      PLATFORMIO_CORE_DIR: options.cacheDir,
    },
  });
  await fs.writeFile(logPath, result.output);

  if (result.exitCode !== 0) {
    throw new BuildDeployError("build_failed", "PlatformIO-Build fehlgeschlagen.", 422, {
      exit_code: result.exitCode,
      build_log: result.output,
    });
  }

  const buildDir = path.join(options.packageDir, ".pio", "build");
  const artifactPaths = await findPlatformioArtifacts(buildDir);
  artifactPaths["build.log"] = logPath;
  return { status: "succeeded", artifacts: artifactPaths };
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
      "firmware.elf": path.join(root, "firmware.elf"),
      "firmware.map": path.join(root, "firmware.map"),
    };
    if (await allFilesExist(Object.values(artifacts))) return artifacts;
  }

  throw new BuildDeployError("missing_build_artifacts", "PlatformIO hat nicht alle erwarteten Firmware-Artefakte erzeugt.", 422);
}

async function allFilesExist(filePaths) {
  for (const filePath of filePaths) {
    try {
      await fs.access(filePath);
    } catch {
      return false;
    }
  }
  return true;
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
