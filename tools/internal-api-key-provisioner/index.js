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

// Zuordnung der Aussteller zu ihren Praefixen in der VPS-Konfiguration. Nur
// diese Aussteller werden im Staging-Deployment tatsaechlich verteilt.
const DEPLOYMENT_SIGNERS = Object.freeze([
  Object.freeze({ prefix: "IDENTITY", issuer: "identity-server" }),
  Object.freeze({ prefix: "ADMIN_TOOL", issuer: "admin-tool" }),
  Object.freeze({ prefix: "ADMIN_ACCESS", issuer: "admin-access-server" }),
  Object.freeze({ prefix: "BUILD_DEPLOY", issuer: "build-deploy-server" }),
  Object.freeze({ prefix: "TELEMETRY", issuer: "telemetry-server" }),
  Object.freeze({ prefix: "DEVICE_VOICE", issuer: "device-voice-orchestrator" }),
]);

function parseArguments(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--output" || argument === "--version" || argument === "--previous-trust-ring" || argument === "--verify-env") {
      const value = argv[++index];
      if (!value || value.startsWith("--")) throw new Error(`${argument} benoetigt einen Wert.`);
      if (argument === "--output") options.output = value;
      else if (argument === "--version") options.version = value;
      else if (argument === "--verify-env") options.verifyEnv = value;
      else options.previousTrustRing = value;
    }
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error(`Unbekannte Option: ${argument}`);
  }
  if (options.verifyEnv && (options.output || options.version || options.previousTrustRing)) {
    throw new Error("--verify-env prueft nur eine vorhandene Konfiguration und erzeugt keine Schluessel.");
  }
  return options;
}

function usage() {
  return [
    "Verwendung:",
    "  node index.js --output <leeres-verzeichnis-ausserhalb-des-repos> --version <version-oder-datum> [--previous-trust-ring <public-trust-ring.json>]",
    "  node index.js --verify-env <env-datei>",
    "",
    "Beispiele:",
    "  node index.js --output /secure/gernetix/internal-api-keys-2026-09 --version 2026-09",
    "  node index.js --verify-env /opt/gernetix/.env.vps",
    "",
    "--verify-env prueft eine vorhandene Konfiguration kryptografisch und erzeugt",
    "oder veraendert dabei nichts. Eine Rotation erfolgt ausschliesslich ueber einen",
    "ausdruecklichen Lauf mit --output und --version.",
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

function parseEnvironmentFile(content) {
  const values = {};
  for (const rawLine of String(content).split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

// Akzeptiert sowohl den Ring des Provisioners ({version, keys: [...]}) als auch
// die flache Zuordnung kid -> {issuer, publicKeyB64}, die die Dienste ebenfalls lesen.
function readTrustRingKeys(rawTrustRing) {
  if (!String(rawTrustRing || "")) throw new Error("Der oeffentliche Trust-Ring fehlt in der Konfiguration.");
  let parsed;
  try { parsed = JSON.parse(rawTrustRing); } catch { throw new Error("Der oeffentliche Trust-Ring ist kein gueltiges JSON."); }
  const entries = Array.isArray(parsed?.keys)
    ? parsed.keys.map((entry) => [entry?.kid, entry])
    : Object.entries(parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {});
  if (entries.length === 0) throw new Error("Der oeffentliche Trust-Ring enthaelt keine Schluessel.");
  const keys = new Map();
  for (const [kid, descriptor] of entries) {
    if (typeof kid !== "string" || !kid || !descriptor || typeof descriptor !== "object") {
      throw new Error("Der oeffentliche Trust-Ring enthaelt einen unvollstaendigen Eintrag.");
    }
    if (keys.has(kid)) throw new Error("Der oeffentliche Trust-Ring enthaelt eine doppelte KID.");
    let publicKey;
    try {
      publicKey = crypto.createPublicKey({ key: Buffer.from(String(descriptor.publicKeyB64 || ""), "base64"), format: "der", type: "spki" });
    } catch { throw new Error(`Der Trust-Ring-Eintrag fuer den Aussteller ${describeIssuer(descriptor.issuer)} ist kein lesbarer Schluessel.`); }
    if (publicKey.asymmetricKeyType !== "ed25519") {
      throw new Error(`Der Trust-Ring-Eintrag fuer den Aussteller ${describeIssuer(descriptor.issuer)} ist kein Ed25519-Schluessel.`);
    }
    keys.set(kid, { issuer: String(descriptor.issuer || ""), publicKey });
  }
  return keys;
}

function describeIssuer(issuer) {
  const value = String(issuer || "");
  return SIGNERS.includes(value) ? value : "unbekannt";
}

// Prueft eine bereits verteilte Konfiguration kryptografisch. Ein vorhandener,
// aber ungueltiger Platzhalter gilt ausdruecklich als Fehler. Es werden
// ausschliesslich Statusangaben zurueckgegeben, niemals Schluesselwerte.
function verifyEnvironmentKeyset({ envFile, signers = DEPLOYMENT_SIGNERS } = {}) {
  if (!envFile) throw new Error("--verify-env benoetigt den Pfad einer Konfigurationsdatei.");
  const values = parseEnvironmentFile(fs.readFileSync(path.resolve(envFile), "utf8"));
  const trustRing = readTrustRingKeys(values.INTERNAL_API_TRUSTED_PUBLIC_KEYS_JSON);
  const probe = Buffer.from("gernetix-internal-api-keyset-verification");
  const problems = [];
  const checked = [];

  for (const { prefix, issuer } of signers) {
    const kid = String(values[`${prefix}_INTERNAL_API_SIGNING_KEY_ID`] || "");
    const privateKeyB64 = String(values[`${prefix}_INTERNAL_API_SIGNING_PRIVATE_KEY_B64`] || "");
    if (!kid || !privateKeyB64) { problems.push(`${issuer}: Key-ID oder privater Schluessel fehlt.`); continue; }
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(kid)) { problems.push(`${issuer}: Die Key-ID hat kein gueltiges Format.`); continue; }
    const trusted = trustRing.get(kid);
    if (!trusted) { problems.push(`${issuer}: Die aktive Key-ID fehlt im oeffentlichen Trust-Ring.`); continue; }
    if (trusted.issuer && trusted.issuer !== issuer) { problems.push(`${issuer}: Die aktive Key-ID gehoert im Trust-Ring zu einem anderen Aussteller.`); continue; }

    let privateKey;
    try {
      privateKey = crypto.createPrivateKey({ key: Buffer.from(privateKeyB64, "base64"), format: "der", type: "pkcs8" });
    } catch { problems.push(`${issuer}: Der private Schluessel ist kein lesbares PKCS8-DER.`); continue; }
    if (privateKey.asymmetricKeyType !== "ed25519") { problems.push(`${issuer}: Der private Schluessel ist kein Ed25519-Schluessel.`); continue; }

    let matches = false;
    try { matches = crypto.verify(null, probe, trusted.publicKey, crypto.sign(null, probe, privateKey)); } catch { matches = false; }
    if (!matches) { problems.push(`${issuer}: Privater Schluessel und Trust-Ring-Eintrag gehoeren nicht zusammen.`); continue; }
    checked.push(issuer);
  }

  if (problems.length > 0) {
    throw new Error(`Die vorhandene interne API-Schluesselkonfiguration ist ungueltig:\n  - ${problems.join("\n  - ")}`);
  }
  return { trustRingKeyCount: trustRing.size, verifiedSigners: checked };
}

function main(argv = process.argv.slice(2), logger = console) {
  const options = parseArguments(argv);
  if (options.help) {
    logger.log(usage());
    return { help: true };
  }
  if (options.verifyEnv) {
    const verification = verifyEnvironmentKeyset({ envFile: options.verifyEnv });
    logger.log(`Interne API-Schluessel geprueft: ${verification.verifiedSigners.length} Aussteller, ${verification.trustRingKeyCount} Trust-Ring-Schluessel.`);
    logger.log("Jeder private Schluessel ist ein gueltiger Ed25519-Schluessel und passt zu seinem Trust-Ring-Eintrag.");
    return { verified: true, ...verification };
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
  DEPLOYMENT_SIGNERS,
  SIGNERS,
  generateProvisioningBundle,
  main,
  parseArguments,
  parseEnvironmentFile,
  prepareOutputDirectory,
  readPreviousTrustKeys,
  readTrustRingKeys,
  rotationInstructions,
  validateVersion,
  verifyEnvironmentKeyset,
};
