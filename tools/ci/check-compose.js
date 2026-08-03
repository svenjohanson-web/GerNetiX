"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const repoRoot = path.resolve(__dirname, "..", "..");
const composeModels = [
  { file: "compose.vps.yaml", envFile: ".env.vps.example" },
  { file: "compose.build-worker.yaml", envFile: ".env.build-worker.example" },
  { file: "compose.public-demo.vps.yaml", envFile: ".env.public-demo.vps.example" },
  { file: "compose.flashbox-build-test.yaml" },
  { file: "infra/dev/docker-compose.yml" },
  { file: "tools/forgejo-integration/compose.yaml" },
  { file: "tools/forgejo-backup-restore-test.compose.yaml" },
];

function requiredVariables(source) {
  return [...source.matchAll(/\$\{([A-Za-z_][A-Za-z0-9_]*):\?[^}]*\}/g)]
    .map((match) => match[1]);
}

function exampleEnvironment(envFile) {
  if (!envFile) return {};
  return Object.fromEntries(
    fs.readFileSync(path.join(repoRoot, envFile), "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

function validate(model) {
  const source = fs.readFileSync(path.join(repoRoot, model.file), "utf8");
  const environment = { ...process.env };
  const examples = exampleEnvironment(model.envFile);
  for (const variable of requiredVariables(source)) {
    if (!environment[variable]) {
      environment[variable] = examples[variable] || `ci-placeholder-${variable.toLowerCase()}`;
    }
  }

  const args = ["compose"];
  if (model.envFile) args.push("--env-file", model.envFile);
  args.push("-f", model.file, "config", "--quiet");
  const result = spawnSync("docker", args, {
    cwd: repoRoot,
    env: environment,
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stdout || "");
    process.stderr.write(result.stderr || "");
    throw new Error(`Compose validation failed for ${model.file}`);
  }
  console.log(`Compose model valid: ${model.file}`);
}

for (const model of composeModels) validate(model);
