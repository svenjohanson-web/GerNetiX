"use strict";

// Das Manifest ist der einzige verbindliche Nachweis darueber, was ein
// Sicherungssatz enthaelt und mit welcher Konsistenzgarantie er erzeugt wurde.
// Es liegt selbst verschluesselt vor und wird vor jedem Restore geprueft.

const MANIFEST_VERSION = 1;
const MANIFEST_MEMBER_NAME = "manifest.json";

const BACKUP_MODES = ["hourly", "daily"];

// Konsistenzarten, mit denen ein Bestandteil erzeugt worden sein kann.
const CONSISTENCY_KINDS = [
  "transactional_dump", // pg_dump in einer eigenen Transaktion
  "stopped_service_snapshot", // Dienst kontrolliert gestoppt, danach kopiert
  "online_snapshot", // im laufenden Betrieb kopiert
  "content_addressed", // ueber den Inhaltshash der Einzelobjekte gesichert
];

// Bereiche, die jeder Sicherungssatz fuehren muss. Ein Satz ohne einen dieser
// Bereiche ist kein Wiederherstellungspunkt fuer Kundendaten.
const REQUIRED_AREAS = ["runtime_database", "forgejo_database", "forgejo_data", "artifact_store"];

// Bereiche, die nur bei Aenderung und monatlich vollstaendig mitlaufen.
const OPTIONAL_AREAS = ["recovery_secrets"];

const KNOWN_AREAS = [...REQUIRED_AREAS, ...OPTIONAL_AREAS];

// Die Konsistenzgarantie fuer Projektdateien haengt am Modus: stuendlich wird
// Forgejo online gesichert, der garantiert gemeinsame Punkt entsteht taeglich.
const FORGEJO_CONSISTENCY_BY_MODE = {
  hourly: "online_snapshot",
  daily: "stopped_service_snapshot",
};

function createManifest(input) {
  const manifest = {
    manifest_version: MANIFEST_VERSION,
    backup_id: requireBackupId(input.backupId),
    created_at: requireTimestamp(input.createdAt),
    mode: requireMode(input.mode),
    source_instance: requireText(input.sourceInstance, "Quellinstanz", 128),
    application_version: requireText(input.applicationVersion, "Anwendungsversion", 128),
    schema_versions: normalizeSchemaVersions(input.schemaVersions),
    forgejo_version: requireText(input.forgejoVersion, "Forgejo-Version", 128),
    forgejo_consistency: FORGEJO_CONSISTENCY_BY_MODE[requireMode(input.mode)],
    recovery_key_id: requireHash(input.recoveryKeyId, "Recovery-Key-ID"),
    members: (input.members || []).map(normalizeMember).sort((a, b) => a.name.localeCompare(b.name)),
    carried_forward_artifacts: normalizeCarriedForward(input.carriedForwardArtifacts),
  };
  if (!manifest.backup_id.includes(`-${manifest.mode}-`)) {
    throw new Error(`Backup-ID ${manifest.backup_id} nennt nicht den Sicherungsmodus ${manifest.mode}.`);
  }
  assertMembersAreUnique(manifest.members);
  assertRequiredAreasArePresent(manifest);
  assertForgejoConsistencyMatchesMembers(manifest);
  return manifest;
}

function normalizeMember(member) {
  const name = requireMemberName(member?.name);
  const area = String(member?.area || "");
  if (!KNOWN_AREAS.includes(area)) throw new Error(`Unbekannter Datenbereich im Manifest: ${area}`);
  const consistency = String(member?.consistency || "");
  if (!CONSISTENCY_KINDS.includes(consistency)) throw new Error(`Unbekannte Konsistenzart im Manifest: ${consistency}`);
  return {
    name,
    area,
    consistency,
    sha256: requireHash(member?.sha256, `Pruefsumme von ${name}`),
    size_bytes: requireSize(member?.sizeBytes ?? member?.size_bytes, `Groesse von ${name}`),
    encrypted_sha256: requireHash(member?.encryptedSha256 ?? member?.encrypted_sha256, `Objektpruefsumme von ${name}`),
    encrypted_size_bytes: requireSize(
      member?.encryptedSizeBytes ?? member?.encrypted_size_bytes,
      `Objektgroesse von ${name}`,
    ),
  };
}

// Der Artifact Store wird inkrementell gesichert. Damit ein Restore trotzdem
// vollstaendig ist, nennt jeder Satz die Objekte, die er aus frueheren
// Sicherungssaetzen uebernimmt, samt des Satzes, der sie fuehrt.
function normalizeCarriedForward(value) {
  if (!value) return [];
  if (!Array.isArray(value)) throw new Error("Uebernommene Artefakte muessen eine Liste sein.");
  const entries = value.map((entry) => ({
    sha256: requireHash(entry?.sha256, "Uebernommenes Artefakt"),
    backup_id: requireBackupId(entry?.backupId ?? entry?.backup_id),
  }));
  const seen = new Set();
  for (const entry of entries) {
    if (seen.has(entry.sha256)) throw new Error(`Uebernommenes Artefakt ist doppelt gelistet: ${entry.sha256}`);
    seen.add(entry.sha256);
  }
  return entries.sort((a, b) => a.sha256.localeCompare(b.sha256));
}

function normalizeSchemaVersions(value) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const entries = Object.keys(source)
    .sort()
    .map((key) => [requireText(key, "Schema-Name", 64), requireText(source[key], `Schemaversion ${key}`, 64)]);
  if (!entries.length) throw new Error("Ein Sicherungssatz muss mindestens eine Schemaversion nennen.");
  return Object.fromEntries(entries);
}

function assertMembersAreUnique(members) {
  const names = new Set();
  for (const member of members) {
    if (names.has(member.name)) throw new Error(`Bestandteil ist doppelt im Manifest: ${member.name}`);
    names.add(member.name);
  }
}

function assertRequiredAreasArePresent(manifest) {
  const areas = new Set(manifest.members.map((member) => member.area));
  const missing = REQUIRED_AREAS.filter((area) => !areas.has(area));
  if (missing.length) throw new Error(`Sicherungssatz deckt Pflichtbereiche nicht ab: ${missing.join(", ")}`);
}

// Ein Satz darf nicht behaupten, gestoppt erzeugt worden zu sein, waehrend seine
// Forgejo-Bestandteile aus dem laufenden Betrieb stammen.
function assertForgejoConsistencyMatchesMembers(manifest) {
  const expected = manifest.forgejo_consistency;
  for (const member of manifest.members) {
    if (member.area !== "forgejo_database" && member.area !== "forgejo_data") continue;
    if (member.consistency !== expected) {
      throw new Error(
        `Forgejo-Bestandteil ${member.name} ist als ${member.consistency} gesichert, ` +
          `der Modus ${manifest.mode} verlangt ${expected}.`,
      );
    }
  }
}

// Kanonische Ausgabe: fest sortiert, damit die Pruefsumme eines Manifests
// reproduzierbar ist und ein Vergleich zweier Saetze aussagekraeftig bleibt.
function serializeManifest(manifest) {
  return `${JSON.stringify(manifest, null, 2)}\n`;
}

function parseManifest(content) {
  let parsed;
  try {
    parsed = JSON.parse(String(content || ""));
  } catch {
    throw new Error("Manifest ist kein gueltiges JSON.");
  }
  if (parsed?.manifest_version !== MANIFEST_VERSION) {
    throw new Error(`Nicht unterstuetzte Manifestversion: ${parsed?.manifest_version}`);
  }
  return createManifest({
    backupId: parsed.backup_id,
    createdAt: parsed.created_at,
    mode: parsed.mode,
    sourceInstance: parsed.source_instance,
    applicationVersion: parsed.application_version,
    schemaVersions: parsed.schema_versions,
    forgejoVersion: parsed.forgejo_version,
    recoveryKeyId: parsed.recovery_key_id,
    members: parsed.members,
    carriedForwardArtifacts: parsed.carried_forward_artifacts,
  });
}

// Nur der garantiert gemeinsam konsistente Satz taugt als Ausgangspunkt fuer
// einen vollstaendigen Wiederaufbau der Projektdateien.
function isJointlyConsistentRestorePoint(manifest) {
  return manifest.mode === "daily" && manifest.forgejo_consistency === "stopped_service_snapshot";
}

function requireBackupId(value) {
  const text = String(value || "");
  if (!/^[0-9]{8}T[0-9]{6}Z-(?:hourly|daily)-[a-f0-9]{16}$/.test(text)) {
    throw new Error(`Backup-ID hat nicht das erwartete Format: ${text}`);
  }
  return text;
}

function requireTimestamp(value) {
  const text = String(value || "");
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(text) || Number.isNaN(Date.parse(text))) {
    throw new Error("Erstellungszeit muss ein UTC-Zeitstempel nach ISO 8601 sein.");
  }
  return text;
}

function requireMode(value) {
  const text = String(value || "");
  if (!BACKUP_MODES.includes(text)) throw new Error(`Unbekannter Sicherungsmodus: ${text}`);
  return text;
}

function requireMemberName(value) {
  const text = String(value || "");
  if (!/^[a-z0-9][a-z0-9._-]{0,63}$/.test(text) || text.includes("..")) {
    throw new Error(`Bestandteilname ist nicht zulaessig: ${text}`);
  }
  return text;
}

function requireHash(value, label) {
  const text = String(value || "").toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(text)) throw new Error(`${label} ist kein SHA-256-Wert.`);
  return text;
}

function requireSize(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) throw new Error(`${label} ist keine gueltige Byte-Angabe.`);
  return value;
}

function requireText(value, label, maxLength) {
  const text = String(value ?? "").trim();
  if (!text || text.length > maxLength || hasControlCharacters(text)) {
    throw new Error(`${label} fehlt oder ist unzulaessig.`);
  }
  return text;
}

function hasControlCharacters(text) {
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

module.exports = {
  CONSISTENCY_KINDS,
  FORGEJO_CONSISTENCY_BY_MODE,
  KNOWN_AREAS,
  MANIFEST_MEMBER_NAME,
  MANIFEST_VERSION,
  OPTIONAL_AREAS,
  REQUIRED_AREAS,
  createManifest,
  isJointlyConsistentRestorePoint,
  parseManifest,
  serializeManifest,
};
