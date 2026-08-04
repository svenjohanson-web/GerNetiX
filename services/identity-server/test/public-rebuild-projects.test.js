const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.join(__dirname, "..");
const page = fs.readFileSync(path.join(root, "public", "nachbauprojekte", "index.html"), "utf8");
const motorProject = fs.readFileSync(path.join(root, "public", "nachbauprojekte", "einfache-elektromotoren", "index.html"), "utf8");
const printedMotorSeries = fs.readFileSync(path.join(root, "public", "nachbauprojekte", "druckmotoren", "index.html"), "utf8");
const hw364aGames = fs.readFileSync(path.join(root, "public", "nachbauprojekte", "hw364a-spielesammlung", "index.html"), "utf8");
const nexiProject = fs.readFileSync(path.join(root, "public", "nachbauprojekte", "nexi-sprachassistent", "index.html"), "utf8");
const nexiFlash = fs.readFileSync(path.join(root, "public", "nachbauprojekte", "nexi-sprachassistent", "nexi-flash.js"), "utf8");
const motorFieldIllustration = fs.readFileSync(path.join(root, "public", "assets", "motor-learning-current-magnetic-field.svg"), "utf8");
const motorForceIllustration = fs.readFileSync(path.join(root, "public", "assets", "motor-learning-current-force.svg"), "utf8");
const motorCoilIllustration = fs.readFileSync(path.join(root, "public", "assets", "motor-learning-simple-coil-force-pair-v2.png"));
const motorReedBeforeIllustration = fs.readFileSync(path.join(root, "public", "assets", "motor-learning-reed-timing-before.svg"), "utf8");
const motorReedOnIllustration = fs.readFileSync(path.join(root, "public", "assets", "motor-learning-reed-timing-on.svg"), "utf8");
const motorReedAfterIllustration = fs.readFileSync(path.join(root, "public", "assets", "motor-learning-reed-timing-after.svg"), "utf8");
const knowledgeAppRoot = path.join(root, "public", "app");
const knowledgeContent = fs.readdirSync(knowledgeAppRoot)
  .filter((file) => /^knowledge-articles-.*\.js$/.test(file))
  .sort()
  .map((file) => fs.readFileSync(path.join(knowledgeAppRoot, file), "utf8"))
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

test("publishes Nexi as a complete, prebuilt and directly flashable rebuild project", () => {
  assert.match(server, /path: "\/nachbauprojekte\/nexi-sprachassistent"[\s\S]*redirect\(res, "\/nachbauprojekte\/nexi-sprachassistent\/"\)/);
  assert.match(server, /path: "\/nachbauprojekte\/nexi-sprachassistent\/"[\s\S]*serveStatic\(res, publicDir, "\/nachbauprojekte\/nexi-sprachassistent\/index\.html"\)/);
  assert.match(page, /href="\/nachbauprojekte\/nexi-sprachassistent\/"/);
  assert.match(page, /Nexi – dein eigener Sprachassistent/);
  assert.match(page, /Fertig gebaut · direkt flashbar/);
  assert.match(page, /Öffnen &amp; flashen →/);
  assert.match(nexiProject, /Was ist Nexi\?/);
  assert.match(nexiProject, /Stimme aufnehmen[\s\S]*Effekte ausprobieren[\s\S]*Direkt am Board spielen/);
  assert.match(nexiProject, /ES8311, ES7210, TCA9555 und PCF85063/);
  assert.match(nexiProject, /KEY1[\s\S]*KEY2[\s\S]*KEY3/);
  assert.match(nexiProject, /lokale Grundfunktion benötigt weder Cloud noch KI-Anbieter/);
  assert.match(server, /pattern: \/\^\\\/nachbauprojekte\\\/nexi-sprachassistent\\\/api\\\//);
  assert.match(nexiProject, /Installation[\s\S]*Nexi auf dein Board bringen/);
  assert.match(nexiProject, /Installationsstatus[\s\S]*Fertig gebaut und direkt flashbar[\s\S]*href="#installieren"/);
  assert.ok(nexiProject.indexOf('id="about-nexi-title"') < nexiProject.indexOf('id="equipment-title"'));
  assert.ok(nexiProject.indexOf('id="equipment-title"') < nexiProject.indexOf('id="installieren"'));
  assert.ok(nexiProject.indexOf('id="installieren"') < nexiProject.indexOf('id="usage-title"'));
  assert.match(nexiProject, /Deine erste Aufnahme in vier Schritten/);
  assert.doesNotMatch(nexiProject, /Der Nachbau in sechs prüfbaren Schritten|Ehrlicher Softwarestand/);
  assert.match(nexiProject, /ohne Konto und ohne eigenen Build/);
  assert.match(nexiProject, /id="choose-port"/);
  assert.doesNotMatch(nexiProject, /id="retry-release"|Release erneut laden/);
  assert.match(nexiProject, /id="flash-button"/);
  assert.match(nexiProject, /id="flash-button"[^>]*aria-describedby="flash-status"[^>]*disabled/);
  assert.match(nexiProject, /id="flash-status"[^>]*>Noch nicht möglich: Zuerst muss der geprüfte Release geladen und ein USB-Port gewählt werden\./);
  assert.doesNotMatch(nexiProject, /id="flash-step" hidden/);
  assert.match(nexiProject, /nexi-flash\.js/);
  assert.match(nexiFlash, /const DEMO_ID = "nexi-basic-waveshare-s3"/);
  assert.match(nexiFlash, /manifest\.chip !== "esp32s3"/);
  assert.match(nexiFlash, /manifest\.flash_size !== "16MB"/);
  assert.match(nexiFlash, /Das verbundene Gerät ist kein ESP32-S3/);
  assert.match(nexiFlash, /loader\.detectFlashSize\(\)/);
  assert.match(nexiFlash, /await sha256\(data\) !== asset\.sha256/);
  assert.match(nexiFlash, /loader\.writeFlash/);
  assert.match(nexiFlash, /serialService\.flash/);
  assert.match(nexiFlash, /function setActionEnabled\(button, enabled, reasonNode, message\)/);
  assert.match(nexiFlash, /button\.title = enabled \? "" : message/);
  assert.match(nexiFlash, /fetch\(`api\/public\/demos\/\$\{DEMO_ID\}`.*, \{ cache: "no-store" \}\)/);
  assert.match(nexiFlash, /releaseRetryTimer = window\.setTimeout\(loadRelease, 5000\)/);
  assert.match(nexiFlash, /if \(navigator\.serial\)/);
  assert.match(nexiFlash, /USB-Zugriff einrichten/);
  assert.match(nexiProject, /kein aktiver Provider|Ohne aktiven Provider/);
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
