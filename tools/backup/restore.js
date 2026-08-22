"use strict";

// Liest einen Sicherungssatz mit dem Recovery-Key, prueft ihn vollstaendig und
// legt die Bestandteile in einem isolierten Arbeitsverzeichnis ab.
//
// Der Artifact Store wird inkrementell gesichert. Ein einzelner Satz enthaelt
// deshalb nicht alle Objekte; die uebernommenen werden aus den Saetzen
// nachgezogen, die das Manifest benennt. Fehlt auch nur eines davon, ist der
// Wiederherstellungspunkt unvollstaendig und wird abgelehnt.

const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { pipeline } = require("node:stream/promises");

const { MEMBER_NAMES } = require("./orchestrator");
const { openMemberStream, readBackupSet, readManifestOnly, verifyBackupSetIntegrity } = require("./backup-set");
const { readTarEntries } = require("./tar-reader");

const OBJECT_PATH_PATTERN = /^objects\/([a-f0-9]{2})\/([a-f0-9]{64})$/;

async function restoreBackupSet(options) {
  const setDirectory = path.resolve(options.setDirectory);
  const storeDirectory = options.storeDirectory ? path.resolve(options.storeDirectory) : path.dirname(setDirectory);
  const privateKey = options.privateKey;

  const { manifest, restored } = await readBackupSet(setDirectory, privateKey, {
    targetDirectory: options.targetDirectory,
  });
  const artifacts = await verifyArtifactCoverage({
    manifest,
    setDirectory,
    storeDirectory,
    privateKey,
    artifactsDirectory: options.artifactsDirectory,
  });
  return { manifest, restored, artifacts };
}

async function verifyArtifactCoverage({ manifest, setDirectory, storeDirectory, privateKey, artifactsDirectory }) {
  // Wird ein Ausgabeverzeichnis genannt, werden die Archive aller beteiligten
  // Saetze dort abgelegt. Erst damit laesst sich der Artifact Store eines
  // inkrementell gesicherten Punktes vollstaendig wieder aufbauen.
  if (artifactsDirectory) await fsp.mkdir(path.resolve(artifactsDirectory), { recursive: true, mode: 0o700 });
  const readHashes = (directory, backupId) =>
    readArtifactArchive(directory, backupId, privateKey, artifactsDirectory);

  const fromCurrent = await readHashes(setDirectory, manifest.backup_id);

  // Uebernommene Objekte nach dem Satz gruppieren, der sie fuehrt, damit jeder
  // fruehere Satz genau einmal gelesen wird.
  const byBackupId = new Map();
  for (const entry of manifest.carried_forward_artifacts) {
    if (!byBackupId.has(entry.backup_id)) byBackupId.set(entry.backup_id, new Set());
    byBackupId.get(entry.backup_id).add(entry.sha256);
  }

  const fromEarlier = new Set();
  const missingSets = [];
  for (const [backupId, expectedHashes] of byBackupId) {
    const earlierDirectory = path.join(storeDirectory, backupId);
    if (!(await isReadableDirectory(earlierDirectory))) {
      missingSets.push(backupId);
      continue;
    }
    // Auch ein nur zum Nachziehen benoetigter Satz wird vollstaendig geprueft.
    await verifyBackupSetIntegrity(earlierDirectory);
    const earlierManifest = await readManifestOnly(earlierDirectory, privateKey);
    if (earlierManifest.backup_id !== backupId) {
      throw new Error(`Sicherungssatz ${backupId} traegt eine andere Backup-ID: ${earlierManifest.backup_id}`);
    }
    const present = await readHashes(earlierDirectory, backupId);
    for (const hash of expectedHashes) {
      if (present.has(hash)) fromEarlier.add(hash);
    }
  }

  if (missingSets.length) {
    throw new Error(
      `Fuer die Artefakte fehlen die Sicherungssaetze: ${missingSets.join(", ")}. ` +
        "Der Wiederherstellungspunkt ist ohne sie unvollstaendig.",
    );
  }

  const expected = new Set([...fromCurrent, ...manifest.carried_forward_artifacts.map((entry) => entry.sha256)]);
  const available = new Set([...fromCurrent, ...fromEarlier]);
  const missing = [...expected].filter((hash) => !available.has(hash));
  if (missing.length) {
    throw new Error(
      `Im Artifact Store fehlen ${missing.length} gesicherte Objekte, zum Beispiel ${missing[0]}. ` +
        "Der Wiederherstellungspunkt ist unvollstaendig.",
    );
  }

  return {
    total: available.size,
    fromCurrentSet: fromCurrent.size,
    fromEarlierSets: fromEarlier.size,
    earlierSets: [...byBackupId.keys()].sort(),
  };
}

// Liest das Artefaktarchiv eines Satzes. Ist ein Ausgabeverzeichnis genannt,
// wird das entschluesselte Archiv zuerst dort abgelegt und anschliessend von
// dort geprueft, damit genau das Archiv geprueft ist, das spaeter eingespielt
// wird.
async function readArtifactArchive(directory, backupId, privateKey, artifactsDirectory) {
  const stream = openMemberStream(directory, MEMBER_NAMES.artifactObjects, privateKey);
  if (!artifactsDirectory) return readArtifactHashes(stream);
  const target = path.join(path.resolve(artifactsDirectory), `artifact-objects-${backupId}.tar`);
  await pipeline(stream, fs.createWriteStream(target, { flags: "wx", mode: 0o600 }));
  return readArtifactHashes(fs.createReadStream(target));
}

// Prueft jedes Objekt gegen seinen eigenen Inhaltshash. Ein Objekt, dessen
// Inhalt nicht zu seinem Pfad passt, ist beschaedigt.
async function readArtifactHashes(source) {
  const hashes = new Set();
  await readTarEntries(source, (entry) => {
    const match = OBJECT_PATH_PATTERN.exec(entry.path);
    if (!match) throw new Error(`Artefaktarchiv enthaelt einen nicht content-addressierten Pfad: ${entry.path}`);
    const [, prefix, expected] = match;
    if (entry.sha256 !== expected) {
      throw new Error(`Artefakt ${entry.path} hat den Inhaltshash ${entry.sha256} statt ${expected}.`);
    }
    if (!expected.startsWith(prefix)) {
      throw new Error(`Artefakt ${entry.path} liegt im falschen Unterverzeichnis.`);
    }
    hashes.add(expected);
  });
  return hashes;
}

async function isReadableDirectory(target) {
  try {
    return (await fsp.stat(target)).isDirectory();
  } catch {
    return false;
  }
}

module.exports = { readArtifactHashes, restoreBackupSet, verifyArtifactCoverage };
