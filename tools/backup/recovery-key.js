"use strict";

// Sicherungssaetze werden gegen einen offline verwahrten Recovery-Key verschluesselt.
// Der VPS besitzt ausschliesslich den oeffentlichen Schluessel und kann deshalb
// schreiben, aber niemals einen bestehenden Sicherungssatz lesen.

const crypto = require("node:crypto");
const { Transform } = require("node:stream");

const MAGIC = Buffer.from("GXBKUP01", "ascii");
const FORMAT_VERSION = 1;
const KEY_ID_BYTES = 32;
const RAW_KEY_BYTES = 32;
const SALT_BYTES = 32;
const NONCE_PREFIX_BYTES = 4;
const TAG_BYTES = 16;
const LENGTH_PREFIX_BYTES = 4;
const HEADER_BYTES = MAGIC.length + 1 + KEY_ID_BYTES + RAW_KEY_BYTES + SALT_BYTES + 4;
const DEFAULT_CHUNK_BYTES = 1024 * 1024;
const MAX_CHUNK_BYTES = 16 * 1024 * 1024;
const HKDF_INFO = Buffer.from("gernetix-backup-v1", "ascii");
const PUBLIC_KEY_PREFIX = "gernetix-recovery-public-key-v1";
const PRIVATE_KEY_PREFIX = "gernetix-recovery-private-key-v1";

function generateRecoveryKeyPair() {
  const { publicKey, privateKey } = crypto.generateKeyPairSync("x25519");
  const rawPublicKey = rawFromPublicKey(publicKey);
  const rawPrivateKey = Buffer.from(privateKey.export({ format: "jwk" }).d, "base64url");
  if (rawPrivateKey.length !== RAW_KEY_BYTES) throw new Error("Erzeugter Recovery-Key hat eine unerwartete Laenge.");
  return {
    keyId: keyIdOf(rawPublicKey),
    rawPublicKey,
    rawPrivateKey,
    publicKeyFile: encodeKeyFile(PUBLIC_KEY_PREFIX, rawPublicKey),
    privateKeyFile: encodeKeyFile(PRIVATE_KEY_PREFIX, rawPrivateKey, keyIdOf(rawPublicKey)),
  };
}

function encodeKeyFile(prefix, rawKey, keyId) {
  const identifier = keyId || keyIdOf(rawKey);
  return `${prefix} ${rawKey.toString("base64url")} ${identifier}\n`;
}

function parsePublicKeyFile(content) {
  const raw = parseKeyFile(content, PUBLIC_KEY_PREFIX);
  const keyId = keyIdOf(raw);
  return { keyId, rawPublicKey: raw, publicKey: publicKeyFromRaw(raw) };
}

function parsePrivateKeyFile(content) {
  const { raw, declaredKeyId } = parseKeyFileWithIdentifier(content, PRIVATE_KEY_PREFIX);
  const privateKey = privateKeyFromRaw(raw);
  const rawPublicKey = rawFromPublicKey(crypto.createPublicKey(privateKey));
  const keyId = keyIdOf(rawPublicKey);
  if (declaredKeyId && declaredKeyId !== keyId) {
    throw new Error("Recovery-Private-Key passt nicht zu der in der Datei genannten Schluessel-ID.");
  }
  return { keyId, rawPublicKey, privateKey };
}

function parseKeyFile(content, prefix) {
  return parseKeyFileWithIdentifier(content, prefix).raw;
}

function parseKeyFileWithIdentifier(content, prefix) {
  const line = String(content || "")
    .split("\n")
    .map((entry) => entry.trim())
    .find((entry) => entry && !entry.startsWith("#"));
  if (!line) throw new Error("Recovery-Key-Datei ist leer.");
  const parts = line.split(/\s+/);
  if (parts.length < 2 || parts.length > 3 || parts[0] !== prefix) {
    throw new Error(`Recovery-Key-Datei hat kein gueltiges ${prefix}-Format.`);
  }
  if (!/^[A-Za-z0-9_-]{43}$/.test(parts[1])) throw new Error("Recovery-Key-Material ist kein gueltiger 32-Byte-Wert.");
  const raw = Buffer.from(parts[1], "base64url");
  if (raw.length !== RAW_KEY_BYTES) throw new Error("Recovery-Key-Material ist kein gueltiger 32-Byte-Wert.");
  const declaredKeyId = parts[2] || "";
  if (declaredKeyId && !/^[a-f0-9]{64}$/.test(declaredKeyId)) throw new Error("Recovery-Key-ID ist kein SHA-256-Wert.");
  return { raw, declaredKeyId };
}

function keyIdOf(rawPublicKey) {
  return crypto.createHash("sha256").update(rawPublicKey).digest("hex");
}

function rawFromPublicKey(publicKey) {
  const raw = Buffer.from(publicKey.export({ format: "jwk" }).x, "base64url");
  if (raw.length !== RAW_KEY_BYTES) throw new Error("Recovery-Public-Key hat eine unerwartete Laenge.");
  return raw;
}

function publicKeyFromRaw(raw) {
  return crypto.createPublicKey({ key: { kty: "OKP", crv: "X25519", x: raw.toString("base64url") }, format: "jwk" });
}

function privateKeyFromRaw(raw) {
  return crypto.createPrivateKey({ key: { kty: "OKP", crv: "X25519", d: raw.toString("base64url"), x: "" }, format: "jwk" });
}

function deriveSessionSecrets(sharedSecret, salt, ephemeralPublicKey, recipientPublicKey) {
  const material = Buffer.concat([sharedSecret, ephemeralPublicKey, recipientPublicKey]);
  const derived = Buffer.from(crypto.hkdfSync("sha256", material, salt, HKDF_INFO, 32 + NONCE_PREFIX_BYTES));
  return { key: derived.subarray(0, 32), noncePrefix: derived.subarray(32) };
}

function buildHeader(keyIdHex, ephemeralPublicKey, salt, chunkSize) {
  const header = Buffer.alloc(HEADER_BYTES);
  let offset = MAGIC.copy(header, 0);
  header.writeUInt8(FORMAT_VERSION, offset);
  offset += 1;
  offset += Buffer.from(keyIdHex, "hex").copy(header, offset);
  offset += ephemeralPublicKey.copy(header, offset);
  offset += salt.copy(header, offset);
  header.writeUInt32BE(chunkSize, offset);
  return header;
}

function parseHeader(header) {
  if (header.length !== HEADER_BYTES || !header.subarray(0, MAGIC.length).equals(MAGIC)) {
    throw new Error("Sicherungsobjekt hat kein gueltiges GerNetiX-Backup-Format.");
  }
  let offset = MAGIC.length;
  const version = header.readUInt8(offset);
  offset += 1;
  if (version !== FORMAT_VERSION) throw new Error(`Nicht unterstuetzte Backup-Formatversion: ${version}`);
  const keyId = header.subarray(offset, offset + KEY_ID_BYTES).toString("hex");
  offset += KEY_ID_BYTES;
  const ephemeralPublicKey = header.subarray(offset, offset + RAW_KEY_BYTES);
  offset += RAW_KEY_BYTES;
  const salt = header.subarray(offset, offset + SALT_BYTES);
  offset += SALT_BYTES;
  const chunkSize = header.readUInt32BE(offset);
  if (chunkSize < 1 || chunkSize > MAX_CHUNK_BYTES) throw new Error("Sicherungsobjekt nennt eine unplausible Chunk-Groesse.");
  return { version, keyId, ephemeralPublicKey, salt, chunkSize };
}

function nonceFor(noncePrefix, counter) {
  const nonce = Buffer.alloc(12);
  noncePrefix.copy(nonce, 0);
  nonce.writeBigUInt64BE(BigInt(counter), NONCE_PREFIX_BYTES);
  return nonce;
}

// Bindet Kopf, Reihenfolge, Laenge und Abschluss jedes Chunks kryptografisch,
// damit Vertauschen, Kuerzen und Anhaengen erkannt werden.
function additionalData(headerHash, counter, isFinal, length) {
  const context = Buffer.alloc(13);
  context.writeBigUInt64BE(BigInt(counter), 0);
  context.writeUInt8(isFinal ? 1 : 0, 8);
  context.writeUInt32BE(length, 9);
  return Buffer.concat([headerHash, context]);
}

class RecoveryKeyEncryptStream extends Transform {
  constructor(rawPublicKey, options = {}) {
    super();
    const chunkSize = options.chunkSize || DEFAULT_CHUNK_BYTES;
    if (!Number.isInteger(chunkSize) || chunkSize < 1024 || chunkSize > MAX_CHUNK_BYTES) {
      throw new Error("Backup-Chunk-Groesse liegt ausserhalb des zulaessigen Bereichs.");
    }
    const recipientPublicKey = publicKeyFromRaw(rawPublicKey);
    const ephemeral = crypto.generateKeyPairSync("x25519");
    const ephemeralRaw = rawFromPublicKey(ephemeral.publicKey);
    const salt = crypto.randomBytes(SALT_BYTES);
    const sharedSecret = crypto.diffieHellman({ privateKey: ephemeral.privateKey, publicKey: recipientPublicKey });
    const secrets = deriveSessionSecrets(sharedSecret, salt, ephemeralRaw, rawPublicKey);
    this.chunkSize = chunkSize;
    this.key = secrets.key;
    this.noncePrefix = secrets.noncePrefix;
    this.header = buildHeader(keyIdOf(rawPublicKey), ephemeralRaw, salt, chunkSize);
    this.headerHash = crypto.createHash("sha256").update(this.header).digest();
    this.counter = 0;
    this.pending = Buffer.alloc(0);
    this.push(this.header);
  }

  sealChunk(plaintext, isFinal) {
    const cipher = crypto.createCipheriv("aes-256-gcm", this.key, nonceFor(this.noncePrefix, this.counter));
    cipher.setAAD(additionalData(this.headerHash, this.counter, isFinal, plaintext.length));
    const body = Buffer.concat([cipher.update(plaintext), cipher.final()]);
    const length = Buffer.alloc(LENGTH_PREFIX_BYTES);
    length.writeUInt32BE(body.length);
    this.counter += 1;
    this.push(Buffer.concat([length, body, cipher.getAuthTag()]));
  }

  _transform(chunk, _encoding, callback) {
    try {
      this.pending = this.pending.length ? Buffer.concat([this.pending, chunk]) : chunk;
      while (this.pending.length >= this.chunkSize) {
        this.sealChunk(this.pending.subarray(0, this.chunkSize), false);
        this.pending = this.pending.subarray(this.chunkSize);
      }
      callback();
    } catch (error) {
      callback(error);
    }
  }

  _flush(callback) {
    try {
      if (this.pending.length) this.sealChunk(this.pending, false);
      this.pending = Buffer.alloc(0);
      this.sealChunk(Buffer.alloc(0), true);
      callback();
    } catch (error) {
      callback(error);
    }
  }
}

class RecoveryKeyDecryptStream extends Transform {
  constructor(privateKey) {
    super();
    if (privateKey?.type !== "private" || privateKey.asymmetricKeyType !== "x25519") {
      throw new Error("Zum Entschluesseln wird der private Recovery-Key benoetigt.");
    }
    this.privateKey = privateKey;
    this.buffer = Buffer.alloc(0);
    this.counter = 0;
    this.headerRead = false;
    this.finished = false;
  }

  readHeader() {
    const header = this.buffer.subarray(0, HEADER_BYTES);
    const parsed = parseHeader(header);
    const rawPublicKey = rawFromPublicKey(crypto.createPublicKey(this.privateKey));
    if (parsed.keyId !== keyIdOf(rawPublicKey)) {
      throw new Error("Sicherungsobjekt wurde fuer einen anderen Recovery-Key verschluesselt.");
    }
    const sharedSecret = crypto.diffieHellman({
      privateKey: this.privateKey,
      publicKey: publicKeyFromRaw(parsed.ephemeralPublicKey),
    });
    const secrets = deriveSessionSecrets(sharedSecret, parsed.salt, parsed.ephemeralPublicKey, rawPublicKey);
    this.key = secrets.key;
    this.noncePrefix = secrets.noncePrefix;
    this.chunkSize = parsed.chunkSize;
    this.headerHash = crypto.createHash("sha256").update(header).digest();
    this.keyId = parsed.keyId;
    this.buffer = this.buffer.subarray(HEADER_BYTES);
    this.headerRead = true;
  }

  openChunk(body, tag, isFinal) {
    const decipher = crypto.createDecipheriv("aes-256-gcm", this.key, nonceFor(this.noncePrefix, this.counter));
    decipher.setAAD(additionalData(this.headerHash, this.counter, isFinal, body.length));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(body), decipher.final()]);
  }

  drain() {
    while (!this.finished) {
      if (this.buffer.length < LENGTH_PREFIX_BYTES) return;
      const length = this.buffer.readUInt32BE(0);
      if (length > this.chunkSize) throw new Error("Sicherungsobjekt enthaelt einen ueberlangen Chunk.");
      const total = LENGTH_PREFIX_BYTES + length + TAG_BYTES;
      if (this.buffer.length < total) return;
      const body = this.buffer.subarray(LENGTH_PREFIX_BYTES, LENGTH_PREFIX_BYTES + length);
      const tag = this.buffer.subarray(LENGTH_PREFIX_BYTES + length, total);
      // Ein leerer Chunk ist der authentifizierte Abschluss; er beweist, dass das Objekt vollstaendig ist.
      const isFinal = length === 0;
      const plaintext = this.openChunk(body, tag, isFinal);
      this.buffer = this.buffer.subarray(total);
      this.counter += 1;
      if (isFinal) {
        this.finished = true;
        return;
      }
      if (plaintext.length) this.push(plaintext);
    }
  }

  _transform(chunk, _encoding, callback) {
    try {
      if (this.finished) throw new Error("Sicherungsobjekt enthaelt Daten nach seinem Abschluss.");
      this.buffer = this.buffer.length ? Buffer.concat([this.buffer, chunk]) : chunk;
      if (!this.headerRead) {
        if (this.buffer.length < HEADER_BYTES) return callback();
        this.readHeader();
      }
      this.drain();
      callback();
    } catch (error) {
      callback(error);
    }
  }

  _flush(callback) {
    try {
      if (!this.headerRead) throw new Error("Sicherungsobjekt ist zu kurz fuer einen Backup-Kopf.");
      if (!this.finished) throw new Error("Sicherungsobjekt ist unvollstaendig oder wurde abgeschnitten.");
      if (this.buffer.length) throw new Error("Sicherungsobjekt enthaelt Daten nach seinem Abschluss.");
      callback();
    } catch (error) {
      callback(error);
    }
  }
}

module.exports = {
  DEFAULT_CHUNK_BYTES,
  HEADER_BYTES,
  PRIVATE_KEY_PREFIX,
  PUBLIC_KEY_PREFIX,
  RecoveryKeyDecryptStream,
  RecoveryKeyEncryptStream,
  generateRecoveryKeyPair,
  keyIdOf,
  parsePrivateKeyFile,
  parsePublicKeyFile,
};
