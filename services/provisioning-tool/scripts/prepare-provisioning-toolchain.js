const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..", "..");
const toolchainRoot = process.env.PROVISIONING_TOOLCHAIN_ROOT
  ? path.resolve(process.env.PROVISIONING_TOOLCHAIN_ROOT)
  : path.join(repoRoot, ".runtime", "toolchains", "provisioning");
const manifestPath = process.env.PROVISIONING_TOOLCHAIN_MANIFEST
  ? path.resolve(process.env.PROVISIONING_TOOLCHAIN_MANIFEST)
  : path.join(toolchainRoot, "toolchain.json");

function requiredPath(name, value) {
  const resolved = value ? path.resolve(value) : "";
  if (!resolved) {
    throw new Error(`${name} fehlt. Setze ${name} auf den deployten Runtime-Pfad.`);
  }
  if (!fs.existsSync(resolved)) {
    throw new Error(`${name} existiert nicht: ${resolved}`);
  }
  return resolved;
}

function run() {
  const manifest = {
    platformioExecutable: process.env.PLATFORMIO_EXE || process.env.PLATFORMIO_EXECUTABLE
      ? requiredPath("PLATFORMIO_EXE", process.env.PLATFORMIO_EXE || process.env.PLATFORMIO_EXECUTABLE)
      : "",
    esptoolExecutable: requiredPath("ESPTOOL_EXE", process.env.ESPTOOL_EXE || process.env.ESPTOOL_EXECUTABLE),
    esptoolPythonExecutable: process.env.ESPTOOL_PYTHON_EXE || process.env.PYTHON_EXE
      ? requiredPath("ESPTOOL_PYTHON_EXE", process.env.ESPTOOL_PYTHON_EXE || process.env.PYTHON_EXE)
      : "",
    createdAt: new Date().toISOString(),
    contract: "gernetix.provisioning-toolchain.v1",
  };

  if (/\.py$/i.test(manifest.esptoolExecutable) && !manifest.esptoolPythonExecutable) {
    throw new Error("ESPTOOL_PYTHON_EXE ist erforderlich, wenn ESPTOOL_EXE auf eine .py-Datei zeigt.");
  }

  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Provisioning-Toolchain-Manifest geschrieben: ${manifestPath}`);
}

run();
