const { readPlatformAppSource } = require("../test-support/platform-app-source");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const { authenticatedItem } = require("../test-support/navigation-model");

const appRoot = path.join(__dirname, "..", "public", "app");
const knowledgeSourceRoot = path.join(__dirname, "..", "src", "knowledge", "articles");
const generatedKnowledgeRoot = path.join(__dirname, "..", "src", "knowledge", "generated-chapters");
const html = fs.readFileSync(path.join(appRoot, "index.html"), "utf8");
const app = readPlatformAppSource();
const css = fs.readFileSync(path.join(appRoot, "app.css"), "utf8");
const helpLoaderContent = fs.readFileSync(path.join(appRoot, "help-content.js"), "utf8");
const helpOnlyContent = fs.readFileSync(path.join(__dirname, "..", "src", "help", "help-content.js"), "utf8");
const knowledgeArticleFiles = [
  "knowledge-articles-engineering.js",
  "knowledge-articles-electrical-engineering.js",
  "knowledge-articles-sensors-actuators.js",
  "knowledge-articles-embedded.js",
  "knowledge-articles-radio.js",
  "knowledge-articles-software.js",
  "knowledge-articles-distributed-systems.js",
  "knowledge-articles-ai.js",
  "knowledge-articles-cross-cutting.js",
  "knowledge-articles-glossary.js",
];
const knowledgeCatalogContent = fs.readFileSync(path.join(appRoot, "knowledge-content.js"), "utf8");
const knowledgeChapterIndex = fs.readFileSync(path.join(appRoot, "knowledge-chapter-index.js"), "utf8");
const generatedKnowledgeChapterFiles = fs.readdirSync(generatedKnowledgeRoot).filter((file) => file.endsWith(".js"));
const generatedKnowledgeContent = generatedKnowledgeChapterFiles
  .map((file) => fs.readFileSync(path.join(generatedKnowledgeRoot, file), "utf8"))
  .join("\n");
const distributedKnowledgeContent = fs.readFileSync(path.join(knowledgeSourceRoot, "knowledge-articles-distributed-systems.js"), "utf8");
const knowledgeContent = [
  ...knowledgeArticleFiles.map((file) => fs.readFileSync(path.join(knowledgeSourceRoot, file), "utf8")),
  knowledgeCatalogContent,
].join("\n");
function restoreNavigationTitles(content, titles) {
  let restored = content;
  for (const [id, title] of Object.entries(titles)) {
    const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    restored = restored.replace(
      new RegExp(`id: "${escapedId}",\\s*articleId: "${escapedId}",`, "g"),
      `id: "${id}", title: "${title}", articleId: "${id}",`,
    );
  }
  return restored;
}
const helpTitles = Object.fromEntries(
  [...helpOnlyContent.matchAll(/"([^"]+)": \{\s*title: "([^"]+)"/g)].map((match) => [match[1], match[2]]),
);
const chapterIndexData = JSON.parse(knowledgeChapterIndex.match(/const KnowledgeChapterIndex=(\{[\s\S]*\});/)?.[1] || "{}");
const chapterTitles = Object.fromEntries(Object.entries(chapterIndexData).map(([id, chapter]) => [id, chapter.title]));
const normalizedHelpContent = restoreNavigationTitles(helpOnlyContent.replace(/,\r?\n\s*/g, ", "), helpTitles);
const normalizedKnowledgeContent = restoreNavigationTitles(knowledgeContent.replace(/,\r?\n\s*/g, ", "), chapterTitles);
const helpContent = `${normalizedHelpContent}\n${normalizedKnowledgeContent}\n${knowledgeChapterIndex}\n${generatedKnowledgeContent}`;
const informationView = fs.readFileSync(path.join(appRoot, "information-view.js"), "utf8");
const helpChatService = fs.readFileSync(path.join(appRoot, "help-chat-service.js"), "utf8");
const webshopAccountSeparationDoc = fs.readFileSync(path.join(__dirname, "..", "..", "..", "docs", "webshop-account-separation.md"), "utf8");
const synchronousMotorPhaseB = fs.readFileSync(path.join(__dirname, "..", "public", "assets", "synchronous-motor-step-2-phase-b.svg"), "utf8");
const synchronousMotorPhaseC = fs.readFileSync(path.join(__dirname, "..", "public", "assets", "synchronous-motor-step-3-phase-c.svg"), "utf8");

test("keeps Help reachable through the main menu and renders it as a dedicated view", () => {
  assert.equal(authenticatedItem("helpMenuLink").href, "/hilfe/");
  assert.equal(authenticatedItem("helpMenuLink").className, "utility public-information-link menu-fixed-action");
  assert.equal(authenticatedItem("/")?.href, undefined);
  assert.match(html, /class="public-header-brand" href="\/" aria-label="GerNetiX Startseite"/);
  assert.match(html, /class="public-header-brand"[\s\S]*src="\/gernetix-wordmark\.png"/);
  assert.doesNotMatch(html, /href="\/produkte\/"/);
  assert.equal(authenticatedItem("/app/community/").route, "community");
  assert.equal(authenticatedItem("loginMenuLink").label, "Anmelden");
  assert.match(html, /data-open-route="\/wissen\/"[\s\S]*Wissensportal/);
  assert.match(html, /id="informationView"/);
  assert.match(html, /id="informationMount"/);
  assert.match(html, /class="platform-footer"[\s\S]*Startseite[\s\S]*Warum GerNetiX\?[\s\S]*Hilfe/);
  assert.doesNotMatch(html.match(/class="platform-footer"[\s\S]*/)?.[0] || "", /href="\/app\/vision\/"/);
  assert.match(app, /help: "informationView"/);
  assert.match(app, /knowledge: "informationView"/);
  assert.match(app, /label: "Hilfe", route: "\/hilfe\/"/);
  assert.match(app, /function renderInformationTopic\(\)/);
  assert.match(app, /InformationView\.render\(\{/);
  assert.match(css, /\.help-layout \{/);
  assert.match(css, /\.help-topic-navigation \{/);
  assert.match(css, /@media \(max-width: 760px\)/);
});

test("keeps help content, navigation and assistant integration independently extensible", () => {
  assert.match(html, /id="informationMount"/);
  assert.match(html, /help-content\.js/);
  assert.match(helpLoaderContent, /\/api\/platform\/help\/content/);
  assert.doesNotMatch(helpLoaderContent, /"provision-new-board"|const articleAccess/);
  assert.doesNotMatch(html, /<script[^>]+knowledge-content\.js/);
  assert.ok(knowledgeArticleFiles.every((file) => !html.includes(`<script defer src="/app/${file}`)));
  assert.match(app, /async function loadKnowledgeContentAssets\(\)/);
  assert.match(app, /"knowledge-chapter-index\.js", "knowledge-content\.js"/);
  assert.doesNotMatch(app, /knowledge-chapters\/from-problem-to-system\.js/);
  assert.match(app, /const urls = knowledgeContentAssetUrls\(\)/);
  assert.match(app, /await Promise\.all\(urls\.slice\(0, -1\)\.map\(loadPlatformScript\)\)/);
  assert.match(app, /await loadPlatformScript\(urls\.at\(-1\)\)/);
  assert.match(html, /help-chat-service\.js/);
  assert.match(html, /information-view\.js/);
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
  assert.match(helpContent, /title: "Elektrotechnik"[\s\S]*"electrical-basics-and-component-protection"[\s\S]*"digital-signals-data-and-protocols"[\s\S]*"physical-limits"[\s\S]*"sampling-rate"[\s\S]*"embedded-safety"[\s\S]*title: "Sensorik und Aktorik"[\s\S]*"sensors"[\s\S]*"actuators"/);
  assert.match(helpContent, /title: "Mikrocontroller und Embedded"[\s\S]*"hardware-landscape"[\s\S]*"processor-overview"[\s\S]*"microcontroller-basics"[\s\S]*"esp32-gotchas"[\s\S]*"bus-systems"[\s\S]*"embedded-measurement-debugging"/);
  assert.match(helpContent, /"processor-overview"[\s\S]*"microcontroller-basics"[\s\S]*"microcontroller-flashing"[\s\S]*"microcontroller-pwm"[\s\S]*"esp32-gotchas"[\s\S]*"embedded-measurement-debugging"/);
  assert.match(helpContent, /"microcontroller-basics": \{[\s\S]*Wie Software in einen Mikrocontroller kommt[\s\S]*Speicherorganisation[\s\S]*Register[\s\S]*GPIO[\s\S]*ADC[\s\S]*Timer[\s\S]*PWM/);
  assert.match(helpContent, /Der Name kommt vom Flash-Speicher selbst[\s\S]*älteren, einzeln löschbaren EEPROMs/);
  assert.match(helpContent, /Aus Quelltext wird eine Firmware-Datei[\s\S]*Der Bootloader öffnet den Programmierweg[\s\S]*Löschen, schreiben und prüfen[\s\S]*Start nach dem Flashen/);
  assert.match(helpContent, /"physical-limits": \{[\s\S]*Absolute Maximum Ratings[\s\S]*absolute Grenzwerte[\s\S]*Strom pro Pin und Gesamtstrom[\s\S]*Maximale Frequenz und Prozessortakt/);
  assert.match(helpContent, /"electrical-basics-and-component-protection": \{[\s\S]*Spannung und Strom: Antrieb und Bewegung[\s\S]*Leistung, Energie und Arbeit[\s\S]*P = U × I[\s\S]*P = I² × R[\s\S]*Kurzschluss und Querschluss sind nicht dasselbe[\s\S]*Bauteile schützen/);
  assert.match(helpContent, /"digital-signals-data-and-protocols": \{[\s\S]*Binäre Übertragung: 0 und 1 auf einer Leitung[\s\S]*besonders einfacher Spezialfall[\s\S]*Manchester-Codierung: Takt im Signal[\s\S]*expertKnowledge[\s\S]*QAM: mehrere Bits pro Funksymbol[\s\S]*16-QAM[\s\S]*LTE\/4G und 5G NR[\s\S]*Die Funktechnik wählt die passende Signalform[\s\S]*Von Bits zu Daten[\s\S]*Was ein Protokoll vereinbart[\s\S]*Eine einfache Schichtenlandkarte[\s\S]*HTTP\/REST, MQTT, DNS/);
  assert.match(helpContent, /"sampling-rate": \{[\s\S]*Nyquist-Shannon-Abtasttheorem[\s\S]*Aliasing[\s\S]*Abtastrate praktisch wählen/);
  assert.match(helpContent, /"sensors": \{[\s\S]*Sensoren nach Messgröße und Wirkprinzip ordnen[\s\S]*I²C[\s\S]*Messschaltungen[\s\S]*Spannungsteiler/);
  assert.match(helpContent, /"actuators": \{[\s\S]*Zwei Motorfamilien: Wechselstrom und Gleichstrom[\s\S]*Synchronmaschinen: mit einem drehenden Magnetfeld mitlaufen[\s\S]*Gleichstrommotoren: Reihenschluss, Nebenschluss und permanent erregt[\s\S]*Motoransteuerung: Leistungsteil und Firmware[\s\S]*MOSFETs[\s\S]*Freilaufdiode/);
  assert.match(helpContent, /"bus-systems": \{[\s\S]*Chip-zu-Chip-Schnittstellen[\s\S]*I²C[\s\S]*SPI[\s\S]*Feld- und Systembusse[\s\S]*CAN[\s\S]*RS-485/);
  assert.match(helpContent, /title: "Querschnittsthemen"[\s\S]*"privacy-basics", title: "Datenschutz in vernetzten Projekten"/);
  assert.match(helpContent, /title: "Verteilte Systeme"[\s\S]*"distributed-systems-introduction"[\s\S]*"communication-basics"[\s\S]*"local-servers"[\s\S]*"internet-vps"[\s\S]*"cloud-services"[\s\S]*"choosing-servers"/);
  assert.doesNotMatch(helpContent, /title: "Öffentliche Informationen"/);
  assert.match(helpContent, /children: \[\s*\{\s*id: "registration-login-recovery", title: "Einloggen und Konto anlegen"[\s\S]*\{\s*id: "create-account", title: "Konto anlegen"[\s\S]*\{\s*id: "quick-start", title: "So startest du"/);
  assert.match(helpContent, /"quick-start": \{[\s\S]*title: "So startest du"[\s\S]*Dein erstes Projekt[\s\S]*Wie geht es weiter\?/);
  assert.match(helpContent, /"create-account": \{[\s\S]*title: "Konto anlegen"[\s\S]*heading: "Registrierung"/);
  assert.match(helpContent, /"create-account"[\s\S]*"account-types"[\s\S]*"plan-comparison"/);
  assert.match(helpContent, /"provision-new-board"[\s\S]*"event-worker-rules"[\s\S]*"event-dispatcher"/);
  assert.match(helpContent, /"quick-start"[\s\S]*"supported-devices"/);
  assert.match(helpContent, /"update-profiles"[\s\S]*Wann wählt man was\?/);
  assert.match(informationView, /help-article-table/);
  assert.match(informationView, /function openDialog\(topicId\)/);
  assert.match(informationView, /help-topic-dialog-close/);
  assert.match(informationView, /Ask GerNetiX Help/);
  assert.match(informationView, /data-help-topic/);
  assert.match(informationView, /relatedTopics/);
  assert.match(helpChatService, /help-assistant\/chat/);
  assert.match(helpChatService, /relatedTopics/);
  assert.match(css, /\.help-chat \{/);
  assert.match(css, /\.help-topic-group \{/);
  assert.match(helpContent, /"ai-premium"/);
  assert.match(helpContent, /externe KI-Anbieter/);
  assert.match(informationView, /kostenoptimierte OpenAI-Modell ausschließlich mit passenden Hilfeartikeln/);
  assert.match(informationView, /access\.hasAccount/);
});

test("keeps knowledge articles in focused topic modules", () => {
  assert.ok(Buffer.byteLength(knowledgeCatalogContent, "utf8") < 17000);
  assert.ok(Buffer.byteLength(knowledgeChapterIndex, "utf8") < 30000);
  assert.equal(generatedKnowledgeChapterFiles.length, 35);
  assert.match(knowledgeCatalogContent, /const articles = Object\.fromEntries/);
  assert.match(knowledgeCatalogContent, /function loadArticle\(articleId\)/);
  assert.match(knowledgeCatalogContent, /KnowledgeArticleRegistry/);
  assert.doesNotMatch(knowledgeCatalogContent, /"radio-technologies-understand": \{/);
  assert.match(fs.readFileSync(path.join(knowledgeSourceRoot, "knowledge-articles-radio.js"), "utf8"), /"radio-technologies-understand": \{/);
  assert.match(fs.readFileSync(path.join(knowledgeSourceRoot, "knowledge-articles-sensors-actuators.js"), "utf8"), /"sensors": \{[\s\S]*"actuators": \{/);
  assert.match(fs.readFileSync(path.join(generatedKnowledgeRoot, "radio-technologies-understand.js"), "utf8"), /KnowledgeArticleRegistry\["radio-technologies-understand"\]/);
});

test("keeps every generated lazy chapter synchronized with its authored source", () => {
  const sourceContext = {};
  vm.createContext(sourceContext);
  vm.runInContext(`${knowledgeContent};this.content = KnowledgeContent;`, sourceContext);
  const generatedContext = { window: {} };
  vm.createContext(generatedContext);
  for (const file of generatedKnowledgeChapterFiles) {
    vm.runInContext(fs.readFileSync(path.join(generatedKnowledgeRoot, file), "utf8"), generatedContext);
  }
  assert.equal(Object.keys(generatedContext.window.KnowledgeArticleRegistry).length, 35);
  for (const [articleId, article] of Object.entries(generatedContext.window.KnowledgeArticleRegistry)) {
    const generatedArticle = JSON.parse(JSON.stringify(article));
    const authoredArticle = JSON.parse(JSON.stringify(sourceContext.content.articles[articleId]));
    delete generatedArticle.access;
    delete authoredArticle.access;
    assert.deepEqual(
      generatedArticle,
      authoredArticle,
      articleId,
    );
  }
});

test("explains browser apps, PWA mode and native mobile apps at the component choice", () => {
  assert.match(knowledgeCatalogContent, /id: "browser-pwa-mobile-app"[\s\S]*articleId: "browser-pwa-mobile-app"[\s\S]*access: "public"/);
  assert.match(helpContent, /"browser-pwa-mobile-app": \{[\s\S]*Browser-App und PWA teilen dieselbe Grundlage[\s\S]*Vor- und Nachteile im Vergleich[\s\S]*Welche Komponente passt zum Projekt\?/);
  assert.match(helpContent, /GerNetiX modelliert eine PWA deshalb als Betriebs- und Installationsoption einer Browser-App/);
  assert.match(helpContent, /Sie braucht deshalb immer einen Webserver/);
  assert.match(helpContent, /nur im lokalen Netzwerk beziehungsweise Intranet oder über das Internet erreichbar/);
  assert.match(helpContent, /Die Internet-Auswahl veröffentlicht noch keinen Dienst/);
  assert.match(helpContent, /Mobile App \(iOS & Android\)[\s\S]*Eigene Builds, Signierung, Store-Prozesse/);
  const developmentPlatform = fs.readFileSync(path.join(appRoot, "development-platform.js"), "utf8");
  assert.match(developmentPlatform, /data-component-type-help/);
  assert.match(developmentPlatform, /openHelpTopic\?\.\("browser-pwa-mobile-app"\)/);
});

test("shows compatible hardware from the catalog and explains USB provisioning limits", () => {
  assert.match(helpContent, /"compatible-hardware"/);
  assert.match(helpContent, /iPhone und iPad/);
  assert.match(helpContent, /GerNetiX Serial Service[\s\S]*Alle Schritte bleiben in der GerNetiX-Oberfläche/);
  assert.match(helpContent, /Android eignen sich für mobile Bedienung, aber nicht als verlässlicher USB-Host/);
  assert.match(helpContent, /GerNetiX-Webshop[\s\S]*geeigneten Basissoftware/);
  assert.match(informationView, /api\/platform\/hardware\/processor-boards/);
  assert.match(informationView, /function renderHardwareCard/);
  assert.match(informationView, /compatibleHardwareCatalog/);
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
  const navigation = normalizedKnowledgeContent.match(/const topics = \[[\s\S]*?const articles/)?.[0] || "";
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

test("teaches ESP32-specific gotchas without applying classic-chip rules to every family", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${knowledgeContent};this.content = KnowledgeContent;`, context);

  const embeddedTopic = context.content.topics.find((topic) => topic.id === "microcontrollers-and-embedded");
  const article = context.content.articles["esp32-gotchas"];

  assert.ok(embeddedTopic.children.some((chapter) => chapter.articleId === "esp32-gotchas"));
  assert.equal(article.access, "premium");
  assert.deepEqual(
    JSON.parse(JSON.stringify(article.sections.map((section) => section.id))),
    [
      "esp32-gotchas-family-first",
      "esp32-gotchas-adc-wifi",
      "esp32-gotchas-boot-pins",
      "esp32-gotchas-gpio",
      "esp32-gotchas-power",
      "esp32-gotchas-sleep",
      "esp32-gotchas-psram",
      "esp32-gotchas-usb-pwm",
      "esp32-gotchas-debugging",
    ],
  );
  assert.match(JSON.stringify(article), /Beim klassischen ESP32 wird ADC2 auch vom WLAN-Treiber verwendet/);
  assert.match(JSON.stringify(article), /nicht ungeprüft auf jede neuere ESP32-Variante/);
  assert.match(JSON.stringify(article), /Strapping-Pins/);
  assert.match(JSON.stringify(article), /Brownout/);
  assert.match(JSON.stringify(article), /GPIO19 und GPIO20/);
});

test("keeps the hardware landscape as a public page in the common help model", () => {
  assert.match(helpContent, /"hardware-landscape", title: "Hardware-Landkarte: vom Akku bis Edge AI"[\s\S]*"distributed-systems-introduction", title: "Wenn zwei Welten zusammenarbeiten"[\s\S]*"server-systems", title: "Systemlandschaften und Server"/);
  assert.match(helpContent, /"hardware-landscape": \{/);
  assert.match(helpContent, /Raspberry Pi Pico/);
  assert.match(helpContent, /Raspberry Pi Zero 2 W/);
  assert.match(helpContent, /GPU-Edge-Computing/);
  assert.match(informationView, /function renderHardwareVisual/);
  assert.match(informationView, /function renderSystemLandscapeVisual/);
  assert.match(informationView, /function renderServerTypesVisual/);
  assert.match(helpContent, /id: "distributed-systems"[\s\S]*serverLandscape: true/);
  assert.match(informationView, /topic\.serverLandscape \? renderServerTypesVisual\(\) : ""/);
  assert.match(informationView, /server-types-root[\s\S]*Server[\s\S]*server-types-list/);
  assert.match(informationView, /IoT-Geräte[\s\S]*Server[\s\S]*Apps/);
  assert.match(informationView, /Lokal · Internet\/VPS · Cloud/);
  assert.match(informationView, /Mobil · PC\/Mac · Web/);
  assert.match(informationView, /help-hardware-landscape knowledge-system-landscape/);
  assert.match(helpContent, /systemLandscape: true/);
  assert.match(css, /\.knowledge-system-landscape/);
  assert.match(css, /\.server-types-landscape/);
  assert.match(helpContent, /serverLandscape: true/);
  assert.match(css, /\.help-hardware-landscape/);
});

test("opens the knowledge portal with engineering thinking and the Tamagotchi learning journey", () => {
  const navigation = normalizedKnowledgeContent.match(/const topics = \[[\s\S]*?const articles/)?.[0] || "";
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
  const navigation = normalizedKnowledgeContent.match(/const topics = \[[\s\S]*?const articles/)?.[0] || "";
  assert.match(navigation, /id: "software-basics"[\s\S]*title: "Informatik und Software"[\s\S]*"software-basics-introduction"/);
  assert.match(helpContent, /"software-basics-introduction": \{/);
  assert.match(helpContent, /Warum gibt es Software\?[\s\S]*Kompilieren: in Maschinencode übersetzen/);
  assert.match(helpContent, /Bibliotheken: bewährte Bausteine nutzen[\s\S]*Skripte, Interpreter und Laufzeitumgebungen/);
  assert.match(helpContent, /Firmware auf Mikrocontrollern: klein, schnell und berechenbar[\s\S]*MicroPython/);
  assert.match(helpContent, /Backend: Entwicklungsgeschwindigkeit zählt[\s\S]*Node\.js[\s\S]*Python/);
  assert.match(helpContent, /PC, Tablet und Smartphone: beide Welten[\s\S]*plattformübergreifenden App/);
});

test("teaches YAML fundamentals and points to the matching learning project", () => {
  const navigation = normalizedKnowledgeContent.match(/const topics = \[[\s\S]*?const articles/)?.[0] || "";
  assert.match(navigation, /title: "Informatik und Software"[\s\S]*"yaml-basics", title: "YAML: strukturierte Daten lesbar beschreiben"/);
  assert.match(helpContent, /yaml-purpose[\s\S]*yaml-scalars[\s\S]*yaml-indentation[\s\S]*yaml-lists[\s\S]*yaml-text[\s\S]*yaml-errors[\s\S]*yaml-learning-project/);
  assert.match(helpContent, /"yaml-basics": \{[\s\S]*YAML ist keine Programmiersprache/);
  assert.match(helpContent, /Schlüssel und einfache Werte[\s\S]*Wahrheitswerte[\s\S]*null/);
  assert.match(helpContent, /Einrückung und Verschachtelung[\s\S]*keine Tabs/);
  assert.match(helpContent, /Listen und Objekte kombinieren[\s\S]*Bindestrich/);
  assert.match(helpContent, /Anführungszeichen und mehrzeiliger Text[\s\S]*Textblock/);
  assert.match(helpContent, /Typische Fehler und Validierung[\s\S]*Schema/);
  assert.match(helpContent, /kostenlose Lernprojekt „YAML-Grundlagen“[\s\S]*Pflanzenmonitor/);
});

test("distinguishes microcontroller storage, databases and file servers in Software", () => {
  const navigation = normalizedKnowledgeContent.match(/const topics = \[[\s\S]*?const articles/)?.[0] || "";
  assert.match(navigation, /title: "Informatik und Software"[\s\S]*"databases-and-storage", title: "Datenbanken, Speicher und Dateiserver"/);
  assert.match(helpContent, /storage-is-not-always-a-database[\s\S]*microcontroller-storage[\s\S]*sql-and-sqlite[\s\S]*database-families[\s\S]*file-and-object-storage[\s\S]*choosing-data-storage[\s\S]*storage-learning-path/);
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
  const navigation = normalizedKnowledgeContent.match(/const topics = \[[\s\S]*?const articles/)?.[0] || "";
  assert.match(navigation, /"embedded-measurement-debugging", title: "Embedded-Systeme: Messtechnik und Debugging"/);
  assert.match(helpContent, /"embedded-measurement-debugging": \{/);
  assert.match(helpContent, /Software trifft Elektronik/);
  assert.match(helpContent, /löten/);
  assert.match(helpContent, /Messmittel/);
  assert.match(helpContent, /Messtechnik: erst messen, dann raten[\s\S]*Multimeter[\s\S]*Oszilloskop[\s\S]*Logikanalysator/);
  assert.match(helpContent, /Debugwerkzeuge: moderne Hilfe statt unnötiger Hürden[\s\S]*JTAG[\s\S]*KI kann heute Logausgaben/);
  assert.match(helpContent, /Ein ruhiger Debug-Ablauf/);
});

test("compares door position sensors through the chicken-door engineering task", () => {
  const navigation = normalizedKnowledgeContent.match(/"sensors": \{[\s\S]*?"actuators": \{/)?.[0] || "";
  assert.match(navigation, /"sensors": \{[\s\S]*sensor-reed-contact[\s\S]*sensor-photoelectric[\s\S]*sensor-limit-switch[\s\S]*sensor-contact-bridge[\s\S]*sensor-chicken-door-task[\s\S]*sensor-selection-games[\s\S]*sensor-application-map/);
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
  assert.match(informationView, /renderKnowledgeQuizzes[\s\S]*data-knowledge-quiz-check[\s\S]*Wähle zuerst eine Antwort aus\.[\s\S]*\/quizzes\/\$\{encodeURIComponent\(quiz\.dataset\.quizId\)\}\/answer/);
  assert.doesNotMatch(informationView, /data-answer=|quiz\.dataset\.answer|data-quiz-correct|data-quiz-wrong/);
  assert.match(css, /\.knowledge-quiz-list[\s\S]*\.knowledge-quiz-feedback\.correct[\s\S]*\.knowledge-quiz-feedback\.wrong/);
});

test("organizes sensor families by measured quantity and physical principle", () => {
  const navigation = normalizedKnowledgeContent.match(/"sensors": \{[\s\S]*?"actuators": \{/)?.[0] || "";
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
  const navigation = normalizedKnowledgeContent.match(/"sensors": \{[\s\S]*?"actuators": \{/)?.[0] || "";
  assert.match(navigation, /sensor-distance-proximity[\s\S]*sensor-fmcw-radar[\s\S]*sensor-temperature/);
  assert.match(helpContent, /FMCW-Radar: Entfernung und Bewegung aus Chirps/);
  assert.match(helpContent, /Beat-Frequenz[\s\S]*Relativgeschwindigkeit[\s\S]*mehreren Empfangskanälen/);
  assert.match(helpContent, /Gegenüber reflektivem Infrarot[\s\S]*Gegenüber IR-Time-of-Flight[\s\S]*Gegenüber Ultraschall[\s\S]*Gegenüber PIR/);
  assert.match(helpContent, /Baue deinen eigenen Näherungssensor[\s\S]*\/app\/learn\/\?catalog=build-your-own-proximity-sensor/);
});

test("explains electrical and functional safety without normalizing vehicle modifications", () => {
  const navigation = normalizedKnowledgeContent.match(/const topics = \[[\s\S]*?const articles/)?.[0] || "";
  assert.match(navigation, /"embedded-safety", title: "Elektrische und funktionale Sicherheit"/);
  assert.match(helpContent, /"embedded-safety": \{/);
  assert.match(helpContent, /Strom durch den Körper ist entscheidend/);
  assert.match(helpContent, /50 V Wechselspannung und 120 V Gleichspannung/);
  assert.match(helpContent, /Funktionale Sicherheit: Wenn korrektes Funktionieren Leben schützt/);
  assert.match(helpContent, /ungünstigste vorhersehbare Situation/);
  assert.match(helpContent, /Keine Basteländerungen an sicherheitskritischen Fahrzeugfunktionen/);
  assert.match(helpContent, /keine Änderungen an Fahrzeugbussen, Lenkung, Bremse, Airbag-, Rückhalte- oder Antriebssystemen/);
});

test("explains privacy as data minimization, transparency and protection", () => {
  const navigation = normalizedKnowledgeContent.match(/const topics = \[[\s\S]*?const articles/)?.[0] || "";
  assert.match(navigation, /"privacy-basics", title: "Datenschutz in vernetzten Projekten"/);
  assert.match(helpContent, /"privacy-basics": \{/);
  assert.match(helpContent, /Was personenbezogene Daten sein können/);
  assert.match(helpContent, /Daten minimieren/);
  assert.match(helpContent, /Lokal verarbeiten, wenn möglich/);
  assert.match(helpContent, /Datenschutz und Sicherheit gehören zusammen/);
});

test("offers security as a separate cross-cutting topic with network fundamentals", () => {
  const navigation = normalizedKnowledgeContent.match(/id: "cross-cutting-topics"[\s\S]*?id: "glossary"/)?.[0] || "";
  assert.match(navigation, /"privacy-basics", title: "Datenschutz in vernetzten Projekten"/);
  assert.match(navigation, /"security-basics", title: "Security in vernetzten Projekten"/);
  assert.match(helpContent, /security-network-technologies/);
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
  assert.match(informationView, /securityDoorIllustrations\?\.filter\(\(illustration\) => illustration\.afterParagraph === paragraphIndex\)[\s\S]*security-door-illustration-label/);
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
  assert.match(helpContent, /"sensors": \{[\s\S]*Wie ein kontinuierliches Sensorsignal digital wird[\s\S]*zeitkontinuierlich und wertkontinuierlich[\s\S]*Abtastung[\s\S]*Quantisierung[\s\S]*zeit- und wertdiskreten Zahlenfolge[\s\S]*logisch 0 oder logisch 1/);
  assert.match(helpContent, /id: "actuator-current-magnetic-field"[\s\S]*id: "actuator-current-force"[\s\S]*id: "actuator-simple-coil-motor"[\s\S]*id: "actuator-reed-motor"[\s\S]*id: "actuator-transistor-motor"[\s\S]*id: "actuator-homopolar-motor"[\s\S]*id: "actuator-motor-theory"/);
  assert.match(helpContent, /Strom erzeugt ein Magnetfeld[\s\S]*Auf den Draht entsteht eine Kraft[\s\S]*Drehmoment[\s\S]*Reedkontakt[\s\S]*Hall-Sensor[\s\S]*verblüffender Sonderfall/);
  assert.match(helpContent, /Der einfache Spulenmotor: Ein Kräftepaar erzeugt ein Drehmoment[\s\S]*Die beiden Kräfte heben sich als seitliche Gesamtbewegung auf[\s\S]*Genau diese Anordnung heißt Kräftepaar[\s\S]*kehren die Stromrichtung nicht um/);
  assert.match(helpContent, /Dreidimensionale Darstellung eines einfachen Spulenmotors[\s\S]*rote Plusleiter führt von der Batterie außen am Hufeisenmagneten entlang zum linken Bürstenkontakt[\s\S]*N und S sind die beiden Enden desselben Hufeisenmagneten[\s\S]*entstehenden Kräfte in entgegengesetzte Bildtiefe[\s\S]*Drehmoment M um die Welle/);
  assert.match(helpContent, /motor-learning-current-magnetic-field\.svg[\s\S]*motor-learning-current-force\.svg[\s\S]*motor-learning-simple-coil-force-pair-v2\.png[\s\S]*motor-learning-reed-timing-before\.svg[\s\S]*motor-learning-reed-timing-on\.svg[\s\S]*motor-learning-reed-timing-after\.svg[\s\S]*motor-learning-transistor-switch\.svg[\s\S]*motor-learning-homopolar\.svg/);
  assert.match(helpContent, /geeigneter weichmagnetischer Kern[\s\S]*weichmagnetische Eisenwerkstoffe oder Ferrite[\s\S]*Kernmaterial das Magnetfeld verändern/);
  assert.match(helpContent, /id: "actuator-magnetic-core"[\s\S]*expertKnowledge: "Für den Einstieg genügt: Ein geeigneter Kern bündelt das Magnetfeld einer Spule[\s\S]*Er ist kein Dauermagnet[\s\S]*magnetische Permeabilität μ[\s\S]*B = μ × H[\s\S]*Fachbegriff für das gewünschte Verhalten lautet weichmagnetisch[\s\S]*Remanenz und Koerzitivfeldstärke[\s\S]*hartmagnetischen Werkstoffen[\s\S]*Sättigung[\s\S]*Hystereseverluste[\s\S]*Wirbelströme/);
  assert.match(helpContent, /synchronous-motor-step-0-unpowered\.svg[\s\S]*synchronous-motor-step-1-phase-a\.svg[\s\S]*synchronous-motor-step-2-phase-b\.svg[\s\S]*synchronous-motor-step-3-phase-c\.svg/);
  assert.match(helpContent, /Die Bildserie zeigt das Prinzip bewusst als drei einzeln weitergeschaltete Spulenpaare der Phasen A, B und C[\s\S]*realer dreiphasiger Synchronmotor[\s\S]*Ströme der drei Phasen überlagern sich/);
  assert.match(helpContent, /Rotor und Stator werden nicht über innen oder außen definiert, sondern über die Bewegung[\s\S]*Außenläufer[\s\S]*Der Begriff Anker ist kein allgemeines Synonym für Rotor[\s\S]*Arbeits- oder Ankerwicklung dagegen im Stator/);
  assert.match(helpContent, /id: "actuator-synchronous-back-emf", heading: "Drei Phasen, Gegen-EMK und Kurzschlussbremsung"[\s\S]*Drei geregelte Phasen erzeugen im Antrieb ein gleichmäßigeres Drehfeld[\s\S]*Gegen-EMK bedeutet Gegen-Elektromotorische-Kraft[\s\S]*Ein Kurzschluss ist daher keine Methode, das Antriebsmoment zu erhöhen/);
  assert.match(helpContent, /synchronous-motor-three-phase-back-emf\.svg/);
  assert.match(synchronousMotorPhaseB, />N<\/text>[\s\S]*>S<\/text>/);
  assert.match(synchronousMotorPhaseC, />S<\/text>[\s\S]*>N<\/text>/);
  assert.doesNotMatch(synchronousMotorPhaseB, /B · [NS]/);
  assert.doesNotMatch(synchronousMotorPhaseC, /C · [NS]/);
  assert.match(informationView, /section\.illustrationSeries[\s\S]*knowledge-illustration-series[\s\S]*Schritt \$\{illustrationIndex \+ 1\} von \$\{section\.illustrationSeries\.length\}/);
  assert.match(css, /\.knowledge-illustration-series[\s\S]*grid-template-columns: repeat\(2,[\s\S]*@media \(max-width: 640px\)[\s\S]*\.knowledge-illustration-series \{ grid-template-columns: 1fr/);
  assert.match(helpContent, /id: "actuator-electrical-mechanical-angle"[\s\S]*expertKnowledge:[\s\S]*elektrischer Winkel = Polpaarzahl × mechanischer Winkel[\s\S]*drei Phasen A, B und C sind nicht dasselbe wie drei Polpaare[\s\S]*n = 60 × f ÷ p/);
  assert.match(helpContent, /digital-signal-voltage-thresholds\.svg/);
  assert.match(helpContent, /Der Übergang von einem Pegel zum anderen heißt Flanke:[\s\S]*SPI und I²C übertragen dafür ein Taktsignal; UART leitet die Abtastzeit aus der Startflanke/);
  assert.match(helpContent, /protocols-manchester-coding[\s\S]*expertKnowledge:[\s\S]*Manchester-Codierung/);
  assert.match(helpContent, /protocols-qam-outlook[\s\S]*heading: "QAM: mehrere Bits pro Funksymbol"[\s\S]*expertKnowledge:/);
  assert.match(informationView, /function renderExpertKnowledge[\s\S]*knowledge-expert-note[\s\S]*Expertenwissen[\s\S]*Technischer Hintergrund/);
  assert.match(css, /\.knowledge-expert-note[\s\S]*#8b5cf6/);
  assert.match(informationView, /section\.illustration[\s\S]*knowledge-section-illustration[\s\S]*loading="lazy" decoding="async"/);
  assert.match(css, /\.knowledge-section-illustration \{[\s\S]*background: #0b1018[\s\S]*\.knowledge-section-illustration figcaption \{[\s\S]*background: #0f172a; color: #cbd5e1/);
  assert.match(helpContent, /id: "actuator-motors-and-drives", heading: "Motoren und Antriebe auswählen"[\s\S]*id: "actuator-motor-control", heading: "Motoransteuerung: Leistungsteil und Firmware"[\s\S]*id: "actuator-safe-motion", heading: "Sicher bewegen: Rückmeldung und Fehlerfälle"/);
  assert.match(helpContent, /id: "actuator-motor-theory", heading: "Zwei Motorfamilien: Wechselstrom und Gleichstrom"[\s\S]*id: "actuator-synchronous-machines", heading: "Synchronmaschinen: mit einem drehenden Magnetfeld mitlaufen"[\s\S]*id: "actuator-asynchronous-machines"[\s\S]*id: "actuator-dc-motors", heading: "Gleichstrommotoren: Reihenschluss, Nebenschluss und permanent erregt"[\s\S]*id: "actuator-bldc-basics"[\s\S]*B6-Brücke[\s\S]*sinusförmige Phasenströme/);
  assert.match(helpContent, /\/app\/learn\/\?catalog=motor-control-basics/);
});

test("explains optional embedded, local, global and iPhone system landscapes in public help", () => {
  const navigation = normalizedKnowledgeContent.match(/const topics = \[[\s\S]*?const articles/)?.[0] || "";
  assert.match(navigation, /id: "distributed-systems"[\s\S]*"server-systems", title: "Systemlandschaften und Server"/);
  assert.match(helpContent, /"distributed-systems-introduction": \{[\s\S]*Ein verteiltes System verbindet die physische Welt mit Software[\s\S]*Die Rollen sind verschieden/);
  assert.match(helpContent, /"server-systems": \{/);
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
  const cloudChapter = distributedKnowledgeContent.match(/"cloud-services": \{[\s\S]*?"choosing-servers": \{/s)?.[0] || "";
  assert.match(cloudChapter, /Die Kostenfalle Cloud-Computing[\s\S]*Typische Ursachen[\s\S]*Jede Ausführung muss begrenzt sein/);
  const internetVpsChapter = distributedKnowledgeContent.match(/"internet-vps": \{[\s\S]*?"home-server-internet-security": \{/s)?.[0] || "";
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
  assert.match(informationView, /function renderStateChart/);
  assert.match(css, /\.help-state-chart \{/);
  assert.match(informationView, /function renderTamagotchiUmlStateChart/);
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

test("groups development processes and version management under public working methods", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${knowledgeContent};this.content = KnowledgeContent;`, context);

  const processTopic = context.content.topics.find((topic) => topic.id === "working-methods");
  const processArticle = context.content.articles["development-processes-overview"];
  const versionArticle = context.content.articles["version-control-and-variants"];
  const engineeringArticle = context.content.articles["from-problem-to-system"];

  assert.equal(processTopic.title, "Arbeitsmethodiken");
  assert.equal(processTopic.access, "public");
  assert.equal(processTopic.children[0].articleId, "development-processes-overview");
  assert.equal(processTopic.children[1].articleId, "version-control-and-variants");
  assert.equal(processArticle.access, "public");
  assert.equal(versionArticle.access, "public");
  assert.deepEqual(
    JSON.parse(JSON.stringify(processArticle.sections.map((section) => section.id))),
    ["development-processes-dimensions", "engineering-thinking-models", "development-processes-next-steps"],
  );
  assert.match(JSON.stringify(processArticle), /Klarheit, Risiko, Änderungsdynamik und notwendigem Nachweis/);
  assert.match(JSON.stringify(processArticle), /Wasserfallmodell/);
  assert.match(JSON.stringify(processArticle), /V-Modell/);
  assert.match(JSON.stringify(processArticle), /Agiles Arbeiten/);
  assert.match(JSON.stringify(processArticle), /hybrides Vorgehen/);
  assert.ok(engineeringArticle.relatedTopics.includes("development-processes-overview"));
  assert.ok(!engineeringArticle.sections.some((section) => section.id === "engineering-thinking-models"));
  assert.match(JSON.stringify(versionArticle), /Ordnerkopien/);
  assert.match(JSON.stringify(versionArticle), /CVS/);
  assert.match(JSON.stringify(versionArticle), /Subversion/);
  assert.match(JSON.stringify(versionArticle), /Git/);
  assert.match(JSON.stringify(versionArticle), /Variantenmanagement/);
  assert.match(JSON.stringify(versionArticle), /3-2-1-Regel/);
  assert.equal(versionArticle.sections.find((section) => section.id === "versioning-history").illustrationSeries.length, 4);
  assert.match(informationView, /section\.illustrationSeriesWide \? " is-wide"/);
  [
    "versioning-file-copies.svg",
    "versioning-stage-1-local.svg",
    "versioning-stage-2-cvs.svg",
    "versioning-stage-3-svn.svg",
    "versioning-stage-4-git.svg",
    "versioning-git-objects.svg",
    "versioning-variants.svg",
    "versioning-backup.svg",
  ].forEach((asset) => assert.equal(fs.existsSync(path.join(appRoot, "..", "assets", asset)), true, asset));
});

test("keeps help and knowledge models physically disjoint", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${helpOnlyContent};${knowledgeContent};this.help = HelpContent;this.knowledge = KnowledgeContent;`, context);
  const helpTopicIds = new Set(context.help.topics.map((topic) => topic.id));
  const helpArticleIds = new Set(Object.keys(context.help.articles));

  assert.equal(context.help.topics.length, 3);
  assert.equal(context.knowledge.topics.length, 11);
  assert.ok(context.knowledge.topics.every((topic) => !helpTopicIds.has(topic.id)));
  assert.ok(Object.keys(context.knowledge.articles).every((articleId) => !helpArticleIds.has(articleId)));
  assert.ok(context.help.findTopic("quick-start"));
  assert.equal(context.help.findTopic("actuators"), null);
  assert.ok(context.knowledge.findTopic("actuators"));
  assert.equal(context.knowledge.findTopic("quick-start"), null);
});

test("separates the knowledge portal from platform help while reusing a neutral view", () => {
  const server = [
    "dev-server.js",
    path.join("dev", "server", "knowledge-routes.js"),
    path.join("dev", "server", "web-routes.js"),
  ].map((file) => fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8")).join("\n");
  assert.match(helpOnlyContent, /const HelpContent =/);
  assert.match(knowledgeContent, /const KnowledgeContent =/);
  assert.match(helpOnlyContent, /const articleAccess =/);
  assert.match(helpOnlyContent, /"first-project": "premium"/);
  assert.match(helpOnlyContent, /"register-device": "account"/);
  assert.doesNotMatch(helpOnlyContent, /"workers-and-queues"/);
  assert.doesNotMatch(knowledgeContent, /"register-device": \{/);
  assert.match(knowledgeContent, /article\.access = chapter\.access \|\| "premium"/);
  assert.doesNotMatch(helpOnlyContent, /surface: "knowledge"/);
  assert.doesNotMatch(knowledgeContent, /surface: "help"/);
  assert.match(informationView, /function renderPaywall/);
  assert.match(informationView, /Premium-Inhalt/);
  assert.match(informationView, /Dieses Kapitel mit Premium weiterlesen/);
  assert.match(informationView, /Du kannst jederzeit eine andere Kapitelvorschau öffnen/);
  assert.match(informationView, /help-access-badge/);
  const knowledgeBookView = informationView.match(/function renderKnowledgeBook[\s\S]*?function activateKnowledgeBook/)?.[0] || "";
  assert.doesNotMatch(knowledgeBookView, /accessBadge/);
  assert.match(knowledgeBookView, /renderPaywall|renderArticle/);
  assert.match(css, /\.help-paywall/);
  assert.match(server, /\["\/hilfe", "\/hilfe\/"\][\s\S]*requireSession/);
  assert.match(server, /\["\/wissen", "\/wissen\/"\][\s\S]*serveStatic\(res, appDir, "\/index\.html"\)/);
  assert.doesNotMatch(server, /url\.pathname === "\/app\/help"/);
  assert.match(app, /const isPublicHelpPage/);
  assert.match(app, /const isPublicKnowledgePage/);
  assert.match(app, /label: state\.account \? "Plattform" : "Startseite", route: state\.account \? "\/app\/dashboard\/" : "\/"/);
  assert.match(app, /if \(link\.dataset\.breadcrumbRoute === "\/"\) \{[\s\S]*?window\.location\.assign\("\/"\)/);
  assert.match(app, /if \(isPublicInformationPage\) document\.body\.classList\.add\("public-help-page"\)/);
  assert.match(app, /document\.body\.classList\.toggle\("public-information-anonymous", !state\.account\)/);
  assert.match(app, /public-information-anonymous/);
  assert.match(app, /isPublicKnowledgePage[\s\S]*\? "account,knowledge,subscription"[\s\S]*: "account,subscription"/);
  assert.match(app, /getJson\(`\/api\/platform\/summary\?include=\$\{publicSummarySections\}`\)/);
  assert.match(knowledgeContent, /"workers-and-queues"/);
  assert.match(informationView, /Wissensportal/);
  assert.match(informationView, /contentForSurface/);
  assert.match(informationView, /findContentForTopic/);
  assert.match(informationView, /"\/wissen\/"/);
  assert.match(informationView, /function renderKnowledgeBook/);
  assert.match(informationView, /\$\{escapeHtml\(book\.title\)\} · Teil \$\{topicIndex \+ 1\}/);
  assert.match(informationView, /const chapterNumber = `\$\{topicIndex \+ 1\}\.\$\{chapterIndex \+ 1\}`/);
  assert.match(informationView, /knowledge-chapter-number/);
  assert.match(informationView, /knowledge-subchapter-link/);
  assert.match(informationView, /knowledge-subchapter-number/);
  assert.match(informationView, /data-knowledge-subchapter/);
  assert.match(informationView, /<details class="knowledge-part-toc" \$\{entry\.id === topic\.id \? "open" : ""\}>/);
  assert.match(informationView, /<details class="knowledge-chapter-toc">/);
  assert.match(informationView, /function renderKnowledgeChapterToc/);
  assert.match(informationView, /knowledge-chapter-title-link/);
  assert.doesNotMatch(informationView, /Leseprobe öffnen|Kapitel öffnen/);
  assert.doesNotMatch(informationView, /knowledge-chapter-link[^>]*>[\s\S]*?→/);
  assert.match(informationView, /knowledge-subchapter-link is-locked/);
  assert.doesNotMatch(informationView, /knowledge-subchapter-link is-locked[^>]*>[^<]*<small>Premium<\/small>/);
  assert.doesNotMatch(informationView, /Kapitel lesen|Unterkapitel/);
  assert.match(css, /\.knowledge-part-toc > summary/);
  assert.doesNotMatch(informationView, /Kapitelübersicht öffnen oder schließen/);
  assert.match(informationView, /function renderPracticeLessonLink/);
  assert.match(informationView, /knowledge-topic=/);
  assert.match(informationView, /if \(!access\.hasAccount\)/);
  assert.match(informationView, /Anmeldung erforderlich · Demo-Link/);
  assert.match(informationView, /Demo-Link · Zuordnung zu einer Lesson folgt/);
  assert.match(informationView, /data-knowledge-chapter/);
  assert.match(informationView, /renderArticle\(article, selectedChapter, \{ showRelated: false, chapterNumber, accessRequirement: book\.access \}\)/);
  assert.match(informationView, /renderKnowledgeArticleLoading\(selectedChapter\)/);
  assert.match(informationView, /KnowledgeContent\.loadArticle\(articleId\)/);
  assert.match(informationView, /KnowledgeContent\.adjacentArticleIds\(chapterId\)/);
  assert.match(informationView, /knowledge-part-link/);
  assert.match(informationView, /data-knowledge-part/);
  assert.match(informationView, /event\.stopPropagation\(\)/);
  assert.match(informationView, /scrollIntoView\(\{ behavior: "smooth", block: "start" \}\)/);
  assert.doesNotMatch(informationView, /const syncChapterWithScroll/);
  assert.doesNotMatch(informationView, /window\.addEventListener\("scroll", knowledgeScrollHandler/);
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

test("keeps explicitly public knowledge chapters open and gates the remaining chapters independently", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${knowledgeContent};this.content = KnowledgeContent;`, context);
  const chapters = context.content.topics.flatMap((topic) => topic.children || []);

  assert.equal(chapters.length, 35);
  assert.equal(context.content.articles["from-problem-to-system"].access, "public");
  assert.equal(context.content.articles["development-processes-overview"].access, "public");
  assert.equal(context.content.articles["version-control-and-variants"].access, "public");
  assert.equal(context.content.articles["browser-pwa-mobile-app"].access, "public");
  assert.ok(chapters
    .filter((chapter) => !["from-problem-to-system", "development-processes-overview", "version-control-and-variants", "browser-pwa-mobile-app"].includes(chapter.id))
    .every((chapter) => context.content.articles[chapter.articleId]?.access === "premium"));
  assert.match(informationView, /article\.sections\.slice\(0, 1\)/);
  assert.match(informationView, /knowledge-chapter-preview/);
});

test("publishes radio technologies with foundations, trade-offs and a careful safety boundary", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${knowledgeContent};this.content = KnowledgeContent;`, context);
  const article = context.content.articles["radio-technologies-understand"];

  assert.equal(article.sections.length, 16);
  assert.deepEqual(
    JSON.parse(JSON.stringify(article.sections.slice(8, 14).map((section) => section.id))),
    ["radio-bluetooth", "radio-wifi", "radio-lora", "radio-zigbee", "radio-nfc", "radio-rc-model"],
  );
  assert.ok(article.sections.slice(8, 14).every((section) => section.table?.headers?.join("|") === "Eigenschaften|Vorteile|Nachteile"));
  assert.match(JSON.stringify(article.sections[0]), /Funk ist kein unsichtbares Kabel/);
  assert.deepEqual(
    JSON.parse(JSON.stringify(article.sections[0].table.headers)),
    ["Vergleichsgröße", "Was bedeutet dieser Begriff?", "Wichtige Randbedingungen"],
  );
  assert.match(JSON.stringify(article.sections[0]), /Satellitenverbindung.*sehr große Entfernung.*hohe Datenrate/);
  assert.match(JSON.stringify(article.sections[0]), /Zuverlässigkeit und Fehlertoleranz/);
  assert.match(JSON.stringify(article.sections[0]), /Prüfsummen.*Wiederholungen.*Fehlerkorrektur/);
  assert.match(JSON.stringify(article.sections[1]), /Warum Funk eine Frequenz braucht/);
  assert.match(JSON.stringify(article.sections[1]), /Denke an ein gewöhnliches Radio/);
  assert.equal(article.sections[1].illustration.src, "/assets/radio-frequency-and-spectrum.png");
  assert.match(JSON.stringify(article.sections[2]), /Die Modulation erzeugt also kein Frequenzband/);
  assert.match(JSON.stringify(article.sections[2]), /Signalbandbreite oder Kanalbandbreite/);
  assert.equal(article.sections[2].illustration.src, "/assets/radio-modulation-bandwidth.png");
  assert.match(JSON.stringify(article.sections[3]), /keine neue Funklinie bei absolut 1 Hertz/);
  assert.match(JSON.stringify(article.sections[3]), /f₀ plus oder minus 3 Hertz, 5 Hertz/);
  assert.match(JSON.stringify(article.sections[3]), /Schaltfrequenz beträgt 0,5 Hertz/);
  assert.equal(article.sections[3].illustration.src, "/assets/radio-ask-ook-spectrum.png");
  assert.match(JSON.stringify(article.sections[4]), /Warum die Datenrate nicht unendlich sein kann/);
  assert.match(JSON.stringify(article.sections[4]), /Je mehr Daten pro Sekunde.*höhere Frequenzanteile/);
  assert.match(JSON.stringify(article.sections[4]), /Freifelddämpfung mit der Frequenz/);
  assert.match(JSON.stringify(article.sections[4]), /bis hin zu Infrarot und Licht/);
  assert.match(JSON.stringify(article.sections[5]), /Wo im elektromagnetischen Spektrum gefunkt wird/);
  assert.match(JSON.stringify(article.sections[5]), /logarithmischen Achse/);
  assert.match(JSON.stringify(article.sections[5]), /Frequenzplan der Bundesnetzagentur/);
  assert.equal(article.sections[5].illustration.src, "/assets/electromagnetic-spectrum-radio-applications.png");
  assert.match(JSON.stringify(article.sections[6]), /Warum nicht jeder beliebig funken darf/);
  assert.match(JSON.stringify(article.sections[6]), /Einzelzuteilung.*Allgemeinzuteilung/);
  assert.match(JSON.stringify(article.sections[6]), /ISM-Band ist nicht automatisch ein rechtsfreier Funkbereich/);
  assert.match(JSON.stringify(article.sections[6]), /Modulation und Kodierung sind nicht in jedem Bereich vollständig vorgeschrieben/);
  assert.match(JSON.stringify(article.sections[7]), /Jede Funkübertragung kann gestört werden/);
  assert.match(JSON.stringify(article.sections[7]), /nicht als alleinige Grundlage für eine sicherheitskritische Funktion/);
  assert.match(JSON.stringify(article.sections[7]), /ziviles Passagierflugzeug/);
  assert.match(JSON.stringify(article.sections[15]), /Lernprojekt „Funktechnologien verstehen“/);
});

test("derives every knowledge navigation topic from the rendered article sections", () => {
  const context = {};
  vm.createContext(context);
  vm.runInContext(`${knowledgeContent};this.content = KnowledgeContent;`, context);
  const chapters = context.content.topics.flatMap((topic) => topic.children || []);

  for (const chapter of chapters) {
    const articleSections = JSON.parse(JSON.stringify(
      (context.content.articles[chapter.articleId]?.sections || [])
        .filter((section) => section.id)
        .map((section) => ({ id: section.id, title: section.heading })),
    ));
    assert.deepEqual(
      JSON.parse(JSON.stringify(chapter.subchapters)),
      articleSections,
      `navigation for ${chapter.id} must match its rendered sections`,
    );
  }

  const motorChapter = chapters.find((chapter) => chapter.id === "actuators");
  assert.equal(motorChapter.subchapters.length, 18);
  assert.deepEqual(
    JSON.parse(JSON.stringify(motorChapter.subchapters.slice(8, 11))),
    [
      { id: "actuator-synchronous-machines", title: "Synchronmaschinen: mit einem drehenden Magnetfeld mitlaufen" },
      { id: "actuator-synchronous-back-emf", title: "Drei Phasen, Gegen-EMK und Kurzschlussbremsung" },
      { id: "actuator-electrical-mechanical-angle", title: "Elektrische und mechanische Drehung" },
    ],
  );
  assert.deepEqual(
    JSON.parse(JSON.stringify(motorChapter.subchapters.slice(0, 3))),
    [
      { id: "actuator-current-magnetic-field", title: "Der Anfang: Strom erzeugt ein Magnetfeld" },
      { id: "actuator-magnetic-core", title: "Was ein magnetischer Kern ist" },
      { id: "actuator-current-force", title: "Ein Magnetfeld kann einen stromdurchflossenen Draht bewegen" },
    ],
  );
});
