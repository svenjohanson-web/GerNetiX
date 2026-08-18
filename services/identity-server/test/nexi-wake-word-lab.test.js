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
const boardTopView = fs.readFileSync(
  path.join(publicRoot, "nachbauprojekte/nexi-sprachassistent/inbetriebnahme/nexi-board-top-view.svg"),
  "utf8",
);
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
  assert.match(commissioningPage, /RESET und BOOT sind Systemtasten/);
  assert.match(commissioningPage, /KEY1 bis KEY3/);
  assert.match(commissioningPage, /nexi-board-guide\.css/);
});

test("RGB ring and key explanations are outside the commissioning steps", () => {
  const explanationIndex = commissioningPage.indexOf("nexi-board-reference");
  const stepsIndex = commissioningPage.indexOf('<ol class="nexi-commissioning-steps">');
  assert.ok(explanationIndex >= 0 && explanationIndex < stepsIndex);
  assert.match(commissioningPage.slice(explanationIndex, stepsIndex), /RGB-Ringfarben[\s\S]*Die drei Nexi-Tasten/);
  assert.doesNotMatch(commissioningPage.slice(stepsIndex), /RGB-Ringfarben|Die drei Nexi-Tasten/);
  assert.match(commissioningPage, /Erklärung · kein Arbeitsschritt/);
});

test("UART-synchronized guided Nexi setup is part of commissioning", () => {
  const stepsStart = commissioningPage.indexOf('<ol class="nexi-commissioning-steps">');
  const stepsEnd = commissioningPage.indexOf("</ol>", stepsStart);
  const stepsMarkup = commissioningPage.slice(stepsStart, stepsEnd);
  assert.match(stepsMarkup, /Nexi Schritt für Schritt auf deine Stimme einrichten/);
  assert.match(commissioningPage, /data-nexi-guided-setup/);
  assert.match(commissioningPage, /data-setup-guide/);
  assert.match(commissioningPage, /data-setup-repeat/);
  assert.match(commissioningPage, /data-setup-phrase/);
  assert.match(commissioningPage, /serial-service-client\.js/);
  assert.match(commissioningPage, /nexi-wake-word-lab-ui\.js/);
  assert.doesNotMatch(commissioningPage, /nicht verfügbar|Nutzerablauf freigegeben|bisherige Liste/);
});

test("Nexi shows the complete round board in the verified front-side orientation", () => {
  assert.match(commissioningPage, /nexi-board-top-view\.svg/);
  assert.match(commissioningPage, /TF-\/microSD-Slot befindet sich links/);
  assert.match(commissioningPage, /rechten oberen Rundung/);
  assert.match(boardTopView, /<circle cx="350" cy="330" r="274"/);
  assert.match(boardTopView, /aria-label="TF microSD Kartenslot"/);
  assert.match(boardTopView, /aria-label="Zweireihige rechtwinklig abgewinkelte Stiftleiste"/);
  assert.match(boardTopView, /2×8 GEWINKELT/);
  assert.match(boardTopView, /RESET Beschriftung[\s\S]*BOOT Beschriftung[\s\S]*KEY3 Beschriftung[\s\S]*KEY2 Beschriftung[\s\S]*KEY1 Beschriftung/);
  assert.doesNotMatch(boardTopView, /Jede Linie zeigt zur Taste/);
  assert.match(boardTopView, /class="usb-label">USB-C/);
  assert.doesNotMatch(boardTopView, /class="key-line" d="[^"]*C/);
  assert.match(boardTopView, /M472 111H676L692 127/);
  assert.match(boardTopView, /M523 135H665L692 162/);
  assert.match(boardTopView, /M565 174H669L692 197/);
  assert.match(boardTopView, /M597 220H680L692 232/);
  assert.match(boardTopView, /M617 272H687L692 267/);
  assert.doesNotMatch(boardTopView, /M508 475H690V503/);
  assert.match(boardTopView, /Vollständige Draufsicht[\s\S]*Vorderseite des runden Boards/);
  assert.doesNotMatch(boardTopView, /links auf der Vorderseite/);
  assert.doesNotMatch(boardTopView, /Aufdruck ist lesbar/);
  assert.match(boardTopView, /RESET[\s\S]*BOOT[\s\S]*KEY3[\s\S]*KEY2[\s\S]*KEY1/);
  assert.match(boardTopView, /USB-C oben/);
});

test("Nexi describes the integrated speaker without requiring external wiring", () => {
  assert.match(projectPage, /Der Lautsprecher ist bereits integriert/);
  assert.match(commissioningPage, /integrierten Lautsprecher prüfen/);
  assert.match(commissioningPage, /musst nichts zusätzlich anschließen/);
  assert.doesNotMatch(`${projectPage}\n${commissioningPage}`, /passenden Lautsprecher|passiven Lautsprecher|Lautsprecher anschließen/);
});

test("guided setup mirrors the device state and never captures browser audio", () => {
  const source = fs.readFileSync(
    path.join(publicRoot, "nachbauprojekte/nexi-sprachassistent/nexi-wake-word-lab-ui.js"),
    "utf8",
  );
  assert.match(source, /GerNetiXSerialService/);
  assert.match(source, /nexi_setup_status/);
  assert.match(source, /nexi_setup_repeat/);
  assert.match(source, /payload\.step_index/);
  assert.match(source, /payload\.phrase/);
  assert.match(source, /payload\.expected_action/);
  assert.match(source, /setInterval[\s\S]*750/);
  assert.match(source, /SpeechSynthesisUtterance/);
  assert.match(source, /Bitte sprich mir nach/);
  assert.doesNotMatch(source, /nexi_voice_enroll|nexi_voice_test|nexi_voice_reset/);
  assert.doesNotMatch(source, /getUserMedia|MediaRecorder|AudioContext|webkitAudioContext|SpeechRecognition|localStorage|indexedDB/);
  assert.match(commissioningPage, /integrierten Mikrofone des Boards/);
  assert.match(commissioningPage, /Roh-Audio wird nicht an den Computer/);
  assert.doesNotMatch(commissioningPage, /nur in diesem Browser ausgewertet|Mikrofonfreigabe/);
  assert.equal(fs.existsSync(path.join(
    publicRoot, "nachbauprojekte/nexi-sprachassistent/nexi-wake-word-lab.js")), false);
});

test("guided setup prefers WebSerial and falls back to the native helper", () => {
  const source = fs.readFileSync(
    path.join(publicRoot, "nachbauprojekte/nexi-sprachassistent/nexi-wake-word-lab-ui.js"),
    "utf8",
  );
  assert.match(source, /navigator\.serial/);
  assert.match(source, /hasWebSerial/);
  assert.match(source, /GerNetiXSerialService/);
  assert.match(source, /createWebSerialTransport/);
  assert.match(source, /gernetix\.serial_provisioning/);
  assert.match(source, /request_id/);
  assert.match(source, /baudRate:\s*115200/);
  assert.match(source, /navigator\.serial\.getPorts/);
  assert.match(source, /navigator\.serial\.requestPort/);
  assert.match(source, /allowPrompt/);
  assert.match(source, /serial_permission_declined/);
  assert.match(source, /serial_transport_unavailable/);
  assert.match(source, /usbVendorId/);
  assert.match(source, /getInfo/);
  assert.match(source, /nexi_setup_repeat/);
  assert.doesNotMatch(source, /if \(!root \|\| !serialFactory\) return;/);
  assert.doesNotMatch(source, /nexi_setup_speak_prompt/);
});

test("the page shows all device-owned progress fields and the KEY2 action", () => {
  assert.match(commissioningPage, /data-setup-progress/);
  assert.match(commissioningPage, /data-setup-status/);
  assert.match(commissioningPage, /data-setup-action/);
  assert.match(commissioningPage, /data-setup-references/);
  assert.match(commissioningPage, /acht vollständige Sätze/);
  assert.match(commissioningPage, /KEY2 gedrückt/);
  assert.doesNotMatch(commissioningPage, /Referenz 1 aufnehmen|Erkennung testen|Neu beginnen/);
});
