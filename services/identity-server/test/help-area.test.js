const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const appRoot = path.join(__dirname, "..", "public", "app");
const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
const app = fs.readFileSync(path.join(appRoot, "app.js"), "utf8");
const css = fs.readFileSync(path.join(appRoot, "app.css"), "utf8");
const helpContent = fs.readFileSync(path.join(appRoot, "help-content.js"), "utf8");
const helpView = fs.readFileSync(path.join(appRoot, "help-view.js"), "utf8");
const helpChatService = fs.readFileSync(path.join(appRoot, "help-chat-service.js"), "utf8");
const webshopAccountSeparationDoc = fs.readFileSync(path.join(__dirname, "..", "..", "..", "docs", "webshop-account-separation.md"), "utf8");

test("keeps Help reachable through the main menu and renders it as a dedicated view", () => {
  assert.match(html, /href="\/hilfe\/">Hilfe<\/a>/);
  assert.match(html, /class="utility public-information-link" href="\/">Startseite<\/a>/);
  assert.match(html, /class="utility public-information-link" href="\/app\/auth\/">Anmelden<\/a>/);
  assert.match(html, /data-open-route="\/wissen\/"[\s\S]*Wissensportal/);
  assert.match(html, /id="helpView"/);
  assert.match(html, /id="helpMount"/);
  assert.match(html, /class="platform-footer"[\s\S]*Startseite[\s\S]*Warum GerNetiX\?[\s\S]*Hilfe/);
  assert.doesNotMatch(html.match(/class="platform-footer"[\s\S]*/)?.[0] || "", /href="\/app\/vision\/"/);
  assert.match(app, /help: "helpView"/);
  assert.match(app, /knowledge: "helpView"/);
  assert.match(app, /label: "Hilfe", route: "\/hilfe\/"/);
  assert.match(app, /function renderHelpTopic\(\)/);
  assert.match(app, /HelpView\.render\(\{/);
  assert.match(css, /\.help-layout \{/);
  assert.match(css, /\.help-topic-navigation \{/);
  assert.match(css, /@media \(max-width: 760px\)/);
});

test("keeps help content, navigation and assistant integration independently extensible", () => {
  assert.match(html, /id="helpMount"/);
  assert.match(html, /help-content\.js/);
  assert.match(html, /help-chat-service\.js/);
  assert.match(html, /help-view\.js/);
  assert.match(helpContent, /const topics = \[/);
  assert.match(helpContent, /"provision-new-board"[\s\S]*Neues Board in Betrieb nehmen/);
  assert.match(helpContent, /"usb-wifi-setup"/);
  assert.match(helpContent, /"flash-device": \{[\s\S]*Geräte flashen: USB, OTA oder FlashBox\?/);
  assert.match(helpContent, /OTA bedeutet Over-the-Air/);
  assert.match(helpContent, /WLAN-zu-USB-\/Serial-Brücke/);
  assert.match(helpContent, /SSID und Passwort/);
  assert.match(helpContent, /Captive Portal/);
  assert.match(helpContent, /title: "Ingenieursmäßig denken"[\s\S]*title: "Elektrotechnik"[\s\S]*title: "Mikrocontroller und Embedded"[\s\S]*title: "Informatik und Software"[\s\S]*title: "Verteilte Systeme"[\s\S]*title: "Die Künstliche Intelligenz"/);
  assert.match(helpContent, /title: "Informatik und Software"[\s\S]*"software-basics-introduction"[\s\S]*"workers-and-queues"/);
  assert.match(helpContent, /title: "Lexikon"[\s\S]*"glossary-basics"/);
  assert.match(helpContent, /title: "Elektrotechnik"[\s\S]*"physical-limits"[\s\S]*"sampling-rate"[\s\S]*"sensors"[\s\S]*"actuators"[\s\S]*"embedded-safety"/);
  assert.match(helpContent, /title: "Mikrocontroller und Embedded"[\s\S]*"hardware-landscape"[\s\S]*"processor-overview"[\s\S]*"microcontroller-basics"[\s\S]*"bus-systems"[\s\S]*"embedded-measurement-debugging"/);
  assert.match(helpContent, /"processor-overview"[\s\S]*"microcontroller-basics"[\s\S]*"microcontroller-flashing"[\s\S]*"microcontroller-pwm"[\s\S]*"embedded-measurement-debugging"/);
  assert.match(helpContent, /"microcontroller-basics": \{[\s\S]*Wie Software in einen Mikrocontroller kommt[\s\S]*Speicherorganisation[\s\S]*Register[\s\S]*GPIO[\s\S]*ADC[\s\S]*Timer[\s\S]*PWM/);
  assert.match(helpContent, /Der Name kommt vom Flash-Speicher selbst[\s\S]*älteren, einzeln löschbaren EEPROMs/);
  assert.match(helpContent, /Aus Quelltext wird eine Firmware-Datei[\s\S]*Der Bootloader öffnet den Programmierweg[\s\S]*Löschen, schreiben und prüfen[\s\S]*Start nach dem Flashen/);
  assert.match(helpContent, /"physical-limits": \{[\s\S]*Absolute Maximum Ratings[\s\S]*absolute Grenzwerte[\s\S]*Strom pro Pin und Gesamtstrom[\s\S]*Maximale Frequenz und Prozessortakt/);
  assert.match(helpContent, /"sampling-rate": \{[\s\S]*Nyquist-Shannon-Abtasttheorem[\s\S]*Aliasing[\s\S]*Abtastrate praktisch wählen/);
  assert.match(helpContent, /"sensors": \{[\s\S]*Sensortypen[\s\S]*I²C[\s\S]*Messschaltungen[\s\S]*Spannungsteiler/);
  assert.match(helpContent, /"actuators": \{[\s\S]*Aktor-Typen[\s\S]*Schaltungen zur Ansteuerung[\s\S]*MOSFETs[\s\S]*Freilaufdiode/);
  assert.match(helpContent, /"bus-systems": \{[\s\S]*Chip-zu-Chip-Schnittstellen[\s\S]*I²C[\s\S]*SPI[\s\S]*Feld- und Systembusse[\s\S]*CAN[\s\S]*RS-485/);
  assert.match(helpContent, /title: "Querschnittsthemen"[\s\S]*"privacy-basics", title: "Datenschutz in vernetzten Projekten"/);
  assert.match(helpContent, /title: "Verteilte Systeme"[\s\S]*"distributed-systems-introduction"[\s\S]*"communication-basics"[\s\S]*"local-servers"[\s\S]*"internet-vps"[\s\S]*"cloud-services"[\s\S]*"choosing-servers"/);
  assert.doesNotMatch(helpContent, /title: "Öffentliche Informationen"/);
  assert.match(helpContent, /children: \[\s*\{ id: "registration-login-recovery", title: "Einloggen und Konto anlegen"[\s\S]*\{ id: "create-account", title: "Konto anlegen"[\s\S]*\{ id: "quick-start", title: "So startest du"/);
  assert.match(helpContent, /"quick-start": \{[\s\S]*title: "So startest du"[\s\S]*Dein erstes Projekt[\s\S]*Wie geht es weiter\?/);
  assert.match(helpContent, /"create-account": \{[\s\S]*title: "Konto anlegen"[\s\S]*heading: "Registrierung"/);
  assert.match(helpContent, /"create-account"[\s\S]*"account-types"[\s\S]*"plan-comparison"/);
  assert.match(helpContent, /"provision-new-board"[\s\S]*"event-worker-rules"[\s\S]*"event-dispatcher"/);
  assert.match(helpContent, /"quick-start"[\s\S]*"supported-devices"/);
  assert.match(helpContent, /"update-profiles"[\s\S]*Wann wählt man was\?/);
  assert.match(helpView, /help-article-table/);
  assert.match(helpView, /function openDialog\(topicId\)/);
  assert.match(helpView, /help-topic-dialog-close/);
  assert.match(helpView, /Ask GerNetiX Help/);
  assert.match(helpView, /data-help-topic/);
  assert.match(helpView, /relatedTopics/);
  assert.match(helpChatService, /help-assistant\/chat/);
  assert.match(helpChatService, /relatedTopics/);
  assert.match(css, /\.help-chat \{/);
  assert.match(css, /\.help-topic-group \{/);
  assert.match(helpContent, /"ai-premium"/);
  assert.match(helpContent, /externe KI-Anbieter/);
  assert.match(helpView, /KI-Unterstuetzung ist im Premium-Abo enthalten/);
  assert.match(helpView, /access\.premium/);
});

test("shows compatible hardware from the catalog and explains USB provisioning limits", () => {
  assert.match(helpContent, /"compatible-hardware"/);
  assert.match(helpContent, /iPhone und iPad/);
  assert.match(helpContent, /GerNetiX Serial Service[\s\S]*Alle Schritte bleiben in der GerNetiX-Oberfläche/);
  assert.match(helpContent, /Android eignen sich für mobile Bedienung, aber nicht als verlässlicher USB-Host/);
  assert.match(helpContent, /GerNetiX-Webshop[\s\S]*geeigneten Basissoftware/);
  assert.match(helpView, /api\/platform\/hardware\/processor-boards/);
  assert.match(helpView, /function renderHardwareCard/);
  assert.match(helpView, /compatibleHardwareCatalog/);
  assert.match(css, /\.help-hardware-card/);
});

test("groups supported boards into one help topic instead of individual board topics", () => {
  const navigation = helpContent.match(/const topics = \[[\s\S]*?const articles/)?.[0] || "";
  assert.match(navigation, /"supported-devices", title: "Unterstützte Boards"/);
  assert.doesNotMatch(navigation, /"esp32-overview"/);
  assert.doesNotMatch(navigation, /"esp32-s3"/);
  assert.doesNotMatch(navigation, /"esp32-c6"/);
  assert.match(helpContent, /"supported-devices"[\s\S]*hardwareCatalog: true/);
  assert.match(helpContent, /Die Sammlung/);
});

test("keeps a public processor-family overview separate from concrete supported boards", () => {
  const navigation = helpContent.match(/const topics = \[[\s\S]*?const articles/)?.[0] || "";
  assert.match(navigation, /title: "Mikrocontroller und Embedded"/);
  assert.match(navigation, /"processor-overview", title: "ESP32-Prozessorfamilien im Vergleich"/);
  assert.match(helpContent, /"processor-overview": \{/);
  assert.match(helpContent, /ESP32-C5/);
  assert.match(helpContent, /ESP32-C61/);
  assert.match(helpContent, /ESP32-H2/);
  assert.match(helpContent, /ESP32-P4/);
  assert.match(helpContent, /C3 hat kein Zigbee und kein Thread/);
  assert.match(helpContent, /Kein WLAN/);
  assert.match(helpContent, /keine ESP32-S6-Familie/);
  assert.match(helpContent, /Unterstuetzte Boards ansehen/);
});

test("keeps the hardware landscape as a public page in the common help model", () => {
  assert.match(helpContent, /"hardware-landscape", title: "Hardware-Landkarte: vom Akku bis Edge AI"[\s\S]*"distributed-systems-introduction", title: "Wenn zwei Welten zusammenarbeiten"[\s\S]*"server-systems", title: "Systemlandschaften und Server"/);
  assert.match(helpContent, /"hardware-landscape": \{[\s\S]*access: "public"/);
  assert.match(helpContent, /Raspberry Pi Pico/);
  assert.match(helpContent, /Raspberry Pi Zero 2 W/);
  assert.match(helpContent, /GPU-Edge-Computing/);
  assert.match(helpView, /function renderHardwareVisual/);
  assert.match(helpView, /function renderSystemLandscapeVisual/);
  assert.match(helpView, /function renderServerTypesVisual/);
  assert.match(helpContent, /id: "distributed-systems"[\s\S]*serverLandscape: true/);
  assert.match(helpView, /topic\.serverLandscape \? renderServerTypesVisual\(\) : ""/);
  assert.match(helpView, /server-types-root[\s\S]*Server[\s\S]*server-types-list/);
  assert.match(helpView, /IoT-Geräte[\s\S]*Server[\s\S]*Apps/);
  assert.match(helpView, /Lokal · Internet\/VPS · Cloud/);
  assert.match(helpView, /Mobil · PC\/Mac · Web/);
  assert.match(helpView, /help-hardware-landscape knowledge-system-landscape/);
  assert.match(helpContent, /systemLandscape: true/);
  assert.match(css, /\.knowledge-system-landscape/);
  assert.match(css, /\.server-types-landscape/);
  assert.match(helpContent, /serverLandscape: true/);
  assert.match(css, /\.help-hardware-landscape/);
});

test("opens the knowledge portal with engineering thinking and the Tamagotchi learning journey", () => {
  const navigation = helpContent.match(/const topics = \[[\s\S]*?const articles/)?.[0] || "";
  assert.match(navigation, /id: "engineering-thinking"[\s\S]*title: "Ingenieursmäßig denken"[\s\S]*"from-problem-to-system"/);
  assert.match(helpContent, /"from-problem-to-system": \{[\s\S]*Nicht Technologie, sondern Problem[\s\S]*Wissen, Analyse und KI/);
  assert.match(helpContent, /KI verändert den Zugang[\s\S]*keine eigenen Wünsche[\s\S]*Verantwortung für die Folgen/);
  assert.match(helpContent, /Viele Wege ins Lernen[\s\S]*Lernprojektkatalog/);
  assert.match(helpContent, /Die Tamagotchi-Lernreise[\s\S]*Zustandsautomat[\s\S]*Zustände synchronisiert[\s\S]*Identität und Berechtigungen/);
  assert.match(helpContent, /Was das mit Industrie zu tun hat[\s\S]*kleiner Mikrocontroller/);
  assert.match(helpContent, /Welche Grundlagen verteilte Systeme brauchen[\s\S]*Ein Widerstand, Kondensator, Transistor oder fest verdrahtetes Logikgatter[\s\S]*Firmware/);
  assert.match(helpContent, /Du musst dafür nicht von Anfang an alles können[\s\S]*Konzentriere dich zunächst auf deine Stärken[\s\S]*Schritt für Schritt in das andere Fachgebiet einarbeiten/);
});

test("explains what software is from source code to embedded, backend and apps", () => {
  const navigation = helpContent.match(/const topics = \[[\s\S]*?const articles/)?.[0] || "";
  assert.match(navigation, /id: "software-basics"[\s\S]*title: "Informatik und Software"[\s\S]*"software-basics-introduction"/);
  assert.match(helpContent, /"software-basics-introduction": \{[\s\S]*access: "public"/);
  assert.match(helpContent, /Warum gibt es Software\?[\s\S]*Kompilieren: in Maschinencode übersetzen/);
  assert.match(helpContent, /Bibliotheken: bewährte Bausteine nutzen[\s\S]*Skripte, Interpreter und Laufzeitumgebungen/);
  assert.match(helpContent, /Firmware auf Mikrocontrollern: klein, schnell und berechenbar[\s\S]*MicroPython/);
  assert.match(helpContent, /Backend: Entwicklungsgeschwindigkeit zählt[\s\S]*Node\.js[\s\S]*Python/);
  assert.match(helpContent, /PC, Tablet und Smartphone: beide Welten[\s\S]*plattformübergreifenden App/);
});

test("explains embedded measurement technology and approachable debugging", () => {
  const navigation = helpContent.match(/const topics = \[[\s\S]*?const articles/)?.[0] || "";
  assert.match(navigation, /"embedded-measurement-debugging", title: "Embedded-Systeme: Messtechnik und Debugging"/);
  assert.match(helpContent, /"embedded-measurement-debugging": \{[\s\S]*access: "public"/);
  assert.match(helpContent, /Software trifft Elektronik/);
  assert.match(helpContent, /löten/);
  assert.match(helpContent, /Messmittel/);
  assert.match(helpContent, /Messtechnik: erst messen, dann raten[\s\S]*Multimeter[\s\S]*Oszilloskop[\s\S]*Logikanalysator/);
  assert.match(helpContent, /Debugwerkzeuge: moderne Hilfe statt unnötiger Hürden[\s\S]*JTAG[\s\S]*KI kann heute Logausgaben/);
  assert.match(helpContent, /Ein ruhiger Debug-Ablauf/);
});

test("explains electrical and functional safety without normalizing vehicle modifications", () => {
  const navigation = helpContent.match(/const topics = \[[\s\S]*?const articles/)?.[0] || "";
  assert.match(navigation, /"embedded-safety", title: "Elektrische und funktionale Sicherheit"/);
  assert.match(helpContent, /"embedded-safety": \{[\s\S]*access: "public"/);
  assert.match(helpContent, /Strom durch den Körper ist entscheidend/);
  assert.match(helpContent, /50 V Wechselspannung und 120 V Gleichspannung/);
  assert.match(helpContent, /Funktionale Sicherheit: Wenn korrektes Funktionieren Leben schützt/);
  assert.match(helpContent, /ungünstigste vorhersehbare Situation/);
  assert.match(helpContent, /Keine Basteländerungen an sicherheitskritischen Fahrzeugfunktionen/);
  assert.match(helpContent, /keine Änderungen an Fahrzeugbussen, Lenkung, Bremse, Airbag-, Rückhalte- oder Antriebssystemen/);
});

test("explains privacy as data minimization, transparency and protection", () => {
  const navigation = helpContent.match(/const topics = \[[\s\S]*?const articles/)?.[0] || "";
  assert.match(navigation, /"privacy-basics", title: "Datenschutz in vernetzten Projekten"/);
  assert.match(helpContent, /"privacy-basics": \{[\s\S]*access: "public"/);
  assert.match(helpContent, /Was personenbezogene Daten sein können/);
  assert.match(helpContent, /Daten minimieren/);
  assert.match(helpContent, /Lokal verarbeiten, wenn möglich/);
  assert.match(helpContent, /Datenschutz und Sicherheit gehören zusammen/);
});

test("explains optional embedded, local, global and iPhone system landscapes in public help", () => {
  const navigation = helpContent.match(/const topics = \[[\s\S]*?const articles/)?.[0] || "";
  assert.match(navigation, /id: "distributed-systems"[\s\S]*"server-systems", title: "Systemlandschaften und Server"/);
  assert.match(helpContent, /"distributed-systems-introduction": \{[\s\S]*Ein verteiltes System verbindet die physische Welt mit Software[\s\S]*Die Rollen sind verschieden/);
  assert.match(helpContent, /"server-systems": \{[\s\S]*access: "public"/);
  assert.match(helpContent, /Vom IoT-Device-Bus zur App[\s\S]*IoT-Geräte[\s\S]*Server: Lokal[\s\S]*Server: Internet\/VPS[\s\S]*Server: Cloud[\s\S]*Apps: Mobil[\s\S]*Apps: PC\/Mac und Web/);
  assert.match(helpContent, /Nicht jedes Projekt braucht alles/);
  assert.match(helpContent, /Die Kostenfalle Cloud-Computing/);
  assert.match(helpContent, /Automatische Skalierung verstärkt nicht nur erfolgreiche Anwendungen, sondern auch Fehler/);
  assert.match(helpContent, /Endlosschleifen oder fehlende Abbruchbedingungen/);
  assert.match(helpContent, /Jede Ausführung muss begrenzt sein/);
  assert.match(helpContent, /Budgets und Warnmeldungen aktivieren/);
  assert.match(helpContent, /Batteriebetriebener Temperatursensor[\s\S]*Hausautomation mit Fernzugriff[\s\S]*Maschinenüberwachung an mehreren Standorten/);
  assert.match(helpContent, /"glossary-basics": \{[\s\S]*Fachbegriffe einfach erklärt[\s\S]*Edge Computing[\s\S]*Gateway[\s\S]*Latenz[\s\S]*API[\s\S]*Offline-first[\s\S]*Container[\s\S]*JTAG[\s\S]*Funktionale Sicherheit/);
  assert.match(helpContent, /Lokaler Server[\s\S]*Klassischer dedizierter Server[\s\S]*VPS \(Virtual Private Server\)[\s\S]*Cloud-Dienste/);
  assert.match(helpContent, /Performance[\s\S]*Sicherheit[\s\S]*Skalierbarkeit[\s\S]*Betriebsaufwand/);
  assert.match(helpContent, /Web-App, API, kleine bis mittlere Datenbanken, VPN, Staging/);
  assert.match(helpContent, /GerNetiX nutzt für seine Plattform einen VPS/);
  assert.match(helpContent, /"choosing-servers": \{[\s\S]*Wie du auswählst[\s\S]*Mit kleinster sinnvoller Architektur beginnen/);
  const cloudChapter = helpContent.match(/"cloud-services": \{[\s\S]*?"workers-and-queues": \{/s)?.[0] || "";
  assert.match(cloudChapter, /Die Kostenfalle Cloud-Computing[\s\S]*Typische Ursachen[\s\S]*Jede Ausführung muss begrenzt sein/);
  const internetVpsChapter = helpContent.match(/"internet-vps": \{[\s\S]*?"cloud-services": \{/s)?.[0] || "";
  assert.match(internetVpsChapter, /Auswirkungen im Alltag[\s\S]*Performance[\s\S]*Sicherheit[\s\S]*Skalierbarkeit[\s\S]*Betriebsaufwand/);
});

test("offers event worker rule help as a central account help topic", () => {
  assert.match(helpContent, /"event-worker-rules", title: "Ereignis-Worker und Regelsprache"/);
  assert.match(helpContent, /event\.type == \\"taste_gedrueckt\\"/);
  assert.match(helpContent, /Keine Schleifen und keine eigenen Funktionen/);
  assert.match(helpContent, /Was bedeutet true oder false/);
  assert.match(helpContent, /Vergleichsoperatoren/);
  assert.match(helpContent, /und – beide Seiten müssen wahr sein/);
  assert.match(helpContent, /Tamagotchi-Zustandsmaschine/);
  assert.match(helpContent, /state\.hunger >= 80/);
  assert.match(helpContent, /So wird das Diagramm als Variablenmodell abgebildet/);
  assert.match(helpContent, /state\.life_state/);
  assert.doesNotMatch(helpContent, /state\.mode/);
  assert.match(helpView, /function renderStateChart/);
  assert.match(css, /\.help-state-chart \{/);
  assert.match(helpView, /function renderTamagotchiUmlStateChart/);
  assert.match(helpContent, /UML-Statechart lesen/);
  assert.match(helpContent, /Der ausgefüllte Punkt ist der Start/);
  assert.match(css, /\.help-uml-state-chart \{/);
});

test("groups worker and dispatcher help beneath project support", () => {
  const navigation = helpContent.match(/const topics = \[[\s\S]*?const articles/)?.[0] || "";
  assert.match(navigation, /title: "Geräte und Projekte"/);
  assert.match(navigation, /"event-worker-rules", title: "Ereignis-Worker und Regelsprache"/);
  assert.match(navigation, /"event-dispatcher", title: "Ereignis-Dispatcher"/);
  assert.match(helpContent, /"event-dispatcher": \{/);
  assert.match(helpContent, /Dispatcher ist nicht Push/);
});

test("explains account access, recovery and current versus planned entitlements", () => {
  const navigation = helpContent.match(/const topics = \[[\s\S]*?const articles/)?.[0] || "";
  assert.match(navigation, /title: "Start und Zugang"/);
  assert.match(navigation, /"account-types", title: "Kontotypen und Zugangsstufen"/);
  assert.match(navigation, /"webshop-activation-codes", title: "Webshop, E-Mail und Aktivierungscodes"/);
  assert.match(helpContent, /"registration-login-recovery"/);
  assert.match(helpContent, /Passkey ist Pflicht; persoenliches Offline-Recovery-Set/);
  assert.match(helpContent, /Konto einrichten abschließen/);
  assert.match(helpContent, /ESP32-Recovery-Token/);
  assert.match(helpContent, /Kampagnen-Premium-Token/);
  assert.match(helpContent, /Heute in der Plattform/);
  assert.match(helpContent, /Basis Plus, Kampagnen und Hardware-Bundles/);
  assert.match(helpContent, /Dispatcher oder Background Worker braucht/);
});

test("documents webshop email separation and activation codes in Identity help", () => {
  assert.match(webshopAccountSeparationDoc, /GerNetiX trennt den Webshop fachlich vom GerNetiX-Account/);
  assert.match(webshopAccountSeparationDoc, /Die Webshop-E-Mail = Kontakt-, Rechnungs- und Versandadresse|Kontakt- und Nachweisadresse/);
  assert.match(webshopAccountSeparationDoc, /Aktivierungscode verbindet einen Kauf mit einem GerNetiX-Account/);
  assert.match(webshopAccountSeparationDoc, /Premium jaehrlich inkl\. Home Server/);
  assert.match(webshopAccountSeparationDoc, /Shop-E-Mail und GerNetiX-Account werden nicht automatisch gleichgesetzt/);
  assert.match(helpContent, /"webshop-activation-codes": \{/);
  assert.match(helpContent, /Der Webshop verkauft Produkte\. GerNetiX verwaltet die technische Nutzung/);
  assert.match(helpContent, /Ein Kauf erzeugt nicht automatisch ein GerNetiX-Konto/);
  assert.match(helpContent, /Wofuer braucht der Webshop eine E-Mail\?/);
  assert.match(helpContent, /Bestellbestaetigung und Rechnung/);
  assert.match(helpContent, /Aktivierungscode ist die Bruecke zwischen Kauf und GerNetiX-Account/);
  assert.match(helpContent, /Premium jaehrlich inkl\. Home Server[\s\S]*Aktivierungscode schaltet Premium und Home-Server-Nutzung frei/);
  assert.match(helpContent, /Die Webshop-E-Mail ist keine Passwort-Anmeldung fuer GerNetiX/);
});

test("offers a public, factual comparison of basis, basis plus and premium", () => {
  const navigation = helpContent.match(/const topics = \[[\s\S]*?const articles/)?.[0] || "";

  assert.match(navigation, /"plan-comparison", title: "Basis, Basis Plus und Premium vergleichen"/);
  assert.match(helpContent, /"plan-comparison": \{/);
  assert.match(helpContent, /Basis Plus ist noch nicht buchbar/);
  assert.match(helpContent, /noch kein eigenes serverseitiges Entitlement/);
  assert.match(helpContent, /KI-Hilfe in Entwicklung, Code Explorer und Hilfe/);
  assert.match(helpContent, /Web Push f.r Projektbenachrichtigungen/);
});

test("links account setup to the personal offline recovery set", () => {
  assert.match(html, /id="createOfflineRecoverySetButton"/);
  assert.match(html, /id="offlineRecoverySetDialog"/);
  assert.match(app, /api\/account\/offline-recovery-set/);
  assert.match(app, /Recovery-Set erstellen/);
});

test("separates the knowledge portal from platform help while reusing one surface", () => {
  const server = fs.readFileSync(path.join(__dirname, "..", "src", "dev-server.js"), "utf8");
  assert.match(helpContent, /const articleAccess =/);
  assert.match(helpContent, /"first-project": "premium"/);
  assert.match(helpContent, /"register-device": "account"/);
  assert.match(helpView, /function renderPaywall/);
  assert.match(helpView, /Premium-Inhalt/);
  assert.match(helpView, /help-access-badge/);
  assert.match(css, /\.help-paywall/);
  assert.match(server, /\["\/hilfe", "\/hilfe\/", "\/wissen", "\/wissen\/"\]\.includes\(url\.pathname\)[\s\S]*serveStatic\(res, appDir, "\/index\.html"\)/);
  assert.doesNotMatch(server, /url\.pathname === "\/app\/help"/);
  assert.match(app, /const isPublicHelpPage/);
  assert.match(app, /const isPublicKnowledgePage/);
  assert.match(app, /label: state\.account \? "Plattform" : "Startseite", route: state\.account \? "\/app\/dashboard\/" : "\/"/);
  assert.match(app, /if \(link\.dataset\.breadcrumbRoute === "\/"\) \{[\s\S]*?window\.location\.assign\("\/"\)/);
  assert.match(app, /document\.body\.classList\.add\("public-help-page", "public-information-anonymous"\)/);
  assert.match(app, /public-information-anonymous/);
  assert.match(app, /getJson\("\/api\/platform\/summary"\)/);
  assert.match(helpContent, /surface: "knowledge"/);
  assert.match(helpContent, /surface: "help"/);
  assert.match(helpContent, /"workers-and-queues"/);
  assert.match(helpView, /Wissensportal/);
  assert.match(helpView, /findParentTopic/);
  assert.match(helpView, /"\/wissen\/"/);
  assert.match(helpView, /function renderKnowledgeBook/);
  assert.match(helpView, /Hauptkapitel \$\{index \+ 1\}/);
  assert.match(helpView, /const chapterNumber = `\$\{index \+ 1\}\.\$\{childIndex \+ 1\}`/);
  assert.match(helpView, /knowledge-chapter-number/);
  assert.match(helpView, /knowledge-subchapter-link/);
  assert.match(helpView, /knowledge-subchapter-number/);
  assert.match(helpView, /data-knowledge-subchapter/);
  assert.match(helpView, /<details class="knowledge-book-toc" open>/);
  assert.match(helpView, /<details class="knowledge-part-toc" open>/);
  assert.match(helpView, /<details class="knowledge-chapter-toc" open>/);
  assert.doesNotMatch(helpView, /Kapitel lesen|Unterkapitel/);
  assert.match(css, /\.knowledge-part-toc > summary/);
  assert.match(helpView, /Kapitelübersicht öffnen oder schließen/);
  assert.match(helpView, /function renderPracticeLessonLink/);
  assert.match(helpView, /knowledge-topic=/);
  assert.match(helpView, /if \(!access\.hasAccount\)/);
  assert.match(helpView, /Anmeldung erforderlich · Demo-Link/);
  assert.match(helpView, /Demo-Link · Zuordnung zu einer Lesson folgt/);
  assert.match(helpView, /data-knowledge-chapter/);
  assert.match(helpView, /renderArticle\(chapter, child, \{ showRelated: false, chapterNumber \}\)/);
  assert.match(helpView, /knowledge-part-link/);
  assert.match(helpView, /data-knowledge-part/);
  assert.match(helpView, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
  assert.match(helpView, /const syncChapterWithScroll/);
  assert.match(helpView, /window\.addEventListener\("scroll", knowledgeScrollHandler/);
  assert.match(css, /\.knowledge-book-navigation/);
  assert.match(css, /\.knowledge-book-toc summary/);
  assert.match(css, /\.knowledge-book-toc\[open\] summary::after/);
  assert.match(css, /\.knowledge-part-link/);
  assert.match(css, /\.knowledge-book-chapter \{ scroll-margin-top/);
  assert.match(css, /\.knowledge-subchapter-link/);
  assert.match(css, /\.help-practice-lesson/);
  assert.match(css, /\.help-practice-lesson\.is-disabled/);
  assert.match(css, /body\.public-help-page/);
  assert.match(css, /body\.public-help-page \.topbar \{ position: sticky; top: 0; z-index: 50; \}/);
  assert.match(css, /body\.public-help-page \.app-menu \{ position: fixed; top: 80px; right: 22px; z-index: 60; \}/);
  assert.match(css, /body\.public-information-anonymous #mainMenu a:not\(\.public-information-link\)/);
});
