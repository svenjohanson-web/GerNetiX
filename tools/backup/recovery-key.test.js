"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const test = require("node:test");
const { Readable } = require("node:stream");
const { buffer: collect } = require("node:stream/consumers");
const { pipeline } = require("node:stream/promises");

const {
  HEADER_BYTES,
  RecoveryKeyDecryptStream,
  RecoveryKeyEncryptStream,
  generateRecoveryKeyPair,
  parsePrivateKeyFile,
  parsePublicKeyFile,
} = require("./recovery-key");

async function seal(rawPublicKey, plaintext, options) {
  const source = Readable.from([plaintext]);
  const encrypt = new RecoveryKeyEncryptStream(rawPublicKey, options);
  source.pipe(encrypt);
  return collect(encrypt);
}

async function open(privateKey, sealed) {
  const decrypt = new RecoveryKeyDecryptStream(privateKey);
  Readable.from([sealed]).pipe(decrypt);
  return collect(decrypt);
}

test("verschluesselt und entschluesselt ueber mehrere Chunks hinweg verlustfrei", async () => {
  const keyPair = generateRecoveryKeyPair();
  const plaintext = crypto.randomBytes(9000);
  const sealed = await seal(keyPair.rawPublicKey, plaintext, { chunkSize: 1024 });
  assert.ok(sealed.length > plaintext.length + HEADER_BYTES);
  const { privateKey } = parsePrivateKeyFile(keyPair.privateKeyFile);
  assert.deepEqual(await open(privateKey, plaintext.length ? sealed : sealed), plaintext);
});

test("verschluesselt auch leere Bestandteile und erkennt sie beim Lesen", async () => {
  const keyPair = generateRecoveryKeyPair();
  const sealed = await seal(keyPair.rawPublicKey, Buffer.alloc(0), { chunkSize: 1024 });
  const { privateKey } = parsePrivateKeyFile(keyPair.privateKeyFile);
  assert.equal((await open(privateKey, sealed)).length, 0);
});

test("erzeugt fuer denselben Klartext niemals dasselbe Objekt", async () => {
  const keyPair = generateRecoveryKeyPair();
  const first = await seal(keyPair.rawPublicKey, Buffer.from("gernetix"), { chunkSize: 1024 });
  const second = await seal(keyPair.rawPublicKey, Buffer.from("gernetix"), { chunkSize: 1024 });
  assert.notDeepEqual(first, second);
});

test("der oeffentliche Schluessel allein kann nicht entschluesseln", () => {
  const keyPair = generateRecoveryKeyPair();
  const parsed = parsePublicKeyFile(keyPair.publicKeyFile);
  assert.equal(parsed.keyId, keyPair.keyId);
  assert.equal(parsed.publicKey.type, "public");
  assert.throws(() => new RecoveryKeyDecryptStream(parsed.publicKey), /private Recovery-Key/);
});

test("weist ein Objekt ab, das fuer einen anderen Recovery-Key bestimmt war", async () => {
  const owner = generateRecoveryKeyPair();
  const stranger = generateRecoveryKeyPair();
  const sealed = await seal(owner.rawPublicKey, Buffer.from("kundendaten"), { chunkSize: 1024 });
  const { privateKey } = parsePrivateKeyFile(stranger.privateKeyFile);
  await assert.rejects(open(privateKey, sealed), /anderen Recovery-Key/);
});

test("erkennt ein veraendertes Byte im Chiffrat", async () => {
  const keyPair = generateRecoveryKeyPair();
  const sealed = await seal(keyPair.rawPublicKey, crypto.randomBytes(4096), { chunkSize: 1024 });
  sealed[HEADER_BYTES + 8] ^= 0x01;
  const { privateKey } = parsePrivateKeyFile(keyPair.privateKeyFile);
  await assert.rejects(open(privateKey, sealed));
});

test("erkennt einen veraenderten Kopf", async () => {
  const keyPair = generateRecoveryKeyPair();
  const sealed = await seal(keyPair.rawPublicKey, crypto.randomBytes(2048), { chunkSize: 1024 });
  sealed[HEADER_BYTES - 1] ^= 0x01;
  const { privateKey } = parsePrivateKeyFile(keyPair.privateKeyFile);
  await assert.rejects(open(privateKey, sealed));
});

test("erkennt ein abgeschnittenes Objekt statt Teildaten auszuliefern", async () => {
  const keyPair = generateRecoveryKeyPair();
  const sealed = await seal(keyPair.rawPublicKey, crypto.randomBytes(8192), { chunkSize: 1024 });
  const { privateKey } = parsePrivateKeyFile(keyPair.privateKeyFile);
  await assert.rejects(open(privateKey, sealed.subarray(0, sealed.length - 32)), /unvollstaendig|abgeschnitten/i);
});

test("erkennt einen entfernten Chunk in der Mitte", async () => {
  const keyPair = generateRecoveryKeyPair();
  const sealed = await seal(keyPair.rawPublicKey, crypto.randomBytes(4096), { chunkSize: 1024 });
  const chunkBytes = 4 + 1024 + 16;
  const shortened = Buffer.concat([
    sealed.subarray(0, HEADER_BYTES),
    sealed.subarray(HEADER_BYTES + chunkBytes),
  ]);
  const { privateKey } = parsePrivateKeyFile(keyPair.privateKeyFile);
  await assert.rejects(open(privateKey, shortened));
});

test("erkennt angehaengte Daten nach dem Abschluss", async () => {
  const keyPair = generateRecoveryKeyPair();
  const sealed = await seal(keyPair.rawPublicKey, Buffer.from("kundendaten"), { chunkSize: 1024 });
  const { privateKey } = parsePrivateKeyFile(keyPair.privateKeyFile);
  await assert.rejects(open(privateKey, Buffer.concat([sealed, Buffer.from("mehr")])), /nach seinem Abschluss/);
});

test("weist unbrauchbare Schluesseldateien mit klarer Meldung ab", () => {
  const keyPair = generateRecoveryKeyPair();
  assert.throws(() => parsePublicKeyFile(""), /leer/);
  assert.throws(() => parsePublicKeyFile(keyPair.privateKeyFile), /gernetix-recovery-public-key-v1/);
  assert.throws(() => parsePrivateKeyFile(keyPair.publicKeyFile), /gernetix-recovery-private-key-v1/);
  assert.throws(() => parsePublicKeyFile("gernetix-recovery-public-key-v1 kurz"), /32-Byte-Wert/);
  const withWrongId = keyPair.privateKeyFile.replace(/ [a-f0-9]{64}\n$/, ` ${"0".repeat(64)}\n`);
  assert.throws(() => parsePrivateKeyFile(withWrongId), /passt nicht/);
});

test("die Schluesseldateien enthalten kein anderes Material als vorgesehen", () => {
  const keyPair = generateRecoveryKeyPair();
  assert.match(keyPair.publicKeyFile, /^gernetix-recovery-public-key-v1 [A-Za-z0-9_-]{43} [a-f0-9]{64}\n$/);
  assert.match(keyPair.privateKeyFile, /^gernetix-recovery-private-key-v1 [A-Za-z0-9_-]{43} [a-f0-9]{64}\n$/);
  assert.ok(!keyPair.publicKeyFile.includes(keyPair.rawPrivateKey.toString("base64url")));
});

test("verarbeitet Bestandteile, die groesser als ein Chunk-Vielfaches sind, im Stream", async () => {
  const keyPair = generateRecoveryKeyPair();
  const plaintext = crypto.randomBytes(1024 * 3 + 17);
  const encrypt = new RecoveryKeyEncryptStream(keyPair.rawPublicKey, { chunkSize: 1024 });
  const decrypt = new RecoveryKeyDecryptStream(parsePrivateKeyFile(keyPair.privateKeyFile).privateKey);
  const restored = collect(decrypt);
  await pipeline(Readable.from(splitIntoPieces(plaintext, 137)), encrypt, decrypt);
  assert.deepEqual(await restored, plaintext);
});

function splitIntoPieces(buffer, size) {
  const pieces = [];
  for (let offset = 0; offset < buffer.length; offset += size) pieces.push(buffer.subarray(offset, offset + size));
  return pieces;
}
