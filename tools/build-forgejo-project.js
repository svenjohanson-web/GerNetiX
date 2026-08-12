"use strict";

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { BuildPackageStore } = require("../services/build-deploy-server/src/modules/build-package-store");
const {
  createPlatformioEnv,
  FirmwareBuildJobRunner,
  spawnAndCapture,
} = require("../services/build-deploy-server/src/modules/firmware-build-job-runner");
const {
  composeEsp32BasissoftwarePackage,
  loadEsp32BasissoftwareFiles,
} = require("../services/project-server/src/modules/esp32-basissoftware-package");

const EXCLUDED_DIRECTORIES = new Set([
  ".git", ".pio", ".gernetix-build", ".vscode", "managed_components", "node_modules", "test",
]);
const EXCLUDED_FILES = new Set(["build.bat", "build.sh", "build.command", "flash.bat", "flash.sh", "flash.command", "dependencies.lock", "sdkconfig", "sdkconfig.old"]);

async function main(argv = process.argv.slice(2)) {
  const repositoryRoot = path.resolve(option(argv, "--repository") || process.cwd());
  const checkOnly = argv.includes("--check");
  const flashRequested = argv.includes("--flash");
  const uploadPort = flashRequested ? normalizeUploadPort(option(argv, "--port")) : "";
  const manifest = await loadBuildManifest(repositoryRoot);
  const configuredTargets = Array.isArray(manifest.local_build?.targets) ? manifest.local_build.targets : [];
  if (!configuredTargets.length) throw new Error("Im System-Repository fehlt gernetix/system-repository.json.local_build.targets.");
  const targets = selectTargets(configuredTargets, option(argv, "--target"), flashRequested);

  const platformioCommand = findPlatformio();
  const cacheRoot = path.join(repositoryRoot, ".gernetix-build");
  const packageStore = new BuildPackageStore({
    tempDir: path.join(cacheRoot, "jobs"),
    incrementalCacheDir: path.join(cacheRoot, "cache"),
  });
  const runner = new FirmwareBuildJobRunner({
    runner: "platformio",
    platformioCommand,
    cacheDir: path.join(cacheRoot, "platformio-core"),
  });

  const results = [];
  for (const target of targets) {
    const files = await createBuildPackageFiles(repositoryRoot, manifest, target);
    validatePackage(target, files);
    if (checkOnly) {
      results.push({ target: target.id, status: "checked", files: Object.keys(files).length });
      continue;
    }
    const job = {
      job_id: `local-${manifest.source_id}-${target.id}-${Date.now()}`,
      project_id: manifest.source_id,
      software_unit_id: target.id,
      device_id: "local",
      cache_generation: 0,
      mode: "build",
      build_package: { files },
    };
    const workspace = await packageStore.materialize(job);
    const output = await runner.run(job, workspace.packageDir, {
      buildDir: workspace.buildDir,
      onProgress: (line) => process.stdout.write(`${line}\n`),
    });
    if (flashRequested) {
      const env = createPlatformioEnv(path.join(cacheRoot, "platformio-core"), workspace.packageDir, workspace.buildDir);
      const upload = await spawnAndCapture(platformioCommand, ["run", "-t", "upload", "--upload-port", uploadPort], {
        cwd: workspace.packageDir,
        env,
        onOutput: (line) => process.stdout.write(`${line}\n`),
      });
      if (upload.exitCode !== 0) throw new Error(`PlatformIO-Upload fuer ${target.id} fehlgeschlagen.`);
    }
    results.push({
      target: target.id,
      status: flashRequested ? "flashed" : output.status,
      workspace: workspace.packageDir,
      artifacts: output.artifacts,
    });
  }
  process.stdout.write(`${JSON.stringify({ repository: manifest.source_id, mode: checkOnly ? "check" : flashRequested ? "flash" : "build", targets: results }, null, 2)}\n`);
}

async function loadBuildManifest(repositoryRoot) {
  const systemManifestPath = path.join(repositoryRoot, "gernetix", "system-repository.json");
  if (fs.existsSync(systemManifestPath)) return JSON.parse(await fsp.readFile(systemManifestPath, "utf8"));
  const projectManifestPath = path.join(repositoryRoot, "gernetix", "project.json");
  if (!fs.existsSync(projectManifestPath)) {
    throw new Error("Es fehlt gernetix/system-repository.json oder gernetix/project.json.");
  }
  const project = JSON.parse(await fsp.readFile(projectManifestPath, "utf8"));
  const unitsRoot = path.join(repositoryRoot, "gernetix", "software-units");
  const unitFiles = (await fsp.readdir(unitsRoot, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .sort((left, right) => left.name.localeCompare(right.name));
  const units = await Promise.all(unitFiles.map(async (entry) => JSON.parse(await fsp.readFile(path.join(unitsRoot, entry.name), "utf8"))));
  const targets = units
    .filter((unit) => unit.build_system === "platformio" && unit.software_unit_id && unit.source_root)
    .map((unit) => ({
      id: unit.software_unit_id,
      title: unit.title || unit.software_unit_id,
      type: unit.build?.firmware_basis_id ? "esp32-product" : "direct",
      source_root: unit.source_root,
      environment: unit.build?.environment || "",
      ...(unit.build?.firmware_basis_id ? {
        basis_repository: unit.build.firmware_basis_id === "gernetix-runtime-basissoftware"
          ? "basissoftware-esp32"
          : unit.build.firmware_basis_id,
        build_config: unit.build,
      } : {}),
    }));
  return {
    schema_version: 1,
    source_id: project.project_id,
    title: project.title,
    kind: "project",
    local_build: { schema_version: 1, runner: "gernetix-build-worker-platformio", targets },
  };
}

function selectTargets(targets, requestedTarget, flashRequested = false) {
  const targetId = String(requestedTarget || "").trim();
  if (targetId) {
    const selected = targets.find((target) => target.id === targetId);
    if (!selected) throw new Error(`Unbekanntes Buildziel: ${targetId}`);
    return [selected];
  }
  if (flashRequested && targets.length > 1) {
    throw new Error(`Dieses Projekt besitzt mehrere Flashziele. Waehle eines: ${targets.map((target) => target.id).join(", ")}`);
  }
  return targets;
}

function normalizeUploadPort(value, platform = process.platform) {
  const port = String(value || "").trim();
  if (platform === "win32") {
    if (!/^COM[1-9][0-9]{0,2}$/i.test(port)) throw new Error("Zum Flashen muss ein gueltiger COM-Port angegeben werden, zum Beispiel COM5.");
    return port.toUpperCase();
  }
  if (!/^\/dev\/[A-Za-z0-9._/-]+$/.test(port) || port.includes("..")) {
    throw new Error("Zum Flashen muss ein gueltiger serieller Device-Pfad angegeben werden.");
  }
  return port;
}

async function createBuildPackageFiles(repositoryRoot, manifest, target) {
  if (target.type === "direct") {
    const files = target.source_root
      ? Object.fromEntries((await productProjectSources(repositoryRoot, target)).map((file) => [file.path, file.content]))
      : await readRepositoryFiles(repositoryRoot);
    configureDirectEnvironment(files, target);
    if (target.inject_runtime_core) await injectRuntimeCore(files);
    return files;
  }
  if (target.type === "esp32-product") {
    const projectSources = await productProjectSources(repositoryRoot, target);
    const basisRoot = resolveSiblingRepository(repositoryRoot, target.basis_repository || "basissoftware-esp32");
    const composed = composeEsp32BasissoftwarePackage({
      basisFiles: loadEsp32BasissoftwareFiles(basisRoot),
      projectSources,
      buildConfig: target.build_config,
    });
    return Object.fromEntries(composed.map((file) => [
      file.path,
      file.content_base64 ? { base64: file.content_base64 } : file.content,
    ]));
  }
  if (target.type === "esp8266-product") {
    const basisRoot = resolveSiblingRepository(repositoryRoot, target.basis_repository || "basissoftware-esp8266");
    const basisFiles = await readRepositoryFiles(basisRoot);
    const productFiles = await readRepositoryFiles(repositoryRoot);
    const files = { ...basisFiles, ...productFiles };
    files["platformio.ini"] = String(files["platformio.ini"] || "")
      .replace(/^src_dir\s*=.*$/m, "src_dir = src");
    return files;
  }
  throw new Error(`Unbekannter lokaler Buildtyp: ${target.type}`);
}

function configureDirectEnvironment(files, target) {
  const environment = String(target.environment || "").trim();
  if (!environment) return files;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,79}$/.test(environment)) {
    throw new Error(`Buildziel ${target.id} besitzt eine unsichere PlatformIO-Umgebung.`);
  }
  let ini = String(files["platformio.ini"] || "");
  const environmentHeader = `[env:${environment}]`;
  if (!ini.split(/\r?\n/).some((line) => line.trim() === environmentHeader)) {
    throw new Error(`Buildziel ${target.id} verweist auf die fehlende PlatformIO-Umgebung ${environment}.`);
  }
  const lines = ini.split(/\r?\n/);
  const platformioIndex = lines.findIndex((line) => line.trim() === "[platformio]");
  if (platformioIndex === -1) {
    ini = `[platformio]\ndefault_envs = ${environment}\n\n${ini}`;
  } else {
    let sectionEnd = lines.length;
    for (let index = platformioIndex + 1; index < lines.length; index += 1) {
      if (/^\s*\[.+\]\s*$/.test(lines[index])) {
        sectionEnd = index;
        break;
      }
    }
    const defaultIndex = lines.findIndex((line, index) =>
      index > platformioIndex && index < sectionEnd && /^\s*default_envs\s*=/.test(line));
    if (defaultIndex === -1) lines.splice(platformioIndex + 1, 0, `default_envs = ${environment}`);
    else lines[defaultIndex] = `default_envs = ${environment}`;
    ini = lines.join("\n");
  }
  files["platformio.ini"] = Buffer.from(ini);
  return files;
}

async function injectRuntimeCore(files) {
  const root = path.resolve(__dirname, "..", "firmware", "shared", "gernetix-runtime-core");
  const coreFiles = await readRepositorySourceEntries(root);
  for (const file of coreFiles) {
    if (file.path !== "library.json" && !file.path.startsWith("include/") && !file.path.startsWith("src/")) continue;
    files[`lib/gernetix-runtime-core/${file.path}`] = file.content;
  }
  for (const cmakePath of ["CMakeLists.txt", "src/CMakeLists.txt"]) {
    if (!files[cmakePath]) continue;
    files[cmakePath] = Buffer.from(String(files[cmakePath]).replaceAll(
      "../../../firmware/shared/gernetix-runtime-core/",
      "../lib/gernetix-runtime-core/",
    ));
  }
}

async function productProjectSources(repositoryRoot, target) {
  const allFiles = await readRepositorySourceEntries(repositoryRoot);
  const sourceRoot = normalizeRelativePath(target.source_root || "");
  const prefix = sourceRoot ? `${sourceRoot}/` : "";
  const materializeRoot = normalizeRelativePath(target.materialize_root || "");
  const mappings = target.path_mappings || {};
  return allFiles
    .filter((file) => !prefix || file.path.startsWith(prefix))
    .map((file) => {
      const relative = prefix ? file.path.slice(prefix.length) : file.path;
      const mapped = mappings[relative] || relative;
      const projectPath = materializeRoot ? `${materializeRoot}/${mapped}` : mapped;
      return { path: projectPath, content: file.content, content_type: contentType(projectPath) };
    });
}

async function readRepositoryFiles(repositoryRoot) {
  return Object.fromEntries((await readRepositorySourceEntries(repositoryRoot)).map((file) => [file.path, file.content]));
}

async function readRepositorySourceEntries(repositoryRoot) {
  const entries = [];
  await walk(repositoryRoot, repositoryRoot, entries);
  return entries.sort((left, right) => left.path.localeCompare(right.path));
}

async function walk(repositoryRoot, currentDirectory, entries) {
  for (const entry of await fsp.readdir(currentDirectory, { withFileTypes: true })) {
    if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) continue;
    if (entry.isFile() && EXCLUDED_FILES.has(entry.name)) continue;
    const absolutePath = path.join(currentDirectory, entry.name);
    if (entry.isDirectory()) {
      await walk(repositoryRoot, absolutePath, entries);
      continue;
    }
    if (!entry.isFile()) continue;
    const relativePath = path.relative(repositoryRoot, absolutePath).replace(/\\/g, "/");
    if (relativePath === "gernetix/system-repository.json") continue;
    entries.push({ path: relativePath, content: await fsp.readFile(absolutePath) });
  }
}

function validatePackage(target, files) {
  if (!target.id || !/^[a-z0-9][a-z0-9._-]*$/.test(target.id)) throw new Error("Buildziel besitzt keine sichere ID.");
  if (!files["platformio.ini"]) throw new Error(`Buildziel ${target.id} enthaelt keine platformio.ini.`);
  if (!Object.keys(files).some((filePath) => /^(?:src|lib)\//.test(filePath))) {
    throw new Error(`Buildziel ${target.id} enthaelt keine Firmwarequellen.`);
  }
  const ini = String(files["platformio.ini"]);
  if (/src_dir\s*=\s*.*(?:\.\.\/){2,}/i.test(ini)) {
    throw new Error(`Buildziel ${target.id} verweist noch auf einen alten externen Quellpfad.`);
  }
}

function resolveSiblingRepository(repositoryRoot, repositoryName) {
  const resolved = path.resolve(repositoryRoot, "..", repositoryName);
  if (!fs.existsSync(path.join(resolved, "gernetix", "system-repository.json"))) {
    throw new Error(`Benoetigtes Nachbar-Repository fehlt: ${resolved}`);
  }
  return resolved;
}

function findPlatformio() {
  if (process.env.PLATFORMIO_COMMAND) return process.env.PLATFORMIO_COMMAND;
  const home = process.env.USERPROFILE || process.env.HOME || "";
  const executable = process.platform === "win32" ? "platformio.exe" : "platformio";
  const candidate = path.join(home, ".platformio", "penv", process.platform === "win32" ? "Scripts" : "bin", executable);
  return fs.existsSync(candidate) ? candidate : executable;
}

function normalizeRelativePath(value) {
  const normalized = String(value || "").trim().replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  if (normalized.split("/").some((part) => part === "." || part === "..")) throw new Error(`Unsicherer relativer Pfad: ${value}`);
  return normalized;
}

function contentType(filePath) {
  if (/\.(?:c|cc|cpp|cxx)$/i.test(filePath)) return "text/x-c++src";
  if (/\.(?:h|hh|hpp|hxx)$/i.test(filePath)) return "text/x-c++hdr";
  return "text/plain";
}

function option(args, name) {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] || "" : "";
}

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`Lokaler Forgejo-Build fehlgeschlagen: ${error.message}\n`);
    process.exitCode = 1;
  });
}

module.exports = { configureDirectEnvironment, createBuildPackageFiles, loadBuildManifest, main, normalizeUploadPort, productProjectSources, selectTargets, validatePackage };
