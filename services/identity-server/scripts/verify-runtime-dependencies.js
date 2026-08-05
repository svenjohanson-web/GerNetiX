"use strict";

const fs = require("node:fs");
const path = require("node:path");

function findMissingRuntimeDependencies(packageJson, nodeModulesDirectory) {
  return Object.keys(packageJson.dependencies || {}).filter((dependencyName) => {
    const dependencyDirectory = path.join(nodeModulesDirectory, ...dependencyName.split("/"));
    return !fs.existsSync(dependencyDirectory);
  });
}

function findMissingWorkspaceRuntimePaths(requiredPaths, workspaceRoot) {
  return requiredPaths.filter((requiredPath) => !fs.existsSync(path.join(workspaceRoot, requiredPath)));
}

function verifyRuntimeDependencies({
  packageJsonPath = path.join(__dirname, "..", "package.json"),
  nodeModulesDirectory = path.join(__dirname, "..", "node_modules"),
  workspaceRoot = path.join(__dirname, "..", "..", ".."),
  requiredWorkspacePaths = ["tools/usb-serial-helper/package.json"]
} = {}) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const missingDependencies = findMissingRuntimeDependencies(packageJson, nodeModulesDirectory);
  const missingWorkspacePaths = findMissingWorkspaceRuntimePaths(requiredWorkspacePaths, workspaceRoot);

  if (missingDependencies.length > 0) {
    throw new Error(`Fehlende Identity-Laufzeitabhaengigkeiten: ${missingDependencies.join(", ")}`);
  }

  if (missingWorkspacePaths.length > 0) {
    throw new Error(`Fehlende Identity-Workspace-Laufzeitdateien: ${missingWorkspacePaths.join(", ")}`);
  }

  return Object.keys(packageJson.dependencies || {});
}

if (require.main === module) {
  const dependencies = verifyRuntimeDependencies();
  process.stdout.write(`Identity-Laufzeitabhaengigkeiten vorhanden: ${dependencies.join(", ")}\n`);
}

module.exports = {
  findMissingRuntimeDependencies,
  findMissingWorkspaceRuntimePaths,
  verifyRuntimeDependencies
};
