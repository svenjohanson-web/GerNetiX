"use strict";

// Ein Sicherungssatz ist ein Verzeichnis aus verschluesselten Objekten, einem
// verschluesselten Manifest und einer unverschluesselten Pruefsummenliste ueber
// die Objekte. Die Pruefsummenliste erlaubt dem VPS, seinen eigenen Upload zu
// pruefen, ohne einen Sicherungssatz lesen zu koennen.

const crypto = require("node:crypto");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { Readable, Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");

const { RecoveryKeyDecryptStream, RecoveryKeyEncryptStream } = require("./recovery-key");
const {
  MANIFEST_MEMBER_NAME,
  createManifest,
  parseManifest,
  serializeManifest,
} = require("./backup-manifest");

const OBJECT_SUFFIX = ".gxb";
const CHECKSUM_FILE = "SHA256SUMS";

class HashingPassThrough extends Transform {
  constructor() {
    super();
    this.hash = crypto.createHash("sha256");
    this.sizeBytes = 0;
  }

  _transform(chunk, _encoding, callback) {
    this.hash.update(chunk);
    this.sizeBytes += chunk.length;
    callback(null, chunk);
  }

  digest() {
    return this.hash.digest("hex");
  }
}

class BackupSetWriter {
  constructor(options) {
    this.directory = path.resolve(requireValue(options.directory, "Zielverzeichnis des Sicherungssatzes"));
    this.rawPublicKey = requireValue(options.rawPublicKey, "Recovery-Public-Key");
    this.chunkSize = options.chunkSize;
    this.members = [];
    this.finalized = false;
  }

  async open() {
    // Der Satz entsteht ausschliesslich in einem neuen, nur fuer den Betreiber
    // lesbaren Verzeichnis; ein bestehendes Ziel wird nie ueberschrieben.
    await fsp.mkdir(this.directory, { recursive: false, mode: 0o700 });
  }

  objectPathFor(name) {
    const target = path.join(this.directory, `${name}${OBJECT_SUFFIX}`);
    if (path.dirname(target) !== this.directory) throw new Error(`Bestandteilname verlaesst den Sicherungssatz: ${name}`);
    return target;
  }

  // Nimmt einen Bestandteil auf und misst dabei Klartext und Objekt getrennt.
  // Der Klartexthash beweist spaeter, dass der Restore genau das zurueckgibt,
  // was gesichert wurde; der Objekthash sichert Transport und Speicherung.
  async addMember({ name, area, consistency, source }) {
    if (this.finalized) throw new Error("Der Sicherungssatz ist bereits abgeschlossen.");
    const plaintext = new HashingPassThrough();
    const ciphertext = new HashingPassThrough();
    const objectPath = this.objectPathFor(name);
    await pipeline(
      toReadable(source),
      plaintext,
      new RecoveryKeyEncryptStream(this.rawPublicKey, { chunkSize: this.chunkSize }),
      ciphertext,
      fs.createWriteStream(objectPath, { flags: "wx", mode: 0o600 }),
    );
    const member = {
      name,
      area,
      consistency,
      sha256: plaintext.digest(),
      sizeBytes: plaintext.sizeBytes,
      encryptedSha256: ciphertext.digest(),
      encryptedSizeBytes: ciphertext.sizeBytes,
    };
    this.members.push(member);
    return member;
  }

  async finalize(manifestInput) {
    if (this.finalized) throw new Error("Der Sicherungssatz ist bereits abgeschlossen.");
    const manifest = createManifest({ ...manifestInput, members: this.members });
    const serialized = Buffer.from(serializeManifest(manifest), "utf8");
    const ciphertext = new HashingPassThrough();
    await pipeline(
      Readable.from([serialized]),
      new RecoveryKeyEncryptStream(this.rawPublicKey, { chunkSize: this.chunkSize }),
      ciphertext,
      fs.createWriteStream(this.objectPathFor(MANIFEST_MEMBER_NAME), { flags: "wx", mode: 0o600 }),
    );
    const checksums = [...manifest.members.map((member) => [member.encrypted_sha256, `${member.name}${OBJECT_SUFFIX}`])]
      .concat([[ciphertext.digest(), `${MANIFEST_MEMBER_NAME}${OBJECT_SUFFIX}`]])
      .sort((a, b) => a[1].localeCompare(b[1]))
      .map(([digest, file]) => `${digest}  ${file}\n`)
      .join("");
    await fsp.writeFile(path.join(this.directory, CHECKSUM_FILE), checksums, { flag: "wx", mode: 0o600 });
    this.finalized = true;
    return manifest;
  }
}

// Pruefung ohne Recovery-Key: genau das, was der VPS nach dem Schreiben und
// nach einem Upload selbst nachweisen kann.
async function verifyBackupSetIntegrity(directory) {
  const root = path.resolve(directory);
  const expected = parseChecksumFile(await fsp.readFile(path.join(root, CHECKSUM_FILE), "utf8"));
  const present = (await fsp.readdir(root, { withFileTypes: true }))
    .filter((entry) => entry.name !== CHECKSUM_FILE)
    .map((entry) => {
      if (!entry.isFile()) throw new Error(`Sicherungssatz enthaelt einen unerwarteten Eintrag: ${entry.name}`);
      return entry.name;
    })
    .sort();
  const listed = expected.map((entry) => entry.file).sort();
  if (present.length !== listed.length || present.some((name, index) => name !== listed[index])) {
    throw new Error("Sicherungssatz und Pruefsummenliste stimmen nicht ueberein.");
  }
  if (!listed.includes(`${MANIFEST_MEMBER_NAME}${OBJECT_SUFFIX}`)) {
    throw new Error("Sicherungssatz enthaelt kein Manifest.");
  }
  for (const entry of expected) {
    const digest = await hashFile(path.join(root, entry.file));
    if (digest !== entry.sha256) throw new Error(`Pruefsummenfehler im Sicherungssatz: ${entry.file}`);
  }
  return { objectCount: expected.length };
}

// Vollstaendige Pruefung mit Recovery-Key: Manifest lesen, jeden Bestandteil
// entschluesseln und gegen seinen Klartexthash halten.
async function readBackupSet(directory, privateKey, options = {}) {
  const root = path.resolve(directory);
  await verifyBackupSetIntegrity(root);
  const manifestContent = await decryptToBuffer(path.join(root, `${MANIFEST_MEMBER_NAME}${OBJECT_SUFFIX}`), privateKey);
  const manifest = parseManifest(manifestContent.toString("utf8"));
  const listed = new Set(manifest.members.map((member) => `${member.name}${OBJECT_SUFFIX}`));
  listed.add(`${MANIFEST_MEMBER_NAME}${OBJECT_SUFFIX}`);
  const present = (await fsp.readdir(root)).filter((name) => name !== CHECKSUM_FILE);
  const unlisted = present.filter((name) => !listed.has(name));
  if (unlisted.length) throw new Error(`Sicherungssatz enthaelt nicht im Manifest genannte Objekte: ${unlisted.join(", ")}`);

  const targetDirectory = options.targetDirectory ? path.resolve(options.targetDirectory) : "";
  if (targetDirectory) await fsp.mkdir(targetDirectory, { recursive: true, mode: 0o700 });
  const restored = [];
  for (const member of manifest.members) {
    const objectPath = path.join(root, `${member.name}${OBJECT_SUFFIX}`);
    const plaintext = new HashingPassThrough();
    const targetPath = targetDirectory ? resolveInside(targetDirectory, member.name) : "";
    const sink = targetPath
      ? fs.createWriteStream(targetPath, { flags: "wx", mode: 0o600 })
      : new Transform({ transform(_chunk, _encoding, callback) { callback(); } });
    await pipeline(fs.createReadStream(objectPath), new RecoveryKeyDecryptStream(privateKey), plaintext, sink);
    if (plaintext.digest() !== member.sha256 || plaintext.sizeBytes !== member.size_bytes) {
      throw new Error(`Wiederhergestellter Bestandteil weicht vom Manifest ab: ${member.name}`);
    }
    restored.push({ name: member.name, area: member.area, path: targetPath, sizeBytes: plaintext.sizeBytes });
  }
  return { manifest, restored };
}

// Oeffnet einen einzelnen Bestandteil eines Satzes als entschluesselten Strom.
// Wird gebraucht, um Artefakte aus frueheren Saetzen nachzuziehen, ohne den
// ganzen Satz auszupacken.
function openMemberStream(directory, memberName, privateKey) {
  const objectPath = path.join(path.resolve(directory), `${memberName}${OBJECT_SUFFIX}`);
  return fs.createReadStream(objectPath).pipe(new RecoveryKeyDecryptStream(privateKey));
}

async function readManifestOnly(directory, privateKey) {
  const content = await decryptToBuffer(
    path.join(path.resolve(directory), `${MANIFEST_MEMBER_NAME}${OBJECT_SUFFIX}`),
    privateKey,
  );
  return parseManifest(content.toString("utf8"));
}

async function decryptToBuffer(objectPath, privateKey) {
  const pieces = [];
  await pipeline(
    fs.createReadStream(objectPath),
    new RecoveryKeyDecryptStream(privateKey),
    new Transform({
      transform(chunk, _encoding, callback) {
        pieces.push(chunk);
        callback();
      },
    }),
  );
  return Buffer.concat(pieces);
}

function parseChecksumFile(content) {
  const entries = String(content)
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const match = /^([a-f0-9]{64})\s{2}([a-z0-9][a-z0-9._-]{0,63}\.gxb)$/.exec(line);
      if (!match) throw new Error("Pruefsummenliste des Sicherungssatzes ist nicht lesbar.");
      return { sha256: match[1], file: match[2] };
    });
  if (!entries.length) throw new Error("Pruefsummenliste des Sicherungssatzes ist leer.");
  const files = new Set();
  for (const entry of entries) {
    if (files.has(entry.file)) throw new Error(`Objekt ist doppelt in der Pruefsummenliste: ${entry.file}`);
    files.add(entry.file);
  }
  return entries;
}

function resolveInside(directory, name) {
  const target = path.join(directory, name);
  if (path.dirname(target) !== directory) throw new Error(`Bestandteilname verlaesst das Zielverzeichnis: ${name}`);
  return target;
}

async function hashFile(filePath) {
  const hash = crypto.createHash("sha256");
  await pipeline(
    fs.createReadStream(filePath),
    new Transform({
      transform(chunk, _encoding, callback) {
        hash.update(chunk);
        callback();
      },
    }),
  );
  return hash.digest("hex");
}

function toReadable(source) {
  if (typeof source === "string") return fs.createReadStream(source);
  if (Buffer.isBuffer(source)) return Readable.from([source]);
  if (source && typeof source.pipe === "function") return source;
  throw new Error("Bestandteil braucht einen Dateipfad, einen Buffer oder einen Stream.");
}

function requireValue(value, label) {
  if (!value) throw new Error(`${label} fehlt.`);
  return value;
}

module.exports = {
  BackupSetWriter,
  CHECKSUM_FILE,
  OBJECT_SUFFIX,
  openMemberStream,
  readBackupSet,
  readManifestOnly,
  verifyBackupSetIntegrity,
};
