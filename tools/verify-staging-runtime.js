#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const {
  verifyRuntimeDependencies,
} = require("../services/identity-server/scripts/verify-runtime-dependencies");

const defaultRepoRoot = path.resolve(__dirname, "..");

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function resolveLocalModule(request, sourceFile) {
  const base = path.resolve(path.dirname(sourceFile), request);
  for (const candidate of [base, `${base}.js`, `${base}.json`, path.join(base, "index.js")]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate;
  }
  return null;
}

function literalPathArguments(argumentSource) {
  const values = [];
  const stringPattern = /(["'])([^"']*)\1/g;
  let match;
  while ((match = stringPattern.exec(argumentSource))) values.push(match[2]);
  const remainder = argumentSource.replace(stringPattern, "").replace(/[\s,]/g, "");
  return remainder ? null : values;
}

function discoverIdentityRuntimePaths({
  repoRoot = defaultRepoRoot,
  entryFile = path.join(repoRoot, "services", "identity-server", "src", "dev-server.js"),
} = {}) {
  const queue = [entryFile];
  const visited = new Set();
  const requiredPaths = new Set(["docker/healthcheck.js"]);

  while (queue.length > 0) {
    const sourceFile = queue.shift();
    if (visited.has(sourceFile)) continue;
    visited.add(sourceFile);
    const source = fs.readFileSync(sourceFile, "utf8");

    for (const match of source.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)) {
      if (!match[1].startsWith(".")) continue;
      const resolved = resolveLocalModule(match[1], sourceFile);
      if (!resolved) {
        throw new Error(`Nicht aufloesbarer relativer Runtime-Import in ${path.relative(repoRoot, sourceFile)}: ${match[1]}`);
      }
      if (!isInside(repoRoot, resolved)) continue;
      requiredPaths.add(path.relative(repoRoot, resolved).split(path.sep).join("/"));
      if (resolved.endsWith(".js")) queue.push(resolved);
    }

    for (const match of source.matchAll(/path\.(?:join|resolve)\(\s*(workspaceRoot|__dirname)\s*,([\s\S]*?)\)/g)) {
      const argumentsList = literalPathArguments(match[2]);
      if (!argumentsList || argumentsList.length === 0) continue;
      const base = match[1] === "workspaceRoot" ? repoRoot : path.dirname(sourceFile);
      const resolved = path.resolve(base, ...argumentsList);
      if (resolved === repoRoot || !isInside(repoRoot, resolved)) continue;
      const relative = path.relative(repoRoot, resolved).split(path.sep).join("/");
      if (relative === ".runtime" || relative.startsWith(".runtime/")) continue;
      requiredPaths.add(relative);
    }
  }

  return [...requiredPaths].sort();
}

function dockerCopySources(dockerfileContent) {
  const sources = [];
  for (const rawLine of dockerfileContent.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith("COPY ")) continue;
    const tokens = line.slice(5).trim().split(/\s+/).filter((token) => !token.startsWith("--"));
    for (const source of tokens.slice(0, -1)) sources.push(source.replace(/^\.\//, "").replace(/\/$/, ""));
  }
  return sources;
}

function isCoveredByCopy(requiredPath, copySources) {
  return copySources.some((source) => requiredPath === source || requiredPath.startsWith(`${source}/`));
}

function verifyDockerfileCopySources({
  repoRoot = defaultRepoRoot,
  dockerfiles = fs.readdirSync(path.join(repoRoot, "docker"))
    .filter((name) => name.endsWith(".Dockerfile"))
    .map((name) => ({ name, content: fs.readFileSync(path.join(repoRoot, "docker", name), "utf8") })),
} = {}) {
  const absentSources = [];
  let copySourceCount = 0;
  for (const dockerfile of dockerfiles) {
    for (const source of dockerCopySources(dockerfile.content)) {
      copySourceCount += 1;
      if (!fs.existsSync(path.join(repoRoot, source))) absentSources.push(`${dockerfile.name}: ${source}`);
    }
  }
  if (absentSources.length > 0) {
    throw new Error(`Dockerfiles kopieren nicht vorhandene Quellen: ${absentSources.join(", ")}`);
  }
  return { dockerfileCount: dockerfiles.length, copySourceCount };
}

function verifyIdentityImageClosure({
  repoRoot = defaultRepoRoot,
  dockerfileContent = fs.readFileSync(path.join(repoRoot, "docker", "identity-service.Dockerfile"), "utf8"),
} = {}) {
  const requiredPaths = discoverIdentityRuntimePaths({ repoRoot });
  const copySources = dockerCopySources(dockerfileContent);
  const absentSources = copySources.filter((source) => !fs.existsSync(path.join(repoRoot, source)));
  const uncoveredPaths = requiredPaths.filter((requiredPath) => !isCoveredByCopy(requiredPath, copySources));

  if (absentSources.length > 0) {
    throw new Error(`Identity-Dockerfile kopiert nicht vorhandene Quellen: ${absentSources.join(", ")}`);
  }
  if (uncoveredPaths.length > 0) {
    throw new Error(`Identity-Image fehlen erkannte Workspace-Laufzeitpfade: ${uncoveredPaths.join(", ")}`);
  }

  return { copySources, requiredPaths };
}

function verifyStagingRuntime({ repoRoot = defaultRepoRoot } = {}) {
  verifyRuntimeDependencies({
    packageJsonPath: path.join(repoRoot, "services", "identity-server", "package.json"),
    nodeModulesDirectory: path.join(repoRoot, "services", "identity-server", "node_modules"),
    workspaceRoot: repoRoot,
  });
  const identity = verifyIdentityImageClosure({ repoRoot });
  const dockerfiles = verifyDockerfileCopySources({ repoRoot });
  return { ...identity, ...dockerfiles };
}

if (require.main === module) {
  try {
    const report = verifyStagingRuntime();
    process.stdout.write(`Staging-Runtime-Vorpruefung bestanden: ${report.requiredPaths.length} Identity-Pfade, ${report.copySourceCount} COPY-Quellen in ${report.dockerfileCount} Runtime-Dockerfiles.\n`);
  } catch (error) {
    process.stderr.write(`Staging-Runtime-Vorpruefung fehlgeschlagen: ${error.message}\n`);
    process.exitCode = 1;
  }
}

module.exports = {
  discoverIdentityRuntimePaths,
  dockerCopySources,
  isCoveredByCopy,
  verifyDockerfileCopySources,
  verifyIdentityImageClosure,
  verifyStagingRuntime,
};
