const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(root, "public", "nachbauprojekte", "index.html"), "utf8");
const motorProject = fs.readFileSync(path.join(root, "public", "nachbauprojekte", "einfache-elektromotoren", "index.html"), "utf8");
const printedMotorSeries = fs.readFileSync(path.join(root, "public", "nachbauprojekte", "druckmotoren", "index.html"), "utf8");
const modularMakerCar = fs.readFileSync(path.join(root, "public", "nachbauprojekte", "modulares-maker-auto", "index.html"), "utf8");
const hw364aGames = fs.readFileSync(path.join(root, "public", "nachbauprojekte", "hw364a-spielesammlung", "index.html"), "utf8");
const radarRoomPresenceRoot = path.join(root, "public", "nachbauprojekte", "radar-raumpraesenz");
const radarRoomPresence = fs.readFileSync(path.join(radarRoomPresenceRoot, "index.html"), "utf8");
const pirMotionDetector = fs.readFileSync(path.join(root, "public", "nachbauprojekte", "pir-bewegungsmelder", "index.html"), "utf8");
const monitorVcpController = fs.readFileSync(path.join(root, "public", "nachbauprojekte", "esp-kvm", "index.html"), "utf8");
const nexiProject = fs.readFileSync(path.join(root, "public", "nachbauprojekte", "nexi-sprachassistent", "index.html"), "utf8");
const nexiCommissioning = fs.readFileSync(path.join(root, "public", "nachbauprojekte", "nexi-sprachassistent", "inbetriebnahme", "index.html"), "utf8");
const nexiFlash = fs.readFileSync(path.join(root, "public", "nachbauprojekte", "nexi-sprachassistent", "nexi-flash.js"), "utf8");
const publicNavigation = fs.readFileSync(path.join(root, "public", "landing.js"), "utf8");
const publicHeaderCss = fs.readFileSync(path.join(root, "public", "public-header.css"), "utf8");
const motorFieldIllustration = fs.readFileSync(path.join(root, "public", "assets", "motor-learning-current-magnetic-field.svg"), "utf8");
const motorForceIllustration = fs.readFileSync(path.join(root, "public", "assets", "motor-learning-current-force.svg"), "utf8");
const motorCoilIllustration = fs.readFileSync(path.join(root, "public", "assets", "motor-learning-simple-coil-force-pair-v2.png"));
const motorReedBeforeIllustration = fs.readFileSync(path.join(root, "public", "assets", "motor-learning-reed-timing-before.svg"), "utf8");
const motorReedOnIllustration = fs.readFileSync(path.join(root, "public", "assets", "motor-learning-reed-timing-on.svg"), "utf8");
const motorReedAfterIllustration = fs.readFileSync(path.join(root, "public", "assets", "motor-learning-reed-timing-after.svg"), "utf8");
const knowledgeSourceRoot = path.join(root, "src", "knowledge", "articles");
const knowledgeContent = fs.readdirSync(knowledgeSourceRoot)
  .filter((file) => /^knowledge-articles-.*\.js$/.test(file))
  .sort()
  .map((file) => fs.readFileSync(path.join(knowledgeSourceRoot, file), "utf8"))
  .join("\n");
const informationView = fs.readFileSync(path.join(root, "public", "app", "information-view.js"), "utf8");
const server = ["dev-server.js", path.join("dev", "server", "web-routes.js")]
  .map((file) => fs.readFileSync(path.join(root, "src", file), "utf8"))
  .join("\n");

test("serves the public project catalog and links directly to the available project", () => {
  assert.match(server, /\["\/nachbauprojekte", "\/nachbauprojekte\/"\][\s\S]*serveStatic\(res, publicDir, "\/nachbauprojekte\/index\.html"\)/);
  assert.match(server, /path: "\/s3-touch-spielesammlung"[\s\S]*proxyPublicDemo/);
  assert.match(server, /pattern: \/\^\\\/demos[\s\S]*redirect\(res, `\/s3-touch-spielesammlung\//);
  assert.match(page, /ESP32-S3 Touch Game Collection/);
  assert.match(page, /MakerWorld/);
  assert.match(page, /href="\/s3-touch-spielesammlung\/"/);
  assert.doesNotMatch(page, /href="\/entdecken\/"|GerNetiX entdecken/);
  assert.match(page, /href="\/nachbauprojekte\/" aria-current="page">Projekte zum Nachbauen/);
  assert.match(page, /href="\/flashbox-einrichten\/">FlashBox einrichten/);
  assert.match(page, /installiere die Spielesammlung per WebSerial/);
  assert.doesNotMatch(page, /Ver&ouml;ffentlichung folgt/);
});

test("keeps the authenticated session visible in the public rebuild-project navigation", () => {
  assert.match(publicNavigation, /fetch\("\/api\/session", \{[\s\S]*credentials: "same-origin"/);
  assert.match(publicNavigation, /if \(!session\.authenticated\) return;[\s\S]*showAuthenticatedPublicNavigation\(session\.account\)/);
  assert.match(publicNavigation, /createNavigationLink\("\/app\/dashboard\/", "Übersicht", "platform\.nav\.dashboard"\)/);
  assert.match(publicNavigation, /createNavigationGroup\("Lernen & Entwickeln"[\s\S]*createNavigationGroup\("Boards & Werkzeuge"[\s\S]*createNavigationGroup\("Service & Shop"[\s\S]*createNavigationGroup\("Konto"/);
  assert.match(publicNavigation, /createNavigationLink\("\/app\/messages\/", "Nachrichten"\)/);
  assert.match(publicNavigation, /fetch\("\/api\/logout", \{ method: "POST", credentials: "same-origin" \}\)/);
  assert.match(publicNavigation, /if \(response\.ok\) window\.location\.assign\("\/"\)/);
  assert.match(publicHeaderCss, /\.site-menu-group > summary/);
  assert.match(publicHeaderCss, /\.site-menu a\[data-public-logout\]/);
});

test("publishes a stepwise motor rebuild project in the public catalog", () => {
  assert.match(server, /path: "\/nachbauprojekte\/einfache-elektromotoren"[\s\S]*redirect\(res, "\/nachbauprojekte\/einfache-elektromotoren\/"\)/);
  assert.match(server, /path: "\/nachbauprojekte\/einfache-elektromotoren\/"[\s\S]*serveStatic\(res, publicDir, "\/nachbauprojekte\/einfache-elektromotoren\/index\.html"\)/);
  assert.match(page, /Einfache Elektromotoren bauen/);
  assert.match(page, /href="\/nachbauprojekte\/einfache-elektromotoren\/"/);
  assert.match(page, /id="electronics-ten-minutes-title">Elektronik in 10 Minuten<\/h2>[\s\S]*href="\/nachbauprojekte\/einfache-elektromotoren\/"/);
  assert.match(page, /class="panel maker-project-tile"/);
  assert.doesNotMatch(page, /maker-release-card|<dl>|maker-project-note/);
  assert.match(motorProject, /Strom → Magnetfeld → Kraft → Drehmoment → Kommutierung/);
  assert.match(motorProject, /id="elektromagnet"[\s\S]*id="kraftversuch"[\s\S]*id="spulenmotor"[\s\S]*id="reedmotor"[\s\S]*id="hallmotor"[\s\S]*id="homopolarmotor"/);
  assert.match(motorProject, /Motor 1 · Mechanische Kommutierung/);
  assert.match(motorProject, /Motor 2 · Lageabhängiger Impuls/);
  assert.match(motorProject, /Motor 3 · Elektronische Kommutierung/);
});

test("publishes a modular 3D-printed motor rebuild series", () => {
  assert.match(server, /path: "\/nachbauprojekte\/druckmotoren"[\s\S]*redirect\(res, "\/nachbauprojekte\/druckmotoren\/"\)/);
  assert.match(server, /path: "\/nachbauprojekte\/druckmotoren\/"[\s\S]*serveStatic\(res, publicDir, "\/nachbauprojekte\/druckmotoren\/index\.html"\)/);
  assert.match(page, /id="printed-motors-title">Motoren aus dem 3D-Drucker<\/h2>/);
  assert.match(page, /href="\/nachbauprojekte\/druckmotoren\/"/);
  assert.match(page, /Fünf Druckmotor-Stufen/);
  assert.match(printedMotorSeries, /Von der Lorentzkraft bis zum axialen Luftspulen-BLDC/);
  assert.match(printedMotorSeries, /Grobe Ausstattung/);
  assert.match(printedMotorSeries, /Kupferdraht, kleine Magnete und später eine Metallwelle mit Kugellagern/);
  assert.match(printedMotorSeries, /3D-Drucker und einfaches Lötwerkzeug/);
  assert.match(printedMotorSeries, /Multimeter und Tischnetzgerät sind hilfreich/);
  assert.match(printedMotorSeries, /Lorentzkraft sichtbar machen[\s\S]*Reed-Impulsmotor[\s\S]*Mehrspuliger DC-Impulsmotor[\s\S]*Elektronisch kommutierter Motor[\s\S]*Dreiphasiger axialer Luftspulen-BLDC/);
  assert.doesNotMatch(printedMotorSeries, /printed-motor-matrix|printed-motor-project-explanation|Was wird sichtbar\?|Was kommt hinzu\?|Was wird verbessert\?|Was wird elektronisch\?|Was macht ihn zum BLDC\?/);
});

test("publishes the HW-364A one-button game collection as an additional rebuild project", () => {
  assert.match(server, /path: "\/nachbauprojekte\/hw364a-spielesammlung"[\s\S]*redirect\(res, "\/nachbauprojekte\/hw364a-spielesammlung\/"\)/);
  assert.match(server, /path: "\/nachbauprojekte\/hw364a-spielesammlung\/"[\s\S]*serveStatic\(res, publicDir, "\/nachbauprojekte\/hw364a-spielesammlung\/index\.html"\)/);
  assert.match(page, /href="\/nachbauprojekte\/hw364a-spielesammlung\/"/);
  assert.match(page, /HW-364A: Cat Jump &amp; Cave Bat/);
  assert.match(hw364aGames, /Cat Jump und Cave Bat auf einem winzigen OLED/);
  assert.match(hw364aGames, /FLASH-Taster an GPIO0/);
  assert.match(hw364aGames, /SDA GPIO14 und SCL GPIO12/);
  assert.match(hw364aGames, /Build geprüft, Hardware-Abnahme noch offen/);
  assert.match(hw364aGames, /öffentlicher WebSerial-Download wird hier ergänzt/);
});

test("publishes a modular laser-cut and 3D-printed ESP32 maker car concept", () => {
  assert.match(server, /path: "\/nachbauprojekte\/modulares-maker-auto"[\s\S]*redirect\(res, "\/nachbauprojekte\/modulares-maker-auto\/"\)/);
  assert.match(server, /path: "\/nachbauprojekte\/modulares-maker-auto\/"[\s\S]*serveStatic\(res, publicDir, "\/nachbauprojekte\/modulares-maker-auto\/index\.html"\)/);
  assert.match(page, /href="\/nachbauprojekte\/modulares-maker-auto\/"/);
  assert.match(page, /Modulares Maker-Auto mit ESP32 bauen/);
  assert.match(page, /Projektkonzept · CAD und Firmware offen/);
  assert.match(modularMakerCar, /Baue ein ferngesteuertes Auto, das mit deinen Ideen mitwächst/);
  assert.match(modularMakerCar, /zwei gebürstete 3–6-V-TT-Getriebemotoren/);
  assert.match(modularMakerCar, /TB6612FNG-Zweikanal-Motortreiber/);
  assert.match(modularMakerCar, /Amazon-Suchliste · Stand August 2026/);
  assert.match(modularMakerCar, /ESP32\+DevKit\+WROOM-32\+USB-C/);
  assert.match(modularMakerCar, /35–55 €/);
  assert.match(modularMakerCar, /lose 18650-Zellen/);
  assert.match(modularMakerCar, /Vier AA-NiMH-Zellen/);
  assert.match(modularMakerCar, /GPIO26 \/ GPIO27[\s\S]*GPIO32 \/ GPIO33[\s\S]*GPIO18/);
  assert.match(modularMakerCar, /300-ms-Watchdog/);
  assert.match(modularMakerCar, /TT-Bürstenmotor[\s\S]*N20-Getriebemotor[\s\S]*sensored BLDC/);
  assert.match(modularMakerCar, /Ein Fahrzeuganschluss, zuerst ein Ultraschallhalter/);
  assert.match(modularMakerCar, /HC-SR04[\s\S]*GPIO23[\s\S]*GPIO34/);
  assert.match(modularMakerCar, /1 kΩ[\s\S]*2 kΩ[\s\S]*ungefähr 3,3 V/);
  assert.match(modularMakerCar, /Unter 40 cm[\s\S]*unter 20 cm/);
  assert.match(modularMakerCar, /ultrasonic\.front/);
  assert.match(modularMakerCar, /Ungültige und veraltete Messungen[\s\S]*nie als freie Fahrt/);
  assert.doesNotMatch(modularMakerCar, /LD2410C|24-GHz-Radar|radar\.front|Radar und Ultraschall/);
  assert.match(modularMakerCar, /Sechs Ausbaustufen/);
  assert.match(modularMakerCar, /CAD-Dateien, Firmware und reale Hardware-Abnahme sind noch offen/);
  assert.doesNotMatch(modularMakerCar, /Fertig gebaut · direkt flashbar|>Jetzt flashen</);
});

test("publishes a Forgejo-backed ESP32 and Arduino Nano radar room-presence rebuild project", () => {
  assert.match(server, /path: "\/nachbauprojekte\/radar-raumpraesenz"[\s\S]*redirect\(res, "\/nachbauprojekte\/radar-raumpraesenz\/"\)/);
  assert.match(server, /path: "\/nachbauprojekte\/radar-raumpraesenz\/"[\s\S]*serveStatic\(res, publicDir, "\/nachbauprojekte\/radar-raumpraesenz\/index\.html"\)/);
  assert.match(page, /href="\/nachbauprojekte\/radar-raumpraesenz\/"/);
  assert.match(page, /Raumpräsenz mit Radar, ESP32 oder Arduino Nano erkennen/);
  assert.match(page, /Quellprojekt · Hardware-Abnahme offen/);
  assert.match(radarRoomPresence, /Raumpräsenz zuverlässig erkennen – ohne Kamera/);
  assert.match(radarRoomPresence, /HLK-LD2410C/);
  assert.match(radarRoomPresence, /VCC → ESP32 5V\/VIN/);
  assert.match(radarRoomPresence, /UART_TX → ESP32 GPIO16 \/ RX2/);
  assert.match(radarRoomPresence, /OUT → ESP32 GPIO27/);
  assert.match(radarRoomPresence, /klassischer Arduino Nano \(ATmega328P\)/);
  assert.match(radarRoomPresence, /LD2410C OUT → Nano D2/);
  assert.match(radarRoomPresence, /UART_TX und UART_RX:[\s\S]*zunächst nicht verbinden/);
  assert.match(radarRoomPresence, /nanoatmega328[\s\S]*nanoatmega328new/);
  assert.match(radarRoomPresence, /Getrenntes Forgejo-Produktprojekt/);
  assert.match(radarRoomPresence, /GerNetiX-Projekte\/radar-raumpraesenz/);
  assert.match(radarRoomPresence, /drei Worker-Ziele/);
  assert.match(radarRoomPresence, /Repository-Provisionierung, Remote-Push und ein öffentlicher Quellzugang stehen noch aus/);
  assert.doesNotMatch(radarRoomPresence, /href="platformio\.ini"|href="src\/main\.cpp"|href="build\.(?:bat|sh|command)"/);
  for (const localSource of ["platformio.ini", "src/main.cpp", "build.bat", "build.sh", "build.command"]) {
    assert.equal(fs.existsSync(path.join(radarRoomPresenceRoot, ...localSource.split("/"))), false);
  }
  assert.match(radarRoomPresence, /mindestens 200 mA/);
  assert.match(radarRoomPresence, /Leerer Raum[\s\S]*ruhiges Sitzen[\s\S]*Ventilator[\s\S]*Nachbarraum/);
  assert.match(radarRoomPresence, /href="\/wissen\/#sensor-fmcw-radar"/);
  assert.match(radarRoomPresence, /catalog=build-your-own-proximity-sensor/);
  assert.match(radarRoomPresence, /Spezialisierung von „IoT-Device mit Sensor“/);
  assert.match(radarRoomPresence, /href="\/app\/development-platform\/\?template=iot_device_radar"/);
  assert.doesNotMatch(radarRoomPresence, /Fertig gebaut · direkt flashbar|>Jetzt flashen</);
});

test("publishes a source-first PIR motion-detector rebuild project for ESP32 and Arduino Nano", () => {
  assert.match(server, /path: "\/nachbauprojekte\/pir-bewegungsmelder"[\s\S]*redirect\(res, "\/nachbauprojekte\/pir-bewegungsmelder\/"\)/);
  assert.match(server, /path: "\/nachbauprojekte\/pir-bewegungsmelder\/"[\s\S]*serveStatic\(res, publicDir, "\/nachbauprojekte\/pir-bewegungsmelder\/index\.html"\)/);
  assert.match(page, /href="\/nachbauprojekte\/pir-bewegungsmelder\/"/);
  assert.match(page, /Bewegung mit PIR, ESP32 oder Arduino Nano erkennen/);
  assert.match(pirMotionDetector, /HC-SR501/);
  assert.match(pirMotionDetector, /GPIO27/);
  assert.match(pirMotionDetector, /Nano D2/);
  assert.match(pirMotionDetector, /keine Präsenz/);
  assert.match(pirMotionDetector, /Komponenten\/ESP32-Bewegungsmelder/);
  assert.match(pirMotionDetector, /Komponenten\/Arduino-Nano-Bewegungsmelder/);
  assert.match(pirMotionDetector, /führend im privaten[\s\S]*Forgejo-Repository/);
  assert.match(pirMotionDetector, /Mit einem GerNetiX-Konto/);
  assert.match(pirMotionDetector, /href="\/app\/development-platform\/\?template=esp32_device_only"/);
  assert.doesNotMatch(pirMotionDetector, /href="platformio\.ini"|href="src\/main\.cpp"/);
  assert.doesNotMatch(pirMotionDetector, /Fertig gebaut · direkt flashbar|>Jetzt flashen</);
});

test("publishes ESP KVM with an explicit local desktop bridge", () => {
  assert.match(server, /path: "\/nachbauprojekte\/esp8266-monitor-vcp"[\s\S]*redirect\(res, "\/nachbauprojekte\/esp-kvm\/"\)/);
  assert.match(server, /path: "\/nachbauprojekte\/esp-kvm"[\s\S]*redirect\(res, "\/nachbauprojekte\/esp-kvm\/"\)/);
  assert.match(server, /path: "\/nachbauprojekte\/esp-kvm\/"[\s\S]*serveStatic\(res, publicDir, "\/nachbauprojekte\/esp-kvm\/index\.html"\)/);
  assert.match(page, /href="\/nachbauprojekte\/esp-kvm\/"/);
  assert.match(page, /ESP KVM/);
  assert.match(monitorVcpController, /DDC\/CI/);
  assert.match(monitorVcpController, /lokale Desktop-Brücke/);
  assert.match(monitorVcpController, /GPIO0/);
  assert.match(monitorVcpController, /GPIO14/);
  assert.match(monitorVcpController, /GPIO12/);
  assert.match(monitorVcpController, /kein direkter Zugriff des ESP8266 auf den Monitor/);
  assert.match(monitorVcpController, /ESP32-2432S028/);
  assert.match(monitorVcpController, /kein ESP32-S3/);
  assert.match(monitorVcpController, /ILI9341-Display mit XPT2046-Touch/);
  assert.doesNotMatch(monitorVcpController, /Fertig gebaut · direkt flashbar|>Jetzt flashen</);
});

test("publishes Nexi as a complete, prebuilt and directly flashable rebuild project", () => {
  assert.match(server, /path: "\/nachbauprojekte\/nexi-sprachassistent"[\s\S]*redirect\(res, "\/nachbauprojekte\/nexi-sprachassistent\/"\)/);
  assert.match(server, /path: "\/nachbauprojekte\/nexi-sprachassistent\/"[\s\S]*serveStatic\(res, publicDir, "\/nachbauprojekte\/nexi-sprachassistent\/index\.html"\)/);
  assert.match(server, /path: "\/nachbauprojekte\/nexi-sprachassistent\/inbetriebnahme\/"[\s\S]*serveStatic\(res, publicDir, "\/nachbauprojekte\/nexi-sprachassistent\/inbetriebnahme\/index\.html"\)/);
  assert.match(page, /href="\/nachbauprojekte\/nexi-sprachassistent\/"/);
  assert.match(page, /Nexi – dein eigener Sprachassistent/);
  assert.match(page, /Fertig gebaut · direkt flashbar/);
  assert.match(page, /Öffnen &amp; flashen →/);
  assert.match(nexiProject, /Nexi – dein eigener Sprach- und Soundassistent/);
  assert.match(nexiProject, /Sprache lokal erkennen[\s\S]*Stimmen aufnehmen und verändern[\s\S]*Spiele, Geschichten und Timer/);
  assert.match(nexiProject, /Die Grundversion funktioniert ohne Konto/);
  assert.match(nexiProject, /Sprachaufnahmen werden nicht in die Cloud geladen/);
  assert.doesNotMatch(nexiProject, /rebuild-account-grid|rebuild-feature-list|Tastenhilfe|Aktivierungswort im Browser/);
  assert.match(server, /pattern: \/\^\\\/nachbauprojekte\\\/nexi-sprachassistent\\\/api\\\//);
  assert.match(nexiProject, /Schritt 1 von 2[\s\S]*Nexi auf dein Board flashen/);
  assert.match(nexiProject, /Nach erfolgreichem Flashen öffnet sich automatisch[\s\S]*Schritt 2: Inbetriebnahme/);
  assert.match(nexiProject, /href="inbetriebnahme\/index\.html"/);
  assert.match(nexiCommissioning, /Schritt 2 von 2[\s\S]*Nexi in Betrieb nehmen/);
  assert.match(nexiCommissioning, /RESET[\s\S]*BOOT[\s\S]*KEY3[\s\S]*KEY2[\s\S]*KEY1/);
  assert.match(nexiCommissioning, /RGB-Ringfarben[\s\S]*Die drei Nexi-Tasten[\s\S]*class="nexi-actions-title">Inbetriebnahme[\s\S]*integrierten Lautsprecher prüfen[\s\S]*Nexi Schritt für Schritt auf deine Stimme einrichten/);
  assert.doesNotMatch(nexiCommissioning, /Die drei Nexi-Tasten testen/);
  assert.match(nexiCommissioning, /data-nexi-guided-setup[\s\S]*data-setup-guide[\s\S]*data-setup-repeat/);
  assert.doesNotMatch(nexiCommissioning, /nicht verfügbar|Nutzerablauf freigegeben|bisherige Liste/);
  assert.match(nexiProject, /Grundversion funktioniert ohne Konto/);
  assert.match(nexiProject, /kein eigener Build ist erforderlich/);
  assert.match(nexiProject, /id="open-flash-dialog"/);
  assert.match(nexiProject, /id="retry-release"[^>]*hidden>Release erneut prüfen/);
  assert.match(nexiProject, /id="open-flash-dialog"[^>]*aria-describedby="flash-entry-status"[^>]*disabled/);
  assert.match(nexiProject, /unified-flash-dialog\.js/);
  assert.match(nexiProject, /nexi-flash\.js/);
  assert.match(nexiProject, /nexi-flash\.js\?v=20260807-action-ops-1/);
  assert.match(nexiFlash, /const DEMO_ID = "nexi-basic-waveshare-s3"/);
  assert.match(nexiFlash, /manifest\.chip !== "esp32s3"/);
  assert.match(nexiFlash, /manifest\.flash_size !== "16MB"/);
  assert.match(nexiFlash, /Das verbundene Gerät ist kein ESP32-S3/);
  assert.match(nexiFlash, /loader\.detectFlashSize\(\)/);
  assert.match(nexiFlash, /await sha256\(data\) !== asset\.sha256/);
  assert.match(nexiFlash, /loader\.writeFlash/);
  assert.match(nexiFlash, /serialService\.flash/);
  assert.match(nexiFlash, /GerNetiXFlashDialog\.create\(\)/);
  assert.match(nexiFlash, /progressPresentation: "guided"/);
  assert.match(nexiFlash, /window\.location\.assign\("inbetriebnahme\/index\.html"\)/);
  assert.match(nexiFlash, /methods:\s*\{[\s\S]*usb:[\s\S]*ota:[\s\S]*flashbox:/);
  assert.match(nexiFlash, /openFlashButton\.title = enabled \? "" : message/);
  assert.match(nexiFlash, /fetch\(`api\/public\/demos\/\$\{DEMO_ID\}`.*, \{ cache: "no-store" \}\)/);
  assert.match(nexiFlash, /retryReleaseButton\.addEventListener\("click", loadRelease\)/);
  assert.match(nexiFlash, /retryReleaseButton\.hidden = false/);
  assert.doesNotMatch(nexiFlash, /setTimeout\(loadRelease, 5000\)/);
  assert.match(nexiFlash, /if \(navigator\.serial\)/);
  assert.match(nexiFlash, /async function ensureUsbPort\(log, action\)/);
  assert.match(nexiFlash, /if \(ports\.length > 1\)/);
});

test("keeps the printed motor series compact and material-first", () => {
  assert.ok(printedMotorSeries.indexOf('id="serienmaterial"') < printedMotorSeries.indexOf('id="projekte"'));
  for (let motorNumber = 1; motorNumber <= 5; motorNumber += 1) {
    const start = printedMotorSeries.indexOf(`id="motor-${motorNumber}"`);
    const end = motorNumber < 5 ? printedMotorSeries.indexOf(`id="motor-${motorNumber + 1}"`) : printedMotorSeries.indexOf("</section>", start);
    const project = printedMotorSeries.slice(start, end);
    assert.ok(start >= 0);
    assert.match(project, /<h3>/);
    assert.match(project, /<strong>Drucken:<\/strong>/);
    assert.match(project, /<strong>Zukauf:<\/strong>/);
  }
  assert.doesNotMatch(printedMotorSeries, /<table|motor-comparison-table-wrap|id="downloads"|printed-motor-download-grid|download-status|printed-motor-material-grid|material-badge/);
  assert.doesNotMatch(printedMotorSeries, /Sicher testen|compact-motor-safety/);
});

test("uses the motor diagrams at the matching build stages", () => {
  assert.match(motorProject, /motor-learning-current-magnetic-field\.svg/);
  assert.match(motorProject, /motor-learning-current-force\.svg/);
  assert.match(motorProject, /motor-learning-simple-coil-force-pair-v2\.png/);
  assert.equal(motorCoilIllustration.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
  assert.ok(motorCoilIllustration.length > 100_000);
  assert.match(motorProject, /motor-learning-reed-timing-on\.svg/);
  assert.match(motorProject, /motor-learning-transistor-switch\.svg/);
  assert.match(motorProject, /motor-learning-homopolar\.svg/);
});

test("shows the complete red positive lead from battery to the left brush", () => {
  assert.match(knowledgeContent, /motor-learning-simple-coil-force-pair-v2\.png/);
  assert.match(knowledgeContent, /rote Plusleiter führt von der Batterie außen am Hufeisenmagneten entlang zum linken Bürstenkontakt/);
  assert.match(motorProject, /gut sichtbarem rotem Plusleiter vom Batteriepol zum linken Bürstenkontakt/);
});

test("shows a physically consistent three-step switching sequence for the reed motor", () => {
  assert.match(knowledgeContent, /Reedkontakt-Motor: Die Rotorlage bestimmt den Einschaltzeitpunkt/);
  assert.match(knowledgeContent, /motor-learning-reed-timing-before\.svg[\s\S]*motor-learning-reed-timing-on\.svg[\s\S]*motor-learning-reed-timing-after\.svg/);
  assert.match(knowledgeContent, /In Bild 1, 2 und 3 bleiben Reedkontakt und Spule an derselben Stelle[\s\S]*Bild 1 zeigt den offenen Stromkreis[\s\S]*In Bild 2 liegt der Randmagnet nah am Reedkontakt[\s\S]*Bild 3 zeigt den Magneten hinter der Spule/);
  assert.match(motorReedBeforeIllustration, /Vor dem Schaltfenster[\s\S]*Reed offen[\s\S]*stromlos/);
  assert.match(motorReedOnIllustration, /Magnet im Schaltfenster[\s\S]*Reed geschlossen/);
  assert.match(motorReedOnIllustration, /Drehrichtung[\s\S]*Anziehung/);
  assert.match(motorReedAfterIllustration, /Magnet hinter der Spule[\s\S]*Reed wieder offen[\s\S]*läuft durch Trägheit weiter/);
  for (const illustration of [motorReedBeforeIllustration, motorReedOnIllustration, motorReedAfterIllustration]) {
    assert.match(illustration, /Rotormagnet[\s\S]*Schaltfenster[\s\S]*Spule fest[\s\S]*Batterie/);
    assert.match(illustration, /stop-color="#(?:111827|10231d)"[\s\S]*stop-color="#0b1220"/);
    assert.doesNotMatch(illustration, /Was passiert hier\?|Warum dreht er weiter\?|Warum läuft er weiter\?/);
  }
});

test("explains current, field and winding without ambiguous loose conductors", () => {
  assert.match(motorFieldIllustration, /Stromrichtung I/);
  assert.match(motorFieldIllustration, /Magnetfeld B/);
  assert.match(motorFieldIllustration, /Kupferleiter/);
  assert.match(motorFieldIllustration, /Kupferwicklung/);
  assert.match(motorFieldIllustration, /Gebündeltes Magnetfeld B/);
  assert.doesNotMatch(motorFieldIllustration, /stroke="#fff"/);
  assert.match(motorProject, /mehrere Wicklungsschleifen bündeln das Magnetfeld in einem weichmagnetischen Kern/);
});

test("shows the force experiment as one physically consistent three-dimensional setup", () => {
  assert.match(motorForceIllustration, /dreidimensionale Darstellung eines zusammenhängenden Hufeisenmagneten/);
  assert.match(motorForceIllustration, /Kupferleiter/);
  assert.match(motorForceIllustration, /Batterie/);
  assert.match(motorForceIllustration, /mittig und berührungslos im Luftspalt/);
  assert.match(motorForceIllustration, /Strom I/);
  assert.match(motorForceIllustration, /Magnetfeld B/);
  assert.match(motorForceIllustration, /Kraft F/);
  assert.match(motorForceIllustration, /<rect width="960" height="540" rx="28" fill="url\(#bg\)"\/>/);
  assert.match(motorProject, /Dreidimensionale Darstellung eines zusammenhängenden Hufeisenmagneten/);
});

test("links every motor build stage to knowledge and knowledge back to the project", () => {
  const links = [
    ["actuator-current-magnetic-field", "elektromagnet"],
    ["actuator-current-force", "kraftversuch"],
    ["actuator-simple-coil-motor", "spulenmotor"],
    ["actuator-reed-motor", "reedmotor"],
    ["actuator-transistor-motor", "hallmotor"],
    ["actuator-homopolar-motor", "homopolarmotor"],
  ];
  for (const [knowledgeId, projectId] of links) {
    assert.match(motorProject, new RegExp(`href="/wissen/#${knowledgeId}"`));
    assert.match(knowledgeContent, new RegExp(`href: "/nachbauprojekte/einfache-elektromotoren/#${projectId}"`));
  }
  assert.match(informationView, /section\.rebuildProjects/);
  assert.match(informationView, /Nachbauprojekt ansehen/);
});

test("keeps the motor builds inside a clear low-voltage safety boundary", () => {
  assert.match(motorProject, /Keine Netzspannung und keine offenen Lithium-Akkus/);
  assert.match(motorProject, /Widerstand jeder Spule messen/);
  assert.match(motorProject, /I = U \/ R/);
  assert.match(motorProject, /Freilaufdiode/);
  assert.match(motorProject, /Homopolarmotor nur mit echter Strombegrenzung/);
  assert.match(motorProject, /ähnelt elektrisch einem Kurzschluss/);
  assert.match(motorProject, /keinen Akku/);
});
