"use strict";

// Erzeugt die Test-Matrix fuer alle Services unter services/.
// Grundregel: Jeder Service laeuft in der CI. Ausnahmen stehen mit Begruendung
// in tools/ci/ci-test-policy.json und muessen dort bewusst eingetragen werden.
//
// Wird sowohl von der CI (als CLI) als auch vom lokalen Runner
// tools/ci/verify.js (als Modul) genutzt, damit beide dieselbe Liste sehen.

const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..", "..");
const servicesRoot = path.join(repoRoot, "services");

function resolveServiceMatrix() {
  const policy = JSON.parse(fs.readFileSync(path.join(__dirname, "ci-test-policy.json"), "utf8"));
  const skipPatterns = policy.serviceSkipPatterns || {};
  const excluded = policy.excludedServices || {};

  const services = fs
    .readdirSync(servicesRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((name) => fs.existsSync(path.join(servicesRoot, name, "package.json")))
    .sort();

  const problems = [];
  const include = [];

  for (const name of services) {
    if (excluded[name]) continue;

    const serviceDir = path.join(servicesRoot, name);
    const manifest = JSON.parse(fs.readFileSync(path.join(serviceDir, "package.json"), "utf8"));
    const scripts = manifest.scripts || {};

    // npm ci bricht ohne Lockfile ab. Lieber hier mit klarer Meldung scheitern,
    // als den Service still aus der Matrix fallen zu lassen.
    if (!fs.existsSync(path.join(serviceDir, "package-lock.json"))) {
      problems.push(`services/${name}: package-lock.json fehlt (npm install --package-lock-only)`);
      continue;
    }
    if (!scripts.test) {
      problems.push(`services/${name}: npm-Skript "test" fehlt`);
      continue;
    }
    if (!scripts.check) {
      problems.push(`services/${name}: npm-Skript "check" fehlt`);
      continue;
    }

    include.push({
      label: name,
      workspace: `services/${name}`,
      skipPattern: skipPatterns[name]?.pattern || "",
    });
  }

  return { include, problems };
}

function main() {
  const { include, problems } = resolveServiceMatrix();

  if (problems.length) {
    console.error("Service-Matrix unvollstaendig:\n");
    for (const problem of problems) console.error(`  - ${problem}`);
    console.error("\nEntweder den Service reparieren oder ihn in tools/ci/ci-test-policy.json");
    console.error("unter excludedServices mit Begruendung eintragen.");
    process.exit(1);
  }

  const matrix = JSON.stringify({ include });

  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `matrix=${matrix}\n`);
    console.log(`Service-Matrix: ${include.length} Services`);
    for (const entry of include) {
      const suffix = entry.skipPattern ? " (mit Skip-Pattern)" : "";
      console.log(`  - ${entry.label}${suffix}`);
    }
  } else {
    console.log(matrix);
  }
}

if (require.main === module) main();

module.exports = { repoRoot, resolveServiceMatrix };
