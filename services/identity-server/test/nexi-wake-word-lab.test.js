const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const publicRoot = path.resolve(__dirname, "../public");
const projectPage = fs.readFileSync(
  path.join(publicRoot, "nachbauprojekte/nexi-sprachassistent/index.html"),
  "utf8",
);
const commissioningPage = fs.readFileSync(
  path.join(publicRoot, "nachbauprojekte/nexi-sprachassistent/inbetriebnahme/index.html"),
  "utf8",
);
const lab = require("../public/nachbauprojekte/nexi-sprachassistent/nexi-wake-word-lab.js");

function sineWave(frequency, seconds = 1.2, sampleRate = 16000) {
  const samples = new Float32Array(Math.round(seconds * sampleRate));
  for (let index = 0; index < samples.length; index += 1) {
    const envelope = Math.sin(Math.PI * index / samples.length) ** 2;
    samples[index] = Math.sin(2 * Math.PI * frequency * index / sampleRate) * envelope * 0.6;
  }
  return { samples, sampleRate };
}

test("Nexi separates the short project entry from commissioning", () => {
  assert.match(projectPage, /Nexi – dein eigener Sprach- und Soundassistent/);
  assert.match(projectPage, /Nexi auf dein Board flashen/);
  assert.match(projectPage, /href="inbetriebnahme\/index\.html"/);
  assert.doesNotMatch(projectPage, /Tastenhilfe|Aktivierungswort im Browser|Nexi funktioniert sofort – online|rebuild-account-grid/);
  assert.match(commissioningPage, /Nexi in Betrieb nehmen/);
  assert.match(commissioningPage, /1 Firmware[\s\S]*2 Inbetriebnahme/);
  assert.match(commissioningPage, /ohne Terminal und ohne Satzliste zum Merken/);
});

test("Nexi page identifies all five physical buttons without an ambiguous middle button", () => {
  assert.match(commissioningPage, /USB-C-Anschluss oben/);
  assert.match(commissioningPage, /RESET[\s\S]*BOOT[\s\S]*KEY3[\s\S]*KEY2[\s\S]*KEY1/);
  assert.match(commissioningPage, /KEY3 ist die mittlere aller fünf Tasten/);
  assert.match(commissioningPage, /KEY2 liegt direkt zwischen KEY3 und der äußersten KEY1/);
  assert.match(commissioningPage, /nexi-board-guide\.css/);
});

test("local audio features accept a matching signal and reject a different one", () => {
  const referenceA = lab.extractFeatures(sineWave(500).samples, 16000);
  const referenceB = lab.extractFeatures(sineWave(510).samples, 16000);
  const referenceC = lab.extractFeatures(sineWave(490).samples, 16000);
  const matching = lab.extractFeatures(sineWave(505).samples, 16000);
  const different = lab.extractFeatures(sineWave(2500).samples, 16000);

  assert.ok(referenceA.length >= 12);
  const matchingResult = lab.evaluateCandidate(
    [referenceA, referenceB, referenceC], matching);
  const differentResult = lab.evaluateCandidate(
    [referenceA, referenceB, referenceC], different);
  assert.equal(matchingResult.detected, true);
  assert.ok(matchingResult.confidence >= 75);
  assert.equal(differentResult.detected, false);
  assert.ok(differentResult.confidence < 50);
});

test("wake-word lab has no upload, persistence or speech-to-text path", () => {
  const source = fs.readFileSync(
    path.join(publicRoot, "nachbauprojekte/nexi-sprachassistent/nexi-wake-word-lab-ui.js"),
    "utf8",
  );
  assert.match(source, /getUserMedia/);
  assert.match(source, /MediaRecorder/);
  assert.doesNotMatch(source, /fetch\s*\(|XMLHttpRequest|WebSocket|localStorage|indexedDB|SpeechRecognition/);
});
