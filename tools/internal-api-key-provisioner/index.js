"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const SIGNERS = Object.freeze([
  "identity-server",
  "admin-tool",
  "admin-access-server",
  "build-deploy-server",
  "telemetry-server",
  "device-voice-orchestrator",
  "community-ai-assistant",
  "recovery-tool",
  "provisioning-tool",
]);

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--output" || argument === "--version" || argument === "--previous-trust-ring") {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error(`${argument} benoetigt einen Wert.`);
      if (argument === "--output") options.output = value;
      else if (argument === "--version") options.version = value;
      else options.previousTrustRing = value;
    }
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error(`Unbekannte Option: ${argument}`);
  }
  return options;
}

function usage() {
  return [
    "Verwendung:",
    "  node index.js --output <leeres-verzeichnis-ausserhalb-des-repos> --version <version-oder-datum> [--previous-trust-ring <public-trust-ring.json>]",
    "",
    "Beispiel:",
    "  node index.js --output /secure/gernetix/internal-api-keys-2026-09 --version 2026-09",
  ].join("\n");
}

function validateVersion(value) {
  const version = String(value || "");
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,47}$/.test(version)) {
    throw new Error("--version muss 1 bis 48 sichere Zeichen enthalten (A-Z, a-z, 0-9, Punkt, Unterstrich, Bindestrich). ");
  }
  return version;
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

function prepareOutputDirectory(output, { repoRoot }) {
  if (!output) throw new Error("--output ist erforderlich.");
  const target = path.resolve(output);
  const resolvedRepoRoot = path.resolve(repoRoot);
  const canonicalRepoRoot = fs.existsSync(resolvedRepoRoot) ? fs.realpathSync(resolvedRepoRoot) : resolvedRepoRoot;
  const canonicalTarget = fs.existsSync(target)
    ? fs.realpathSync(target)
    : path.join(fs.realpathSync(path.dirname(target)), path.basename(target));
  if (isInside(canonicalRepoRoot, canonicalTarget)) {
    throw new Error("Das Zielverzeichnis muss ausserhalb des Repositorys liegen.");
  }
  if (fs.existsSync(target)) {
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink()) throw new Error("Das Zielverzeichnis darf kein symbolischer Link sein.");
    if (!stat.isDirectory()) throw new Error("Das Ziel muss ein Verzeichnis sein.");
    if (fs.readdirSync(target).length !== 0) throw new Error("Das Zielverzeichnis muss leer sein.");
    fs.chmodSync(target, 0o700);
  } else {
    fs.mkdirSync(target, { recursive: false, mode: 0o700 });
  }
  return target;
}

function writeExclusive(file, content, mode) {
  fs.writeFileSync(file, content, { encoding: "utf8", flag: "wx", mode });
  fs.chmodSync(file, mode);
}

function readPreviousTrustKeys(file) {
  if (!file) return [];
  const parsed = JSON.parse(fs.readFileSync(path.resolve(file), "utf8"));
  if (parsed?.version !== 1 || parsed?.algorithm !== "Ed25519" || !Array.isArray(parsed.keys)) {
    throw new Error("Der bisherige Trust Ring hat kein unterstuetztes Ed25519-v1-Format.");
  }
  const seen = new Set();
  return parsed.keys.map((entry) => {
    if (!entry || typeof entry.kid !== "string" || !entry.kid || !SIGNERS.includes(entry.issuer)
      || entry.algorithm !== "Ed25519" || typeof entry.publicKeyB64 !== "string" || !entry.publicKeyB64) {
      throw new Error("Der bisherige Trust Ring enthaelt einen ungueltigen oder nicht erlaubten Key.");
    }
    if (seen.has(entry.kid)) throw new Error("Der bisherige Trust Ring enthaelt eine doppelte KID.");
    seen.add(entry.kid);
    try {
      const publicKey = crypto.createPublicKey({ key: Buffer.from(entry.publicKeyB64, "base64"), format: "der", type: "spki" });
      if (publicKey.asymmetricKeyType !== "ed25519") throw new Error("wrong_key_type");
    } catch {
      throw new Error("Der bisherige Trust Ring enthaelt keinen gueltigen Ed25519-Public-Key.");
    }
    return {
      kid: entry.kid,
      issuer: entry.issuer,
      algorithm: "Ed25519",
      publicKeyB64: entry.publicKeyB64,
      format: "SPKI-DER",
      encoding: "base64",
    };
  });
}

function generateProvisioningBundle({ output, version, previousTrustRing, repoRoot = path.resolve(__dirname, "../.."), now = new Date() }) {
  const safeVersion = validateVersion(version);
  const previousTrustKeys = readPreviousTrustKeys(previousTrustRing);
  for (const issuer of SIGNERS) {
    const kid = `${issuer}-${safeVersion}`;
    if (previousTrustKeys.some((entry) => entry.kid === kid)) {
      throw new Error(`Die neue KID ${kid} ist bereits im bisherigen Trust Ring enthalten.`);
    }
  }
  const target = prepareOutputDirectory(output, { repoRoot });
  const privateDirectory = path.join(target, "private");
  fs.mkdirSync(privateDirectory, { mode: 0o700 });
  const generatedAt = new Date(now).toISOString();
  const trustKeys = [];
  const privateFiles = [];

  for (const issuer of SIGNERS) {
    const kid = `${issuer}-${safeVersion}`;
    const { privateKey, publicKey } = crypto.generateKeyPairSync("ed25519");
    const privateKeyB64 = privateKey.export({ format: "der", type: "pkcs8" }).toString("base64");
    const publicKeyB64 = publicKey.export({ format: "der", type: "spki" }).toString("base64");
    const relativePrivateFile = `private/${issuer}.pkcs8.der.b64`;
    writeExclusive(path.join(target, relativePrivateFile), `${privateKeyB64}\n`, 0o600);
    privateFiles.push({ issuer, kid, file: relativePrivateFile, format: "PKCS8-DER", encoding: "base64" });
    trustKeys.push({ kid, issuer, algorithm: "Ed25519", publicKeyB64, format: "SPKI-DER", encoding: "base64" });
  }

  const trustRing = {
    version: 1,
    generatedAt,
    algorithm: "Ed25519",
    keys: [...previousTrustKeys, ...trustKeys],
  };
  const manifest = {
    version: 1,
    generatedAt,
    keyVersion: safeVersion,
    previousPublicKeyCount: previousTrustKeys.length,
    signerCount: SIGNERS.length,
    signers: privateFiles,
    publicTrustRing: "public-trust-ring.json",
    privateFileMode: "0600",
    directoryMode: "0700",
    containsSecrets: ["private/*.pkcs8.der.b64"],
  };
  writeExclusive(path.join(target, "public-trust-ring.json"), `${JSON.stringify(trustRing, null, 2)}\n`, 0o644);
  writeExclusive(path.join(target, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`, 0o600);
  writeExclusive(path.join(target, "ROTATION.md"), rotationInstructions({ version: safeVersion, generatedAt }), 0o600);
  return { target, signerCount: SIGNERS.length, manifest, trustRing };
}

function rotationInstructions({ version, generatedAt }) {
  return `# GerNetiX interne API-Schluesselrotation

Erzeugt: ${generatedAt}
Schluesselversion: ${version}

Dieses Verzeichnis enthaelt private Signaturschluessel. Es darf weder in Git
aufgenommen noch an pruefende Dienste verteilt werden.

## Empfohlener Ablauf

1. Den neuen oeffentlichen Trust-Ring zunaechst auf allen pruefenden Diensten
   zusaetzlich zum bisherigen Trust-Ring installieren.
2. Pro ausstellendem Dienst ausschliesslich dessen private PKCS8-Datei ueber
   den Secret Store bereitstellen. Kein Dienst erhaelt fremde private Keys.
3. Die aktive KID des Ausstellers auf die neue KID aus manifest.json umstellen.
4. Waehrend mindestens der maximalen Token-Lebensdauer plus Taktabweichung
   beide oeffentlichen Generationen akzeptieren.
5. Alte oeffentliche Keys danach entfernen und alte private Keys widerrufen
   beziehungsweise nach der Aufbewahrungsrichtlinie sicher vernichten.
6. Negative Tests fuer unbekannte KID, falschen Issuer, falsche Audience,
   abgelaufene Tokens und Signaturen mit einem fremden Dienstschluessel ausfuehren.

Bei vermuteter Kompromittierung entfaellt die Ueberlappung fuer den betroffenen
Key: Signierung stoppen, KID aus allen Trust-Ringen entfernen, neue Version
provisionieren und den Vorfall auditieren.
`;
}

function main(argv = process.argv.slice(2), logger = console) {
  const options = parseArguments(argv);
  if (options.help) {
    logger.log(usage());
    return { help: true };
  }
  const result = generateProvisioningBundle(options);
  logger.log(`${result.signerCount} Ed25519-Schluesselpaare wurden sicher unter ${result.target} erzeugt.`);
  logger.log("Private Schluesselwerte wurden nicht ausgegeben.");
  return result;
}

if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(`Provisionierung fehlgeschlagen: ${error.message}`);
    process.exitCode = 1;
  }
}

module.exports = {
  SIGNERS,
  generateProvisioningBundle,
  main,
  parseArguments,
  prepareOutputDirectory,
  readPreviousTrustKeys,
  rotationInstructions,
  validateVersion,
};
