#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const projectRoot = path.resolve(__dirname, "..");
const sourcePath = path.join(projectRoot, "assets/stories/stories.de.json");
const audioRoot = path.join(projectRoot, "assets/stories/audio");
const manifestPath = path.join(audioRoot, "manifest.json");

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    fail(result.error?.message || result.stderr || `${command} failed`);
  }
}

function chunk(buffer, id) {
  let offset = 12;
  while (offset + 8 <= buffer.length) {
    const chunkId = buffer.toString("ascii", offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    if (chunkId === id) return buffer.subarray(offset + 8, offset + 8 + length);
    offset += 8 + length + (length & 1);
  }
  fail(`WAV chunk ${id} is missing`);
}

function readMonoPcm16(wavPath, expectedRate) {
  const wav = fs.readFileSync(wavPath);
  if (wav.toString("ascii", 0, 4) !== "RIFF" ||
      wav.toString("ascii", 8, 12) !== "WAVE") {
    fail(`${wavPath} is not a RIFF/WAVE file`);
  }
  const format = chunk(wav, "fmt ");
  if (format.readUInt16LE(0) !== 1 || format.readUInt16LE(2) !== 1 ||
      format.readUInt32LE(4) !== expectedRate || format.readUInt16LE(14) !== 16) {
    fail(`${wavPath} is not 16-bit mono PCM at ${expectedRate} Hz`);
  }
  const data = chunk(wav, "data");
  const samples = new Int16Array(data.length / 2);
  for (let index = 0; index < samples.length; index += 1) {
    samples[index] = data.readInt16LE(index * 2);
  }
  return samples;
}

function compactToPcm8(samples) {
  let peak = 1;
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample));
  const gain = Math.min(1.8, (112 * 256) / peak);
  return Int8Array.from(samples, (sample) =>
    Math.max(-112, Math.min(112, Math.round((sample * gain) / 256))));
}

const catalog = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
if (catalog.schemaVersion !== 1 || !Array.isArray(catalog.packs)) {
  fail("Unsupported local story source schema");
}
if (process.platform !== "darwin") {
  fail("Local story speech generation requires macOS say and afconvert");
}
const temporaryRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nexi-story-audio-"));
const generated = [];
try {
  for (const pack of catalog.packs) {
    for (const story of pack.stories) {
      const base = path.join(temporaryRoot, story.id);
      const aiffPath = `${base}.aiff`;
      const wavPath = `${base}.wav`;
      run("/usr/bin/say", ["-v", catalog.voice, "-r",
        String(catalog.speechRate), "-o", aiffPath, story.text]);
      run("/usr/bin/afconvert", [aiffPath, wavPath, "-f", "WAVE", "-d",
        `LEI16@${catalog.sampleRateHz}`, "-c", "1"]);
      const samples = compactToPcm8(
        readMonoPcm16(wavPath, catalog.sampleRateHz));
      generated.push({
        id: story.id,
        samples,
        sha256: crypto.createHash("sha256").update(samples).digest("hex"),
      });
    }
  }
} finally {
  fs.rmSync(temporaryRoot, { recursive: true, force: true });
}

fs.mkdirSync(audioRoot, { recursive: true });
for (const item of generated) {
  fs.writeFileSync(path.join(audioRoot, `${item.id}.pcm8`), item.samples);
}
fs.writeFileSync(manifestPath, `${JSON.stringify({
  schemaVersion: 1,
  encoding: "signed-pcm8",
  channels: 1,
  sampleRateHz: catalog.sampleRateHz,
  assets: generated.map(({ id, samples, sha256 }) => ({
    id,
    file: `${id}.pcm8`,
    sampleCount: samples.length,
    sha256,
  })),
}, null, 2)}\n`);
process.stdout.write(`Generated ${generated.length} local stories (${generated
  .reduce((sum, item) => sum + item.samples.length, 0)} PCM8 samples as binary assets).\n`);
