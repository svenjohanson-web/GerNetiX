"use strict";

const fs = require("node:fs");
const path = require("node:path");

function findMissingRuntimeDependencies(packageJson, nodeModulesDirectory) {
  return Object.keys(packageJson.dependencies || {}).filter((dependencyName) => {
    const dependencyDirectory = path.join(nodeModulesDirectory, ...dependencyName.split("/"));
    return !fs.existsSync(dependencyDirectory);
  });
}

function verifyRuntimeDependencies({
  packageJsonPath = path.join(__dirname, "..", "package.json"),
  nodeModulesDirectory = path.join(__dirname, "..", "node_modules")
} = {}) {
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  const missingDependencies = findMissingRuntimeDependencies(packageJson, nodeModulesDirectory);

  if (missingDependencies.length > 0) {
    throw new Error(`Fehlende Identity-Laufzeitabhaengigkeiten: ${missingDependencies.join(", ")}`);
  }

  return Object.keys(packageJson.dependencies || {});
}

if (require.main === module) {
  const dependencies = verifyRuntimeDependencies();
  process.stdout.write(`Identity-Laufzeitabhaengigkeiten vorhanden: ${dependencies.join(", ")}\n`);
}

module.exports = {
  findMissingRuntimeDependencies,
  verifyRuntimeDependencies
};
