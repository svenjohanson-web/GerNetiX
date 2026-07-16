# Entwicklungspfad: Architektur zuerst

## Ziel

Der GerNetiX-Projektbeginn soll Nutzer nicht sofort in Technologieentscheidungen treiben.
Zuerst wird die Zielarchitektur verstanden: Welche Geraete, Anwendungen, Server, Datenfluesse, Nutzer und Betriebsbedingungen gehoeren zum Projekt?
Erst danach werden Technologien wie MQTT, ESP32 mit WLAN, REST, WebSocket, Datenbank, Mobile App, PC-App oder Browser-App abgeleitet.

Das geschaeftliche Ziel ist Kundenbindung.
Wenn GerNetiX das Zielbild des Nutzers versteht, kann die Plattform nach dem ersten Projekt passende Anschlussprojekte, Vertiefungen, Hardware-Angebote oder Lernpfade vorschlagen.
Der Nutzer soll GerNetiX dadurch nicht als einmaligen Kurs, sondern als langfristigen Projektbegleiter erleben.

## Gefuehrter Ablauf

1. Projektziel und Nutzungsszenario klaeren.
2. Zielsysteme erkennen: IoT Device, Backend, Mobile App, Desktop App, Browser App, lokales Device-Interface, HomeServer oder Cloud.
3. Daten und Kommunikation beschreiben: Zustaende, Befehle, Telemetrie, Synchronisation, Offline-/Online-Verhalten.
4. Zielarchitektur bestaetigen oder offene Architekturfragen speichern.
5. In einem eigenen Hardware-Zuordnungsschritt abstrakte IoT-Devices, Sensoren und Aktoren konkretisieren.
6. Reales Board, Bauteileigenschaften, notwendige Vorschaltungen und Pin-Verbindungen festlegen.
7. Technologieentscheidungen aus Zielarchitektur und Hardware-Zuordnung ableiten.
8. Projektkontext fuer IDE, Project Server und Context Manager speichern.
9. Naechste sinnvolle Projekte, Vertiefungen oder Angebote aus dem Zielbild ableiten.
10. Abschlussprojekt durchfuehren: Architektur herleiten, Hardware zuordnen, KI-Vorschlag pruefen und die GerNetiX-Entwicklungsplattform als Projektbegleiter benutzen.

## Hardware-Zuordnung als eigener Zwischenschritt

Nach der bestaetigten statischen Architektur oeffnet die Entwicklungsplattform die eigene View `/app/development-platform/hardware/`.

- Oben bleibt die bestaetigte statische PlantUML-Architektur als Kontext sichtbar.
- Darunter listet eine Tabelle alle abstrakten Komponenten.
- Ein abstraktes IoT-Device wird einem realen Board-Typ aus dem Hardware Catalog zugeordnet, zum Beispiel ESP-WROOM-32 oder Arduino Nano R3.
- Optional wird das gewaehlte Board bereits hier mit einem kompatiblen Inventar-Device des Accounts verknuepft. Diese Zuordnung besitzt keine zweite Pflegeoberflaeche in der IDE.
- Sensoren werden zuerst fachlich nach ihrer Sensorart, danach nach ihrer Erfassungsart und erst dann als konkretes Bauteil festgelegt. Aktoren erhalten einen konkreten Typ und ihre technischen Eigenschaften.
- Elektrisch notwendige Zwischenstufen werden explizit modelliert. Ein PT1000 wird beispielsweise nicht direkt an einen Pin angeschlossen, sondern ueber Messbruecke oder Konstantstromquelle und Messverstaerker mit einem ADC-Pin verbunden. Ein DC-Motor benoetigt eine Treiber- oder H-Brueckenstufe.
- Der Schritt ist erst vollstaendig, wenn alle Hardware-Komponenten konkretisiert und ihre benoetigten Pins zugeordnet sind.

Der Project Server persistiert die Konfiguration als strukturiertes `hardware-configuration`-Modell im Projektmanifest. Die einzige sichtbare Hardware-Architektursicht ist `Architektur/verdrahtung/hardware.puml`. Sie wird aus diesem Modell erzeugt und enthaelt vollstaendig Prozessor und Board, eine optionale Inventar-Device-Zuordnung, Sensorart und Erfassungsart, konkrete Sensoren und Aktoren, Eigenschaften, notwendige Vorschaltungen sowie alle Pinverbindungen. Eine zweite Verdrahtungs- oder Zuordnungsdarstellung ist nicht zulaessig. Zusaetzliche Konfigurationsartefakte unter `Komponenten/<Device>/Konfiguration/Hardware` sind abgeleitete technische Unterlagen, aber keine weitere Architektur-Pflegeoberflaeche. Der Browserzustand ist keine fachliche Quelle der Wahrheit.

Nach `Uebernehmen und weiter` bilden statische Architektur und Hardware-Verdrahtung eine freigegebene Baseline. Die IDE zeigt diese Artefakte schreibgeschuetzt an. Fachliche oder technische Architektur-Aenderungen werden im jeweiligen Discovery-/Realisierungsschritt vorgenommen und erneut uebernommen; Quellcode und projektspezifisches Verhalten werden anschliessend in der IDE bearbeitet.

## PoC in der Kunden-IDE

Der erste PoC liegt im gemeinsamen Plattform-Frontend unter `/app/development-platform/`.
Die Ansicht enthaelt eine Chatbox fuer Architektur-Discovery und vorbereitete Fragerichtungen fuer Projektziel, Zielsysteme, Daten, Geraete und erste Architekturableitung.

Der Identity Server stellt dafuer den Endpunkt `/api/platform/development-assistant/chat` bereit.
Im lokalen Entwicklungsbetrieb spricht dieser Endpunkt den im eigenstaendigen Admin Tool konfigurierten LLM-Provider an.

Konfiguration:

- Admin Tool `http://127.0.0.1:4600/admin/`
- `GET /api/admin/llm-config`
- `PUT /api/admin/llm-config`
- `GET /api/admin/llm-models`
- `POST /api/admin/llm-config/test`
- lokaler Default: Ollama unter `http://127.0.0.1:11434`

Die LLM-Konfiguration ist als Task-Router gedacht:

- `general_chat`: allgemeiner KI-Chat
- `architecture_discovery`: gefuehrter Architektur-Dialog
- `artifact_generation`: PlantUML, Pseudocode und andere ableitbare Artefakte
- `code_generation`: Quellcode- und Pseudocode-zu-Code-Aufgaben

Der Chat darf je nach Admin-Einstellung ueber eine externe API laufen. Artefakt- und Codegenerierung bevorzugen standardmaessig ein lokales LLM, um externe Providerkosten zu vermeiden und die Kundenmarge zu schuetzen.

Freigegebene Datenquellen im PoC:

- aktueller Chat
- zentrale Architektur-Prompt-Grundlage aus der AI-Context-SQLite

Noch nicht freigegeben:

- Projektdateien in der allgemeinen Architektur-Discovery
- Graphdaten
- Kundendaten
- externe Webquellen

Der projektgebundene Code-Explorer ist davon bewusst getrennt. Er nutzt den aufgabenbezogenen Retrieval-Ansatz aus [`ai-project-source-retrieval.md`](ai-project-source-retrieval.md): Aufgabe zuerst, dann gezielte Project-Server-Suche, aktuelle Datei plus hoechstens sechs relevante Treffer. Eine pauschale Uebergabe der ersten 40 oder aller Dateien ist untersagt.

## Quellcode-Trennung

Der Lernast bleibt in der Kunden-IDE-Orchestrierung und den gefuehrten Projekt-/Lesson-Views.
Der Entwicklungsast fuer Architektur-Discovery ist als eigener Controller und eigener Backend-Adapter getrennt:

- Frontend-Controller: `services/identity-server/public/app/development-platform.js`
- Backend-Adapter: `services/identity-server/src/dev/development-assistant.js`
- App-Orchestrierung: `services/identity-server/public/app/app.js` bindet den Entwicklungsast nur als Controller ein.
- Dev-Server: `services/identity-server/src/dev-server.js` routet nur auf den Development-Assistant. Prompt-Grundlagen liegen fuehrend im AI Context Server und werden nicht im Identity Server gepflegt.
- Hardware-Architektur: `POST /api/platform/development-projects/:projectId/hardware-configuration` persistiert das strukturierte Realisierungsmodell ueber den Project Server und erzeugt daraus die vollstaendige `Architektur/verdrahtung/hardware.puml`.

## Leitregel

Technologie ist eine Folge der Architektur, nicht der Startpunkt.

Beispiele:

- MQTT wird relevant, wenn mehrere Geraete oder Services asynchron Status, Befehle oder Telemetrie austauschen muessen.
- Das Pattern `Touchscreen Game Loop` wird relevant, wenn ein Spiel direkt ueber Touchscreen und Display bedient wird: Touch-Eingaben aktualisieren Spielzustand und Szenenlogik, danach wird die Anzeige neu gerendert. Bildrate, Szenenwechsel sowie optional Sound und haptisches Feedback werden als nachfolgende Verhaltens- und Hardwarefragen geklaert.
- ESP32 mit WLAN wird relevant, wenn ein guenstiges Embedded Device direkt im lokalen Netzwerk oder per OTA erreichbar sein soll.
- Eine Mobile App wird relevant, wenn alltagsnahe Bedienung, Benachrichtigungen oder Smartphone-Sensorik gebraucht werden.
- Eine Browser App wird relevant, wenn plattformunabhaengiger Zugriff ohne Installation wichtiger ist als tiefe lokale Integration.
- Ein Backend wird relevant, wenn zentrale Persistenz, Authentifizierung, mehrere Clients, Synchronisation oder Remote-Zugriff gebraucht werden.

## Kanonische Verankerung

Die logische Architektur stellt abstrakte Strukturelemente in Projektvorlagen, KI-Ableitungen und gespeicherten Manifest-Sichten einheitlich als neutrale Rechtecke dar. Externe menschliche Rollen duerfen als Akteure erscheinen. Konkrete Symbole wie Node, Component, Database oder Cloud gehoeren erst in die passende Hardware-, Software- oder Deployment-Realisierung, damit die logische Sicht keine Realisierungsentscheidung vorwegnimmt.

Komponententyp und Komponenteninstanz werden sprachlich getrennt. Ein generisches Element vom Typ `IoT-Device` erhaelt deshalb einen eindeutigen Instanznamen wie `IoT-Device 1`, `IoT-Device 2` und so weiter. Fachliche Instanznamen wie `Gewaechshaussteuerung` bleiben erhalten. Prozessor, Board und Inventar-Device sind Realisierungs- beziehungsweise Betriebszuordnungen und ersetzen niemals den logischen Instanznamen.

Projektvorlagen sind intern getrennt aufgebaut: Das Template-Modell beschreibt Metadaten, logische Elemente, Beziehungen und optionale Realisierungsvorgaben. PlantUML, Quellcode-Scaffolds und der reduzierte UI-Katalog werden daraus durch eigene Renderer abgeleitet. Server und Browser verwenden dieselbe Registry; das Project-Manifest speichert weiterhin nur die konkrete projektgebundene View und die kompatible `template_id`-Referenz.

Die Vorlage `Datenlogger mit privater Web-Push-PWA` aktiviert eine projektprivate Datenhaltung als verpflichtende Grundfunktion. Sie ist keine sichtbare Komponente der logischen Architektur und auch keine vom Nutzer zu waehlende Infrastruktur. Messquelle, Intervall, Verdichtung und Aufbewahrungsregel werden nach dem Template-Start an der jeweiligen Sensor-Konfiguration festgelegt und im account- sowie projektgebundenen SQL-Manifest gespeichert.

Komponenten duerfen nicht beliebig miteinander verbunden werden. Das [Komponenten- und Beziehungsmetamodell](project-component-relationship-metamodel.md) definiert die zulaessigen Komponententypen und fachlich benannten Quell-/Zielbeziehungen. Es steuert die Auswahl im Projekteditor, validiert gespeicherte logische Architekturen und leitet die Steuereinheit der Hardware-Zuordnung ab: beim Sensor aus `Sensor → IoT-Device`, beim Aktor aus `IoT-Device → Aktor`.

Die Projektvorlage `Sensor-Aktor-Steuerung` startet mit einer zusammenhaengenden logischen Wirkungskette: `Sensor 1` liefert einen Messwert an `IoT-Device 1`; dessen lokale Steuerlogik steuert `Aktor 1`. Konkrete Sensoren, Aktoren, Boards, Pins und Treiber bleiben Realisierungsentscheidungen der nachfolgenden Hardware-Konfiguration.

Die Projektvorlage `Verteilte Hausautomatisierung` verwendet einen statisch gefuehrten Konfigurationsassistenten. Er erfasst mehrere IoT-Devices mit Name, Rolle, Sensor- und Aktoranzahl, den Kommunikationsweg (`lokal`, `WLAN/REST`, `WLAN/MQTT`, `Zigbee` oder noch offen), die optionale zentrale Koordination, das ausgetauschte Zustandsmodell und das Verhalten bei Verbindungsausfall. Display, Touchscreen, Akkubetrieb, SD-Karte, Audio und ein erhoehter GPIO-Bedarf werden als Eigenschaften des jeweiligen Boards ausgewaehlt. Insbesondere ist ein Touchscreen kein unabhaengiges IoT-Device und keine separat angehaengte Komponente. Aus den Anforderungen erzeugt die Plattform einen Boardvorschlag und eine jederzeit mit der Tabelle uebereinstimmende logische Architekturvorschau. Die Konfiguration wird gemeinsam mit dem Architektur-Dialog im SQL-Projektmanifest gespeichert und bleibt die Grundlage fuer die nachfolgende Hardware-Zuordnung.

Die statische Architektur der Projektvorlage `Touchscreen-Spielesammlung` enthaelt ausschliesslich die Strukturelemente `Nutzer` und `Board mit Touchdisplay`. Startbildschirm, Spielauswahl, Game Loop, Spielzustand und einzelne Spiele sind Verhalten beziehungsweise Code und duerfen in dieser Sicht nicht als Komponenten erscheinen. Im Konfigurationsschritt waehlt der Nutzer ein Ausfuehrungspattern (`Touchscreen Game Loop`, ereignisgesteuerter Scene Loop oder rundenbasierte State Machine) und danach die Beispiele fuer den Startbildschirm. Der erste Katalog umfasst Nibbles, Snake, Frogger, Tic-Tac-Toe, Pong, Breakout und Memory. Anschliessend wird ausschliesslich ein laut Hardware Catalog touchfaehiges Display-Board angeboten und mit den accountgebundenen Inventar-Boards abgeglichen. Die Auswahl wird im SQL-Projektmanifest gespeichert; Board und Inventar-Device werden zugleich in die projektgebundene Build-Konfiguration uebernommen, ohne die statische Architektur mit Verhalten oder konkreter Realisierung zu vermischen.

Der Quellcode der Spielesammlung liegt von Beginn an im User-Bereich. `user_main.cpp` startet nur die `GameApplication`. Die View `view/start_screen.h` ist fuer Menue und Touch-Auswahl verantwortlich; Vertrag, Katalog und Pattern-Orchestrierung liegen unter `game/`, waehrend jedes Beispielspiel eine eigene Datei unter `games/` besitzt. `config/selected_games.h` wird reproduzierbar aus der Formularauswahl erzeugt. Beim Build werden diese User-Header unter `include/user_project/` in das geschuetzte Basissoftwarepaket eingeblendet, ohne die Runtime-Dateien zu veraendern.

Die KI ist dabei unterstuetzend, nicht fuehrend: Eine lokale Regelpruefung nennt pro Befund eine empfohlene Massnahme und veraendert keine Auswahl. Fuer offene Fragen kann der normale Projektchat dieselbe persistierte Konfiguration als Kontext verwenden. Dadurch bleiben beide Arbeitsweisen sichtbar: nachvollziehbare Formularauswahl und erklaerende KI-Unterstuetzung.

Die Entwicklungsplattform trennt Projektstart und Konfiguration sichtbar. Beim frischen Eintritt wird kein letztes Projekt und kein Diagramm automatisch geladen. Grosse, dauerhaft sichtbare Kacheln bieten das Fortsetzen des letzten Projekts, ein leeres Projekt, ein Template oder das gezielte Oeffnen eines vorhandenen Projekts an. Nur die Auswahl eines Templates zeigt bereits vor dem Anlegen dessen initiale Architekturvorschau; ein leeres Projekt besitzt bewusst noch kein PlantUML-Modell. Ein vorhandenes Projekt zeigt seine gespeicherte Architektur erst nach expliziter Auswahl. Anforderungen, Konfigurationsformulare und KI-Chat bleiben im Projektstart ausgeblendet. Erst `Weiter zur Konfiguration` oeffnet diese Werkzeuge. Von dort fuehrt ein eigener Abschluss `Weiter zur Hardware` in die Realisierung.

In der Hardware-Realisierung wird ein IoT-Device zweistufig konkretisiert: Zuerst wird die Prozessorvariante gewaehlt, danach zeigt die Boardauswahl nur Katalogeintraege mit genau dieser `processor_family` und `mcu_variant`. Ein Prozessorwechsel verwirft eine nicht mehr kompatible Boardauswahl. Die Project-Server-Konfiguration speichert Prozessorfamilie, Prozessorvariante und Boardprofil getrennt.

Sensoren werden dreistufig konkretisiert: Zuerst wird die fachliche Sensorart wie Temperatur, Feuchte, Position, Magnetfeld oder Kontakt gewaehlt. Danach wird die Erfassungsart wie analog, digital, Impulszaehler, Inkremental A/B, I2C, SPI, 1-Wire oder UART festgelegt. Erst danach zeigt der Hardware-Katalog passende konkrete Sensoren. Die Erfassungsart begrenzt die anschliessend angebotenen Boardanschluesse; ein Inkrementalgeber mit A/B-Signal benoetigt zwei verschiedene Zaehleingaenge. Die projektgebundene Konfiguration speichert `sensor_category`, `signal_type` und `concrete_type` getrennt.

Nach dem Hardware-Schritt besitzt jede Sensor-Komponente in der IDE unter `Konfiguration/Hardware/Eigenschaften` eine eigene, komponentenbezogene Lesesicht. Eine Tabelle wiederholt Sensorart, Erfassungsart, konkreten Katalogsensor, zugeordnetes IoT-Device, Anschluss sowie die optionale Mess- und Datenlogger-Konfiguration. Eine kompakte Verbindungskette zeigt `Sensor -> Anschluss -> IoT-Device`. Bearbeitet wird weiterhin die zentrale Hardware-Zuordnung, damit keine zweite konkurrierende Konfigurationsquelle entsteht.

Jede IoT-Device-Komponente besitzt ergaenzend eine gemeinsame Sicht `Konfiguration/Hardware/Angeschlossene Komponenten`. Sie listet Sensoren und Aktoren in derselben Tabelle mit Komponententyp, konkretem Typ, Anschluessen und Funktion. Die getrennten generierten Detailartefakte fuer Sensor-Eingaenge und Aktor-Ausgaenge bleiben als technische Projektquellen erhalten, werden im Projektbrowser jedoch nicht mehr als zwei konkurrierende Konfigurationssichten dargestellt.

Die Hardware-Zuordnung unterscheidet einen erreichbaren, aber leeren Sensor-Katalog von einem nicht erreichbaren Hardware Catalog. Bei einem Verbindungsfehler bleibt die Sensorart gesperrt und nennt den betroffenen Service; die Identity-API liefert dafuer einen expliziten Dependency-Fehler und persistiert gleichzeitig ein zentrales Systemereignis. Es werden keine lokalen Ersatzdaten als erfolgreicher Katalog ausgegeben.

In der IDE besitzt jede konkrete IoT-Device-Instanz unter `Konfiguration/Hardware/Board/Boardeigenschaften` eine eigene Auswahl der im Projekt verwendeten Boardfunktionen. Der Hardware Catalog beschreibt diese Funktionen hierarchisch: MCU-Peripherie wie GPIO, ADC, PWM, I2C, SPI, UART, PCNT, RMT, I2S, TWAI, Motor-PWM, Hardware-Timer und Interrupts bildet die unterste Ebene. Darueber liegen Runtime-Abstraktionen wie Digital-I/O, Analogeingang, serielle Busse, Ereignisse, Wellenformausgabe und Zeitgeber. Treiber und Steuerungen bilden die oberste Ebene, beispielsweise Servo-Treiber, DC-Motortreiber/H-Bruecke, Schrittmotor-Treiber und Synchronmotor-/BLDC-/PMSM-Steuerung.

Hardware-Timer und Interrupts werden in der normalen Projektkonfiguration nicht direkt ausgewaehlt. Die Basissoftware beziehungsweise das OS kapselt sie als Zeitgeber- und Ereignisabstraktion. Ihre Existenz und Abhaengigkeiten bleiben dennoch sichtbar, damit das Engineering-Modell erklaert, worauf zeitkritische Treiber beruhen. Eine Synchronmotorsteuerung liegt fachlich oberhalb von PWM: Sie benoetigt einen externen 3-Phasen-Leistungstreiber und nutzt Motor-PWM, ADC-Strommessung, Hardware-Zeitbasis sowie optional Rotorlage ueber Impulszaehler.

Die Treiber-Ebene im Boardprofil beschreibt die verfuegbaren Abstraktionen, ist aber nicht selbst die Projektzuordnung. Eine konkrete Motorsteuerung wird an der jeweiligen Motor-Aktor-Komponente ausgewaehlt. Unterstuetzt werden zunaechst DC-Motoren mit H-Bruecke oder MOSFET-Treiber, Servos mit Servo-PWM, Schrittmotoren mit STEP/DIR- oder 4-Phasen-Treiber sowie Synchronmotoren/BLDC/PMSM mit FOC- oder 6-Step-3-Phasen-Treiber. Daraus leitet die Hardware-Konfiguration die benoetigten Boardressourcen, Leistungsstufe und Anschluesse ab.

Die entsprechende Funktion auf der Sensorseite ist die Messwerterfassung mit optionalem Datenlogger. Ein Sensor liefert ueber ADC oder einen seriellen Bus einen Roh- beziehungsweise kalibrierten Messwert. Der Runtime-Zeitgeber loest die Erfassung aus; die Sensor-Komponente legt fest, ob nur der aktuelle Live-Wert benoetigt wird oder ein zyklischer Datenlogger laeuft. Fuer den Datenlogger werden Rohmessintervall, Anzahl der Werte pro Datensatz, Aggregation (letzter Wert, Mittelwert, Minimum, Maximum oder RMS) und Speicherziel getrennt konfiguriert. Beispielsweise erzeugt eine Messung alle fuenf Sekunden mit einem Fenster aus fuenf Werten und Mittelwertbildung etwa alle 25 Sekunden einen gespeicherten Datensatz.

Eine lokale Messwerthistorie verwendet persistenten Device-Speicher und eine begrenzte Ringpuffer-Aufbewahrung; alternativ kann ein Datensatz an ein angebundenes persistentes Ziel uebertragen oder nur als letzter Wert gehalten werden. Der Datenlogger wird damit wie eine Motorsteuerung auf der fachlich passenden konkreten Komponente konfiguriert und nicht als direkt auszuwaehlender Hardware-Timer modelliert.

Die IDE stellt zwei gleichwertige Wege zur Treiberbildung in einer gemeinsamen Treiberverwaltung dar. Beim bibliotheksorientierten Weg waehlt der Nutzer einen bewusst gepflegten, wiederverwendbaren Treiber aus dem Hardware Catalog. Beim funktionsorientierten Weg beschreibt oder implementiert der Nutzer zuerst das gewuenschte Verhalten; der KI-Code-Assistent untersucht die aktuelle Funktion und den Projektkontext, erkennt eine moegliche Treibergrenze und schlaegt eine Auslagerung in den Komponentenordner `Treiber/` vor. Die Herkunft `Bibliothek`, `verwaltet` oder `Projekt/KI` bleibt in der IDE sichtbar. Nach Pruefung kann ein KI-abgeleiteter Treiber denselben Lebenszyklus wie ein manuell gepflegter Treiber erhalten; KI-Herkunft ist kein eigener technischer Treibertyp.

Nur als `configurable` markierte und vom realen Board bereitgestellte MCU-Funktionen koennen als verwendet ausgewaehlt werden. Die Auswahl wird komponentenbezogen als `build_config.component_hardware_features[component_id].enabled` im SQL-Projekt gespeichert und ersetzt weder das Hardware-Catalog-Boardprofil noch die Pinzuordnung der Hardware-Architektur. Der Server validiert jede Auswahl gegen das `peripheral_profile` des gewaehlten Boards.

- Requirement: `requirement.architecture_discovery_guided_by_llm`
- Requirement: `requirement.sensor_actuator_control_project_template`
- Requirement: `requirement.distributed_home_automation_configuration_assistant`
- Architekturentscheidung: `architecture.logical_architecture_neutral_elements`
- Architekturentscheidung: `architecture.development_template_model_view_separation`
- Architekturentscheidung: `architecture.development_processor_board_step`
- Architekturentscheidung: `architecture.distributed_home_automation_static_first_assistant`
- Architekturartefakt: `architecture_artifact.project_architecture_discovery_assistant`
- Lernziel: `learning_goal.architecture_first_project_planning`
- Lernpfad: `learning_path.architecture_first_project_planning`
- Abschlussprojekt: `project.architecture_first.discovery_capstone`
- Datenmodelle: `data_model.project_architecture_dialog`, `data_model.project_target_architecture`, `data_model.project_technology_decision`
- Hardware-Datenmodell: projektgebundene `hardware-configuration` mit abstrakten Komponenten, Board-Profilen, Bauteileigenschaften, Vorschaltungen und Pin-Verbindungen
- Kundenbindungsanker: `BG-001`, `BC-025`
