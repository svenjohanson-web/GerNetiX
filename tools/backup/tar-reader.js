"use strict";

// Minimaler Leser fuer das ustar-Format. Er dient allein dazu, ein gesichertes
// Artefaktarchiv zu pruefen, ohne es auszupacken: fuer jeden Eintrag werden
// Pfad, Groesse und Inhaltshash gemeldet. Alles, was nicht eine gewoehnliche
// Datei mit kurzem Pfad ist, wird abgelehnt statt stillschweigend uebergangen.

const crypto = require("node:crypto");

const BLOCK_BYTES = 512;
const NAME_OFFSET = 0;
const NAME_BYTES = 100;
const SIZE_OFFSET = 124;
const SIZE_BYTES = 12;
const CHECKSUM_OFFSET = 148;
const CHECKSUM_BYTES = 8;
const TYPE_OFFSET = 156;
const PREFIX_OFFSET = 345;
const PREFIX_BYTES = 155;

// Regulaere Dateien; '0' und '\0' sind beide zulaessig, alles andere nicht.
const REGULAR_TYPES = new Set(["0", "\0", ""]);

async function readTarEntries(source, onEntry) {
  let buffer = Buffer.alloc(0);
  let emptyBlocks = 0;
  let finished = false;
  let pending = null;

  for await (const chunk of source) {
    buffer = buffer.length ? Buffer.concat([buffer, chunk]) : Buffer.from(chunk);
    let progressing = true;
    while (progressing) {
      progressing = false;

      // Ein angefangener Eintrag wird zuerst zu Ende gelesen: erst seine
      // Nutzdaten, dann die Auffuellung auf die naechste Blockgrenze.
      if (pending) {
        if (pending.dataRemaining > 0 && buffer.length) {
          const take = Math.min(pending.dataRemaining, buffer.length);
          pending.hash.update(buffer.subarray(0, take));
          pending.dataRemaining -= take;
          buffer = buffer.subarray(take);
          progressing = true;
        }
        if (pending.dataRemaining === 0 && pending.padRemaining > 0 && buffer.length) {
          const skip = Math.min(pending.padRemaining, buffer.length);
          pending.padRemaining -= skip;
          buffer = buffer.subarray(skip);
          progressing = true;
        }
        if (pending.dataRemaining === 0 && pending.padRemaining === 0) {
          await onEntry({ path: pending.path, sizeBytes: pending.sizeBytes, sha256: pending.hash.digest("hex") });
          pending = null;
          progressing = true;
        }
        continue;
      }

      if (buffer.length < BLOCK_BYTES) break;
      const header = buffer.subarray(0, BLOCK_BYTES);
      buffer = buffer.subarray(BLOCK_BYTES);
      progressing = true;
      if (isEmptyBlock(header)) {
        emptyBlocks += 1;
        if (emptyBlocks >= 2) finished = true;
        continue;
      }
      if (finished) throw new Error("Artefaktarchiv enthaelt Daten nach seinem Ende.");
      emptyBlocks = 0;
      const entry = parseHeader(header);
      pending = {
        ...entry,
        dataRemaining: entry.sizeBytes,
        padRemaining: (BLOCK_BYTES - (entry.sizeBytes % BLOCK_BYTES)) % BLOCK_BYTES,
        hash: crypto.createHash("sha256"),
      };
    }
  }

  if (pending) throw new Error(`Artefaktarchiv endet mitten in einem Eintrag: ${pending.path}`);
  if (!finished) throw new Error("Artefaktarchiv ist unvollstaendig; der Endblock fehlt.");
}

function parseHeader(header) {
  const computed = computeChecksum(header);
  const stored = parseOctal(header, CHECKSUM_OFFSET, CHECKSUM_BYTES, "Kopfpruefsumme");
  if (computed !== stored) throw new Error("Artefaktarchiv hat einen beschaedigten Eintragskopf.");

  const type = header.subarray(TYPE_OFFSET, TYPE_OFFSET + 1).toString("binary");
  if (!REGULAR_TYPES.has(type)) {
    throw new Error(`Artefaktarchiv enthaelt einen nicht erlaubten Eintragstyp: ${JSON.stringify(type)}`);
  }
  const name = readString(header, NAME_OFFSET, NAME_BYTES);
  const prefix = readString(header, PREFIX_OFFSET, PREFIX_BYTES);
  const entryPath = prefix ? `${prefix}/${name}` : name;
  if (!entryPath) throw new Error("Artefaktarchiv enthaelt einen Eintrag ohne Pfad.");
  if (entryPath.startsWith("/") || entryPath.split("/").includes("..")) {
    throw new Error(`Artefaktarchiv enthaelt einen unsicheren Pfad: ${entryPath}`);
  }
  return { path: entryPath, sizeBytes: parseOctal(header, SIZE_OFFSET, SIZE_BYTES, "Groesse") };
}

// Die Kopfpruefsumme wird ueber den Kopf gebildet, wobei ihr eigenes Feld als
// Leerzeichen gilt.
function computeChecksum(header) {
  let sum = 0;
  for (let index = 0; index < BLOCK_BYTES; index += 1) {
    const inChecksumField = index >= CHECKSUM_OFFSET && index < CHECKSUM_OFFSET + CHECKSUM_BYTES;
    sum += inChecksumField ? 0x20 : header[index];
  }
  return sum;
}

function readString(header, offset, length) {
  const raw = header.subarray(offset, offset + length);
  const end = raw.indexOf(0);
  return raw.subarray(0, end === -1 ? raw.length : end).toString("utf8").trim();
}

function parseOctal(header, offset, length, label) {
  const text = readString(header, offset, length).replace(/\0/g, "").trim();
  if (!/^[0-7]+$/.test(text)) throw new Error(`Artefaktarchiv hat ein unlesbares Feld: ${label}`);
  return Number.parseInt(text, 8);
}

function isEmptyBlock(block) {
  for (let index = 0; index < BLOCK_BYTES; index += 1) {
    if (block[index] !== 0) return false;
  }
  return true;
}

module.exports = { BLOCK_BYTES, readTarEntries };
