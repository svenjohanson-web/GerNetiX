"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const ACCESS_CLASSES = new Set([
  "health",
  "public",
  "user",
  "internal-service",
  "delegated-user-action",
  "worker",
  "device",
  "admin",
]);

const DEFAULT_MANIFEST = path.join(__dirname, "route-classification.json");
const DEFAULT_INVENTORY = "docs/internal-api-access-inventory.md";

function normalizePath(value) {
  return value.split(path.sep).join("/");
}

function normalizeContent(value) {
  return value.replace(/\r\n/g, "\n");
}

function walk(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      if (["node_modules", "test", "tests", "dist", "coverage"].includes(entry.name)) return [];
      return walk(absolute);
    }
    return entry.isFile() && /\.[cm]?js$/.test(entry.name) ? [absolute] : [];
  });
}

function isRouteSource(file, content) {
  if (path.basename(file) === "http-app.js") return true;
  if (/\bregistry\.register\s*\(\s*\{/.test(content)) return true;
  if (/\b(?:app|router)\.(?:get|post|put|patch|delete|options|head)\s*\(/.test(content)) return true;
  return /\b(?:createServer|requestListener)\b/.test(content)
    && /\breq(?:uest)?\.method\b/.test(content);
}

function discoverRouteSources(repoRoot) {
  const servicesRoot = path.join(repoRoot, "services");
  const result = new Map();
  for (const absolute of walk(servicesRoot)) {
    const relative = normalizePath(path.relative(repoRoot, absolute));
    if (!relative.includes("/src/")) continue;
    const content = fs.readFileSync(absolute, "utf8");
    if (!isRouteSource(relative, content)) continue;
    const service = relative.split("/")[1];
    if (!result.has(service)) result.set(service, []);
    result.get(service).push(relative);
  }
  for (const files of result.values()) files.sort();
  return result;
}

function fingerprintFiles(repoRoot, files) {
  const hash = crypto.createHash("sha256");
  for (const file of [...files].sort()) {
    hash.update(file);
    hash.update("\0");
    hash.update(normalizeContent(fs.readFileSync(path.join(repoRoot, file), "utf8")));
    hash.update("\0");
  }
  return `sha256:${hash.digest("hex")}`;
}

function inventoryHeadings(markdown) {
  return new Set([...markdown.matchAll(/^##\s+(.+)$/gm)].map((match) => match[1].trim()));
}

function validateManifest({ repoRoot, manifest }) {
  const errors = [];
  if (manifest.version !== 1) errors.push("Manifest-Version muss 1 sein.");
  const inventoryPath = manifest.inventory || DEFAULT_INVENTORY;
  const inventoryAbsolute = path.join(repoRoot, inventoryPath);
  if (!fs.existsSync(inventoryAbsolute)) {
    errors.push(`Inventardokument fehlt: ${inventoryPath}`);
    return { errors, discovered: discoverRouteSources(repoRoot) };
  }
  const headings = inventoryHeadings(fs.readFileSync(inventoryAbsolute, "utf8"));
  const discovered = discoverRouteSources(repoRoot);
  const classifications = manifest.services || {};

  for (const [service, files] of discovered) {
    const entry = classifications[service];
    if (!entry) {
      errors.push(`Nicht klassifizierter HTTP-Service: ${service} (${files.join(", ")})`);
      continue;
    }
    if (!Array.isArray(entry.classes) || entry.classes.length === 0) {
      errors.push(`${service}: mindestens eine Zugriffsklasse ist erforderlich.`);
    } else {
      for (const accessClass of entry.classes) {
        if (!ACCESS_CLASSES.has(accessClass)) errors.push(`${service}: unbekannte Zugriffsklasse ${accessClass}.`);
      }
    }
    const sections = Array.isArray(entry.inventorySections)
      ? entry.inventorySections
      : entry.inventorySection ? [entry.inventorySection] : [];
    if (sections.length === 0) {
      errors.push(`${service}: mindestens ein Inventarabschnitt ist erforderlich.`);
    }
    for (const section of sections) {
      if (!headings.has(section)) errors.push(`${service}: Inventarabschnitt fehlt oder existiert nicht: ${section}.`);
    }
    const expectedFiles = Array.isArray(entry.files) ? [...entry.files].sort() : [];
    if (JSON.stringify(expectedFiles) !== JSON.stringify(files)) {
      errors.push(`${service}: Routendateien haben sich geaendert. Erwartet [${expectedFiles.join(", ")}], gefunden [${files.join(", ")}].`);
    }
    const actualFingerprint = fingerprintFiles(repoRoot, files);
    if (entry.fingerprint !== actualFingerprint) {
      errors.push(`${service}: Routeninhalt wurde seit der letzten Klassifizierungspruefung geaendert.`);
    }
  }

  for (const service of Object.keys(classifications)) {
    if (!discovered.has(service)) errors.push(`${service}: Manifest-Eintrag hat keine erkannte produktive Routendatei.`);
  }
  return { errors, discovered };
}

function updateReviewedSources({ repoRoot, manifest }) {
  const discovered = discoverRouteSources(repoRoot);
  const known = manifest.services || {};
  const unknown = [...discovered.keys()].filter((service) => !known[service]);
  if (unknown.length) {
    throw new Error(`Neue Services muessen zuerst manuell klassifiziert werden: ${unknown.join(", ")}`);
  }
  for (const [service, entry] of Object.entries(known)) {
    const files = discovered.get(service);
    if (!files) throw new Error(`Keine Routendateien fuer ${service} erkannt.`);
    entry.files = files;
    entry.fingerprint = fingerprintFiles(repoRoot, files);
  }
  return manifest;
}

function run(argv = process.argv.slice(2), options = {}) {
  const repoRoot = options.repoRoot || path.resolve(__dirname, "../..");
  const manifestPath = options.manifestPath || DEFAULT_MANIFEST;
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (argv.includes("--update-reviewed")) {
    updateReviewedSources({ repoRoot, manifest });
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    return { updated: true, manifest };
  }
  const result = validateManifest({ repoRoot, manifest });
  if (result.errors.length) {
    const error = new Error(`HTTP-Routenklassifizierung fehlgeschlagen:\n- ${result.errors.join("\n- ")}\nNach fachlicher Pruefung: npm run routes:accept`);
    error.code = "ROUTE_CLASSIFICATION_FAILED";
    error.errors = result.errors;
    throw error;
  }
  return { updated: false, services: result.discovered.size };
}

if (require.main === module) {
  try {
    const result = run();
    console.log(result.updated
      ? "Routenfingerabdruecke aktualisiert. Manifest bitte fachlich pruefen."
      : `${result.services} HTTP-Services sind vollstaendig klassifiziert.`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

module.exports = {
  ACCESS_CLASSES,
  discoverRouteSources,
  fingerprintFiles,
  isRouteSource,
  updateReviewedSources,
  validateManifest,
  run,
};
