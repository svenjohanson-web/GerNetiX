const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

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
  assert.doesNotMatch(html, /class="utility public-information-link" href="\/">Startseite<\/a>/);
  assert.match(html, /class="public-header-brand" href="\/" aria-label="GerNetiX Startseite"/);
  assert.match(html, /class="public-header-brand"[\s\S]*src="\/gernetix-wordmark\.png"/);
  assert.doesNotMatch(html, /href="\/produkte\/"/);
  assert.match(html, /class="utility public-information-link" href="\/community\/">Community<\/a>/);
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
  assert.match(helpContent, /title: "Ingenieursmäßig denken"[\s\S]*title: "Elektrotechnik"[\s\S]*title: "Sensorik und Aktorik"[\s\S]*title: "Mikrocontroller und Embedded"[\s\S]*title: "Informatik und Software"[\s\S]*title: "Verteilte Systeme"[\s\S]*title: "Die Künstliche Intelligenz"/);
  assert.match(helpContent, /title: "Informatik und Software"[\s\S]*"software-basics-introduction"[\s\S]*"workers-and-queues"/);
  assert.match(helpContent, /title: "Lexikon"[\s\S]*"glossary-basics"/);
  assert.match(helpContent, /title: "Elektrotechnik"[\s\S]*"physical-limits"[\s\S]*"sampling-rate"[\s\S]*"embedded-safety"[\s\S]*title: "Sensorik und Aktorik"[\s\S]*"sensors"[\s\S]*"actuators"/);
  assert.match(helpContent, /title: "Mikrocontroller und Embedded"[\s\S]*"hardware-landscape"[\s\S]*"processor-overview"[\s\S]*"microcontroller-basics"[\s\S]*"bus-systems"[\s\S]*"embedded-measurement-debugging"/);
  assert.match(helpContent, /"processor-overview"[\s\S]*"microcontroller-basics"[\s\S]*"microcontroller-flashing"[\s\S]*"microcontroller-pwm"[\s\S]*"embedded-measurement-debugging"/);
  assert.match(helpContent, /"microcontroller-basics": \{[\s\S]*Wie Software in einen Mikrocontroller kommt[\s\S]*Speicherorganisation[\s\S]*Register[\s\S]*GPIO[\s\S]*ADC[\s\S]*Timer[\s\S]*PWM/);
  assert.match(helpContent, /Der Name kommt vom Flash-Speicher selbst[\s\S]*älteren, einzeln löschbaren EEPROMs/);
  assert.match(helpContent, /Aus Quelltext wird eine Firmware-Datei[\s\S]*Der Bootloader öffnet den Programmierweg[\s\S]*Löschen, schreiben und prüfen[\s\S]*Start nach dem Flashen/);
  assert.match(helpContent, /"physical-limits": \{[\s\S]*Absolute Maximum Ratings[\s\S]*absolute Grenzwerte[\s\S]*Strom pro Pin und Gesamtstrom[\s\S]*Maximale Frequenz und Prozessortakt/);
  assert.match(helpContent, /"sampling-rate": \{[\s\S]*Nyquist-Shannon-Abtasttheorem[\s\S]*Aliasing[\s\S]*Abtastrate praktisch wählen/);
  assert.match(helpContent, /"sensors": \{[\s\S]*Sensoren nach Messgröße und Wirkprinzip ordnen[\s\S]*I²C[\s\S]*Messschaltungen[\s\S]*Spannungsteiler/);
  assert.match(helpContent, /"actuators": \{[\s\S]*Zwei Motorfamilien: Wechselstrom und Gleichstrom[\s\S]*Synchronmaschinen: mit einem drehenden Magnetfeld mitlaufen[\s\S]*Gleichstrommotoren: Reihenschluss, Nebenschluss und permanent erregt[\s\S]*Motoransteuerung: Leistungsteil und Firmware[\s\S]*MOSFETs[\s\S]*Freilaufdiode/);
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
  assert.match(helpView, /lokale Hilfe-Modell und ist für angemeldete Konten kostenlos/);
  assert.match(helpView, /access\.hasAccount/);
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
  assert.match(navigation, /id: "from-problem-to-system"[\s\S]*access: "public"/);
  assert.match(helpContent, /"from-problem-to-system": \{[\s\S]*Nicht Technologie, sondern Problem[\s\S]*Wissen, Analyse und KI/);
  assert.match(helpContent, /Ingenieursmäßiges Denken ist heute wichtiger denn je[\s\S]*nicht der Abschluss allein[\s\S]*Aufgeschlossenheit gegenüber neuen Technologien wie KI/);
  assert.match(helpContent, /Anforderungen präzisiert[\s\S]*Zwischenergebnisse versteht[\s\S]*passende Tests ableitet[\s\S]*wie eine KI eine Anforderung bestmöglich begreift/);
  assert.match(helpContent, /physikalischen, sicherheitstechnischen, normativen und systemischen Grenzen/);
  assert.match(helpContent, /engineering-thinking-craft[\s\S]*Planung, Ausführung und Nachweis[\s\S]*nachvollziehbare Nachweis/);
  assert.match(helpContent, /fachgerechte praktische Ausführung[\s\S]*wertvolles Erfahrungswissen in die Planung/);
  assert.match(helpContent, /keine starre Trennung[\s\S]*Ingenieure bauen Prototypen[\s\S]*Handwerker lösen technische Probleme/);
  assert.match(helpContent, /Viele Übungsaufgaben sind bewusst klar abgegrenzt[\s\S]*rechnerisch richtige Lösung muss sich erst in der Praxis bewähren/);
  assert.match(helpContent, /Basteln bedeutet[\s\S]*verstehen, entwickeln, erschaffen/);
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

test("teaches YAML fundamentals and points to the matching learning project", () => {
  const navigation = helpContent.match(/const topics = \[[\s\S]*?const articles/)?.[0] || "";
  assert.match(navigation, /title: "Informatik und Software"[\s\S]*"yaml-basics", title: "YAML: strukturierte Daten lesbar beschreiben"/);
  assert.match(navigation, /yaml-purpose[\s\S]*yaml-scalars[\s\S]*yaml-indentation[\s\S]*yaml-lists[\s\S]*yaml-text[\s\S]*yaml-errors[\s\S]*yaml-learning-project/);
  assert.match(helpContent, /"yaml-basics": \{[\s\S]*YAML ist keine Programmiersprache/);
  assert.match(helpContent, /Schlüssel und einfache Werte[\s\S]*Wahrheitswerte[\s\S]*null/);
  assert.match(helpContent, /Einrückung und Verschachtelung[\s\S]*keine Tabs/);
  assert.match(helpContent, /Listen und Objekte kombinieren[\s\S]*Bindestrich/);
  assert.match(helpContent, /Anführungszeichen und mehrzeiliger Text[\s\S]*Textblock/);
  assert.match(helpContent, /Typische Fehler und Validierung[\s\S]*Schema/);
  assert.match(helpContent, /kostenlose Lernprojekt „YAML-Grundlagen“[\s\S]*Pflanzenmonitor/);
});

test("distinguishes microcontroller storage, databases and file servers in Software", () => {
  const navigation = helpContent.match(/const topics = \[[\s\S]*?const articles/)?.[0] || "";
  assert.match(navigation, /title: "Informatik und Software"[\s\S]*"databases-and-storage", title: "Datenbanken, Speicher und Dateiserver"/);
  assert.match(navigation, /storage-is-not-always-a-database[\s\S]*microcontroller-storage[\s\S]*sql-and-sqlite[\s\S]*database-families[\s\S]*file-and-object-storage[\s\S]*choosing-data-storage[\s\S]*storage-learning-path/);
  assert.match(helpContent, /"databases-and-storage": \{[\s\S]*Speicher ist nicht automatisch eine Datenbank/);
  assert.match(helpContent, /Speicher ist nicht automatisch eine Datenbank[\s\S]*SQL ist dabei keine Datenbank, sondern eine Sprache/);
  assert.match(helpContent, /Was Mikrocontroller lokal speichern können[\s\S]*NVS[\s\S]*EEPROM[\s\S]*LittleFS[\s\S]*FatFS[\s\S]*Ringpuffer/);
  assert.match(helpContent, /SQLite ist eine echte relationale SQL-Datenbank, aber kein eigener Datenbankserver/);
  assert.match(helpContent, /PostgreSQL[\s\S]*MySQL[\s\S]*MariaDB/);
  assert.match(helpContent, /Dokumentendatenbank[\s\S]*Zeitreihendatenbank[\s\S]*Graphdatenbank[\s\S]*Vektordatenbank/);
  assert.match(helpContent, /Dateiserver und Objektspeicher[\s\S]*SMB[\s\S]*NFS[\s\S]*S3-Prinzip/);
  assert.match(helpContent, /Der Mikrocontroller speichert lokal[\s\S]*Zentrale Konten, projektübergreifende Historien oder Fernzugriff/);
  assert.match(helpContent, /Kleine Lernprojekte: vom Wert zur Datenbank[\s\S]*Werkstatt-Inventar im Arbeitsspeicher[\s\S]*ESP32-Einstellungswächter mit NVS oder EEPROM[\s\S]*LittleFS-Messwertlogbuch[\s\S]*SQLite-Pflanzeninventar[\s\S]*Lokales Projektarchiv mit SQLite-Metadaten/);
  assert.match(helpContent, /Ein eigener Redis- oder WebDAV-Server ist für den Einstieg nicht nötig[\s\S]*WebDAV ist eine optionale Erweiterung/);
  assert.match(helpContent, /catalog=storage-learning-story&lesson=development_lesson\.storage\.data_structures[\s\S]*lesson=development_lesson\.storage\.nvs[\s\S]*lesson=development_lesson\.storage\.littlefs[\s\S]*lesson=development_lesson\.storage\.sqlite[\s\S]*lesson=development_lesson\.storage\.file_archive/);
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

test("compares door position sensors through the chicken-door engineering task", () => {
  const navigation = helpContent.match(/const topics = \[[\s\S]*?const articles/)?.[0] || "";
  assert.match(navigation, /id: "sensors"[\s\S]*sensor-reed-contact[\s\S]*sensor-photoelectric[\s\S]*sensor-limit-switch[\s\S]*sensor-contact-bridge[\s\S]*sensor-chicken-door-task[\s\S]*sensor-selection-games[\s\S]*sensor-application-map/);
  assert.match(helpContent, /Reed-Kontakt: Schalten mit einem Magneten[\s\S]*Vorteile[\s\S]*Nachteile/);
  assert.match(helpContent, /Lichtschranke: Eine unterbrochene Lichtstrecke erkennen[\s\S]*Staub, Federn, Spinnweben/);
  assert.match(helpContent, /mechanischer Endschalter oder Positionsschalter[\s\S]*Mikroschalter[\s\S]*Rollenhebel/);
  assert.match(helpContent, /Leitende Kontaktbrücke[\s\S]*Oxidation und Korrosion/);
  assert.match(helpContent, /Induktiver Näherungssensor[\s\S]*Metallziel/);
  assert.match(helpContent, /Denkaufgabe: Endlagen einer automatischen Hühnerklappe[\s\S]*vollständig geöffnet[\s\S]*vollständig geschlossen/);
  assert.match(helpContent, /fälschlich „Tür geschlossen“[\s\S]*beide Endlagen gleichzeitig aktiv/);
});

test("offers interactive sensor selection games with scenario-specific reasoning", () => {
  assert.match(helpContent, /Frage-Antwort-Spiele: Welcher Sensor passt\?[\s\S]*CNC-Maschine: reproduzierbare Referenzfahrt/);
  assert.match(helpContent, /Metallspäne und Kühlschmierstoff[\s\S]*answer: "inductive"[\s\S]*Encoder oder ein Längenmesssystem/);
  assert.match(helpContent, /Fensteralarm: offen oder geschlossen[\s\S]*answer: "reed"[\s\S]*Sabotageerkennung/);
  assert.match(helpContent, /Förderband: Werkstücke zählen[\s\S]*answer: "photoelectric"/);
  assert.match(helpContent, /Außentor: Endlage mit Schlamm und Regen[\s\S]*Gekapselter induktiver Näherungssensor/);
  assert.match(helpContent, /Welcher Sensor passt wohin\?[\s\S]*Sicherheitskritische Schutztür[\s\S]*Zertifizierter Sicherheitssensor/);
  assert.match(helpView, /renderKnowledgeQuizzes[\s\S]*data-knowledge-quiz-check[\s\S]*Wähle zuerst eine Antwort aus\.[\s\S]*selected\.value === quiz\.dataset\.answer/);
  assert.match(css, /\.knowledge-quiz-list[\s\S]*\.knowledge-quiz-feedback\.correct[\s\S]*\.knowledge-quiz-feedback\.wrong/);
});

test("organizes sensor families by measured quantity and physical principle", () => {
  const navigation = helpContent.match(/id: "sensors", title: "Sensoren"[\s\S]*?\]\s*\},/)?.[0] || "";
  assert.match(navigation, /sensor-position-presence[\s\S]*sensor-distance-proximity[\s\S]*sensor-temperature[\s\S]*sensor-light-radiation/);
  assert.match(navigation, /sensor-motion-orientation[\s\S]*sensor-force-pressure[\s\S]*sensor-environment-chemical[\s\S]*sensor-level-flow[\s\S]*sensor-electrical/);
  assert.match(helpContent, /Messgröße sagt, was erfasst wird[\s\S]*Wirkprinzip sagt, wie daraus ein elektrisches Signal entsteht/);
  assert.match(helpContent, /Positions-, Endlagen- und Anwesenheitssensoren[\s\S]*Encoder oder Längenmesssystem/);
  assert.match(helpContent, /Abstands- und Näherungssensoren[\s\S]*Infrarot[\s\S]*Ultraschall[\s\S]*Radar[\s\S]*LiDAR/);
  assert.match(helpContent, /Temperatursensoren: NTC, PTC und weitere Bauarten[\s\S]*Pt100[\s\S]*Thermoelement[\s\S]*Halbleiter-IC/);
  assert.match(helpContent, /Licht-, Farb- und Strahlungssensoren[\s\S]*Fotodiode[\s\S]*Thermopile/);
  assert.match(helpContent, /Bewegungs-, Lage- und Orientierungssensoren[\s\S]*Beschleunigungssensor[\s\S]*Gyroskop[\s\S]*Magnetometer[\s\S]*PIR/);
  assert.match(helpContent, /Kraft-, Gewichts-, Druck- und Berührungssensoren[\s\S]*Dehnungsmessstreifen[\s\S]*Piezoelement/);
  assert.match(helpContent, /Umwelt-, Schall- und chemische Sensoren[\s\S]*Feuchtesensoren[\s\S]*Nichtdispersive Infrarotsensoren[\s\S]*Partikelsensoren/);
  assert.match(helpContent, /Füllstands- und Durchflusssensoren[\s\S]*Schwimmerschalter[\s\S]*magnetisch-induktiv/);
  assert.match(helpContent, /Sensoren für Spannung, Strom und Leistung[\s\S]*Shunt[\s\S]*Hall-Stromsensoren[\s\S]*Stromwandler/);
});

test("explains FMCW radar and links it to the first proximity-sensor project stage", () => {
  const navigation = helpContent.match(/id: "sensors", title: "Sensoren"[\s\S]*?\]\s*\},/)?.[0] || "";
  assert.match(navigation, /sensor-distance-proximity[\s\S]*sensor-fmcw-radar[\s\S]*sensor-temperature/);
  assert.match(helpContent, /FMCW-Radar: Entfernung und Bewegung aus Chirps/);
  assert.match(helpContent, /Beat-Frequenz[\s\S]*Relativgeschwindigkeit[\s\S]*mehreren Empfangskanälen/);
  assert.match(helpContent, /Gegenüber reflektivem Infrarot[\s\S]*Gegenüber IR-Time-of-Flight[\s\S]*Gegenüber Ultraschall[\s\S]*Gegenüber PIR/);
  assert.match(helpContent, /Baue deinen eigenen Näherungssensor[\s\S]*\/app\/learn\/\?catalog=build-your-own-proximity-sensor/);
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

test("offers security as a separate cross-cutting topic with network fundamentals", () => {
  const navigation = helpContent.match(/id: "cross-cutting-topics"[\s\S]*?\n    \},\n    \{/)?.[0] || "";
  assert.match(navigation, /"privacy-basics", title: "Datenschutz in vernetzten Projekten"/);
  assert.match(navigation, /"security-basics", title: "Security in vernetzten Projekten"[\s\S]*security-network-technologies/);
  assert.match(helpContent, /"security-basics": \{[\s\S]*Identifikation, Authentifizierung und Autorisierung/);
  assert.match(helpContent, /Risikoanalyse: Was müssen wir schützen[\s\S]*Wie halten wir Angreifer ab[\s\S]*Wie erkennen wir Angreifer[\s\S]*Wie begrenzen wir den Schaden/);
  assert.match(helpContent, /Updates, sichere Konfiguration, Eingabeprüfung und Rate Limits[\s\S]*Monitoring fasst sie zusammen[\s\S]*getrennte Netze oder VLANs[\s\S]*Getestete Backups/);
  assert.doesNotMatch(helpContent, /security-systematic-overview\.png/);
  assert.match(helpContent, /Security ist keine Anhäufung einzelner Maßnahmen[\s\S]*Was passiert, wenn sie kompromittiert werden[\s\S]*wie halten wir sie davon ab[\s\S]*Sitzungen und Tokens sind zeitlich begrenzte Zugangsnachweise[\s\S]*TLS, Zertifikate und Certificate Authorities[\s\S]*Firewall, VPN und Reverse Proxy/);
  assert.match(helpContent, /vernetztes Türschloss[\s\S]*dauerhaft erreichbarer Informationsdienst[\s\S]*zeitlich begrenztes Recht zum Öffnen[\s\S]*Recht serverseitig widerrufen[\s\S]*Vertraulichkeit bedeutet[\s\S]*Integrität bedeutet[\s\S]*Verfügbarkeit bedeutet[\s\S]*Nachvollziehbarkeit bedeutet/);
  assert.match(helpContent, /Abwesenheiten und Gewohnheiten ableiten[\s\S]*Einbrüche zu planen[\s\S]*gezielt für ein Verkaufsgespräch anzusprechen[\s\S]*kein Werbedatum/);
  assert.match(helpContent, /security-smart-door-lock\.png[\s\S]*security-smart-door-status-privacy\.png[\s\S]*security-smart-door-remote-attack\.png[\s\S]*security-smart-door-access-rights\.png/);
  assert.match(helpContent, /In der realen Welt kann grundsätzlich jede Person[\s\S]*setzt die Person selbst der Beobachtung aus[\s\S]*unbemerkt, von überall und beliebig oft abgefragt[\s\S]*dauerhaft erreichbarer Informationsdienst/);
  assert.match(helpContent, /Die cyanfarbene Verbindung zeigt[\s\S]*Administration vergibt ein begrenztes Öffnungsrecht/);
  assert.match(helpContent, /Türstatus ist eine sensible Information[\s\S]*Eine offene Tür ist keine öffentliche Information[\s\S]*Administration vergibt ein begrenztes Öffnungsrecht/);
  assert.match(helpContent, /ohne sichtbare Gewalt und nahezu lautlos[\s\S]*Noch kritischer als ein ausgespähter Türstatus[\s\S]*Der legitime Anwendungsfall folgt danach[\s\S]*signierte, berechtigte Öffnungsbefehle/);
  assert.doesNotMatch(helpContent, /security-smart-door-security-goals\.png/);
  assert.match(helpContent, /Vertraulichkeit bedeutet[\s\S]*Integrität bedeutet[\s\S]*Verfügbarkeit bedeutet[\s\S]*Nachvollziehbarkeit bedeutet/);
  assert.match(helpContent, /afterParagraph: 0[\s\S]*afterParagraph: 1[\s\S]*afterParagraph: 2[\s\S]*afterParagraph: 3/);
  assert.match(helpView, /securityDoorIllustrations\?\.filter\(\(illustration\) => illustration\.afterParagraph === paragraphIndex\)[\s\S]*security-door-illustration-label/);
  assert.match(css, /\.security-door-illustrations \{[\s\S]*grid-template-columns: minmax\(0, 760px\)[\s\S]*height: auto; object-fit: contain/);
  assert.match(helpContent, /Sessions, Tokens und Rechte[\s\S]*geschütztes Session-Cookie[\s\S]*Ablaufzeit/);
  assert.match(helpContent, /Verschlüsselung, Zertifikate und Certificate Authorities[\s\S]*privaten Schlüssel[\s\S]*Certificate Authority \(CA\)/);
  assert.match(helpContent, /Typische Angriffsszenarien verstehen[\s\S]*Man in the Middle[\s\S]*Gestohlene Sitzung oder gestohlenes Token[\s\S]*Phishing[\s\S]*Offener oder ungepatchter Dienst/);
  assert.match(helpContent, /Man in the Middle[\s\S]*HTTPS\/TLS[\s\S]*Zertifikatswarnungen ernst nehmen/);
  assert.match(helpContent, /Netzwerktechnologien: IP, DNS, URLs und Ports[\s\S]*https:\/\/beispiel\.de:443\/app[\s\S]*Socket-Endpunkt/);
  assert.match(helpContent, /MQTT sicher einsetzen[\s\S]*gegenseitigem TLS \(mTLS\)[\s\S]*MQTT-ACL[\s\S]*eigenen Mess-Topic/);
  assert.match(helpContent, /Netzgrenzen: Firewall, NAT und Reverse Proxy[\s\S]*Portfreigabe[\s\S]*VPN/);
  assert.match(helpContent, /Strategie für einen sicher erreichbaren Home-Server[\s\S]*Keine Portfreigabe für die Anwendung[\s\S]*vertrauenswürdigen Tunnel[\s\S]*direkte Portfreigabe/);
  assert.match(helpContent, /Dadurch erhält nicht automatisch jede Person Zugriff auf deinen Rechner[\s\S]*Sicherheitslücke[\s\S]*separates Netz oder VLAN/);
  assert.match(helpContent, /Sicherer Betrieb[\s\S]*Wiederherstellungen üben[\s\S]*Schlüssel rotieren/);
});

test("keeps sensors and actuators as a cross-cutting system topic and connects motor control to a learning project", () => {
  assert.match(helpContent, /id: "sensors-and-actuators",[\s\S]*title: "Sensorik und Aktorik"[\s\S]*id: "sensors"[\s\S]*id: "actuators"/);
  assert.match(helpContent, /id: "actuators", title: "Aktoren", articleId: "actuators", subchapters: \[\s*\{ id: "actuator-motor-theory", title: "Motoren und Antriebe" \},?\s*\]/);
  assert.match(helpContent, /id: "actuator-motors-and-drives", heading: "Motoren und Antriebe auswählen"[\s\S]*id: "actuator-motor-control", heading: "Motoransteuerung: Leistungsteil und Firmware"[\s\S]*id: "actuator-safe-motion", heading: "Sicher bewegen: Rückmeldung und Fehlerfälle"/);
  assert.match(helpContent, /id: "actuator-motor-theory", heading: "Zwei Motorfamilien: Wechselstrom und Gleichstrom"[\s\S]*id: "actuator-synchronous-machines", heading: "Synchronmaschinen: mit einem drehenden Magnetfeld mitlaufen"[\s\S]*id: "actuator-asynchronous-machines"[\s\S]*id: "actuator-dc-motors", heading: "Gleichstrommotoren: Reihenschluss, Nebenschluss und permanent erregt"[\s\S]*id: "actuator-bldc-basics"[\s\S]*B6-Brücke[\s\S]*sinusförmige Phasenströme/);
  assert.match(helpContent, /\/app\/learn\/\?catalog=motor-control-basics/);
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
  assert.match(helpContent, /Websites, APIs, VPN-Gateways, kleine bis mittlere Datenbanken/);
  assert.match(helpContent, /fest gebuchtes Paket aus virtuellen CPUs, RAM, Speicher und Netzwerk/);
  assert.match(helpContent, /Cloud ist nicht einfach ein fremder Server/);
  assert.match(helpContent, /bei mehr Anfragen mehr parallel ausgeführt; sinkt die Last, werden Ressourcen wieder reduziert/);
  assert.match(helpContent, /"choosing-servers": \{[\s\S]*Wie du auswählst[\s\S]*Mit kleinster sinnvoller Architektur beginnen/);
  const cloudChapter = helpContent.match(/"cloud-services": \{[\s\S]*?"workers-and-queues": \{/s)?.[0] || "";
  assert.match(cloudChapter, /Die Kostenfalle Cloud-Computing[\s\S]*Typische Ursachen[\s\S]*Jede Ausführung muss begrenzt sein/);
  const internetVpsChapter = helpContent.match(/"internet-vps": \{[\s\S]*?"cloud-services": \{/s)?.[0] || "";
  assert.match(internetVpsChapter, /Auswirkungen im Alltag[\s\S]*Performance[\s\S]*Sicherheit[\s\S]*Skalierbarkeit[\s\S]*Betriebsaufwand/);
  assert.match(helpContent, /Sicherheit eines lokalen Servers[\s\S]*Verwaltungsoberflächen[\s\S]*VPN/);
  assert.match(internetVpsChapter, /Sicherheitsverantwortung: dedizierter Server und VPS[\s\S]*Virtualisierungsplattform[\s\S]*Mehrfaktor-Authentisierung/);
  assert.match(cloudChapter, /Sicherheit in der Cloud: gemeinsame Verantwortung[\s\S]*Identitäten und Rechte[\s\S]*Kostenlimits/);
  assert.match(helpContent, /Sicherheitsgrenze folgt dem Servermodell[\s\S]*Eigener lokaler Server[\s\S]*Dedizierter Server oder VPS[\s\S]*Cloud-Dienst/);
  assert.match(helpContent, /Sicherheit als Auswahlkriterium[\s\S]*kleinere oder stärker verwaltete Lösung/);
  assert.doesNotMatch(internetVpsChapter, /GerNetiX/);
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
  assert.match(helpContent, /\.filter\(\(topic\) => topic\.surface === "knowledge"\)/);
  assert.match(helpContent, /articles\[chapter\.articleId\]\.access = chapter\.access \|\| "premium"/);
  assert.match(helpView, /function renderPaywall/);
  assert.match(helpView, /Premium-Inhalt/);
  assert.match(helpView, /Dieses Kapitel mit Premium weiterlesen/);
  assert.match(helpView, /Du kannst jederzeit eine andere Kapitelvorschau öffnen/);
  assert.match(helpView, /help-access-badge/);
  const knowledgeBookView = helpView.match(/function renderKnowledgeBook[\s\S]*?function activateKnowledgeBook/)?.[0] || "";
  assert.doesNotMatch(knowledgeBookView, /accessBadge/);
  assert.match(knowledgeBookView, /renderPaywall|renderArticle/);
  assert.match(css, /\.help-paywall/);
  assert.match(server, /\["\/hilfe", "\/hilfe\/", "\/wissen", "\/wissen\/"\]\.includes\(url\.pathname\)[\s\S]*serveStatic\(res, appDir, "\/index\.html"\)/);
  assert.doesNotMatch(server, /url\.pathname === "\/app\/help"/);
  assert.match(app, /const isPublicHelpPage/);
  assert.match(app, /const isPublicKnowledgePage/);
  assert.match(app, /label: state\.account \? "Plattform" : "Startseite", route: state\.account \? "\/app\/dashboard\/" : "\/"/);
  assert.match(app, /if \(link\.dataset\.breadcrumbRoute === "\/"\) \{[\s\S]*?window\.location\.assign\("\/"\)/);
  assert.match(app, /if \(isPublicInformationPage\) document\.body\.classList\.add\("public-help-page"\)/);
  assert.match(app, /document\.body\.classList\.toggle\("public-information-anonymous", !state\.account\)/);
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
  assert.match(helpView, /<details class="knowledge-part-toc" open>/);
  assert.match(helpView, /<details class="knowledge-chapter-toc">/);
  assert.match(helpView, /function renderKnowledgeChapterToc/);
  assert.match(helpView, /knowledge-chapter-title-link/);
  assert.doesNotMatch(helpView, /Leseprobe öffnen|Kapitel öffnen/);
  assert.doesNotMatch(helpView, /knowledge-chapter-link[^>]*>[\s\S]*?→/);
  assert.match(helpView, /knowledge-subchapter-link is-locked/);
  assert.doesNotMatch(helpView, /knowledge-subchapter-link is-locked[^>]*>[^<]*<small>Premium<\/small>/);
  assert.doesNotMatch(helpView, /Kapitel lesen|Unterkapitel/);
  assert.match(css, /\.knowledge-part-toc > summary/);
  assert.doesNotMatch(helpView, /Kapitelübersicht öffnen oder schließen/);
  assert.match(helpView, /function renderPracticeLessonLink/);
  assert.match(helpView, /knowledge-topic=/);
  assert.match(helpView, /if \(!access\.hasAccount\)/);
  assert.match(helpView, /Anmeldung erforderlich · Demo-Link/);
  assert.match(helpView, /Demo-Link · Zuordnung zu einer Lesson folgt/);
  assert.match(helpView, /data-knowledge-chapter/);
  assert.match(helpView, /renderArticle\(chapter, child, \{ showRelated: false, chapterNumber \}\)/);
  assert.match(helpView, /knowledge-part-link/);
  assert.match(helpView, /data-knowledge-part/);
  assert.match(helpView, /event\.stopPropagation\(\)/);
  assert.match(helpView, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
  assert.match(helpView, /const syncChapterWithScroll/);
  assert.match(helpView, /window\.addEventListener\("scroll", knowledgeScrollHandler/);
  assert.match(css, /\.knowledge-book-navigation/);
  assert.doesNotMatch(css, /\.knowledge-book-toc\s/);
  assert.match(css, /\.knowledge-part-link/);
  assert.match(css, /\.knowledge-book-chapter \{[^}]*scroll-margin-top/);
  assert.match(css, /\.knowledge-subchapter-link/);
  assert.match(css, /\.knowledge-chapter-meta/);
  assert.match(css, /\.knowledge-chapter-paywall/);
  assert.match(css, /\.help-practice-lesson/);
  assert.match(css, /\.help-practice-lesson\.is-disabled/);
  assert.match(css, /body\.public-help-page/);
  assert.match(css, /body\.public-help-page \.public-header-brand/);
  assert.match(css, /body\.public-help-page \.app-shell \{ width: calc\(100% - 32px\); padding: 82px 0 0; \}/);
  assert.match(css, /body\.public-help-page \.topbar \{[\s\S]*position: fixed;[\s\S]*top: 0;[\s\S]*left: 16px;[\s\S]*right: 16px;/);
  assert.match(css, /body\.public-help-page \.app-menu \{ position: fixed; top: 80px; right: 22px; z-index: 60; \}/);
  assert.match(css, /body\.public-information-anonymous #mainMenu a:not\(\.public-information-link\)/);
});

test("keeps engineering thinking public and gates the remaining knowledge chapters independently", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${helpContent};this.content = HelpContent;`, context);
  const chapters = context.content.topics
    .filter((topic) => topic.surface === "knowledge")
    .flatMap((topic) => topic.children || []);

  assert.equal(chapters.length, 28);
  assert.equal(context.content.articles["from-problem-to-system"].access, "public");
  assert.ok(chapters
    .filter((chapter) => chapter.id !== "from-problem-to-system")
    .every((chapter) => context.content.articles[chapter.articleId]?.access === "premium"));
  assert.match(helpView, /article\.sections\.slice\(0, 1\)/);
  assert.match(helpView, /knowledge-chapter-preview/);
});
