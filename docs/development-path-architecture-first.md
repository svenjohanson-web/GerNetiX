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
- ESP32 mit WLAN wird relevant, wenn ein guenstiges Embedded Device direkt im lokalen Netzwerk oder per OTA erreichbar sein soll.
- Eine Mobile App wird relevant, wenn alltagsnahe Bedienung, Benachrichtigungen oder Smartphone-Sensorik gebraucht werden.
- Eine Browser App wird relevant, wenn plattformunabhaengiger Zugriff ohne Installation wichtiger ist als tiefe lokale Integration.
- Ein Backend wird relevant, wenn zentrale Persistenz, Authentifizierung, mehrere Clients, Synchronisation oder Remote-Zugriff gebraucht werden.

## Kanonische Verankerung

Die logische Architektur stellt abstrakte Strukturelemente in Projektvorlagen, KI-Ableitungen und gespeicherten Manifest-Sichten einheitlich als neutrale Rechtecke dar. Externe menschliche Rollen duerfen als Akteure erscheinen. Konkrete Symbole wie Node, Component, Database oder Cloud gehoeren erst in die passende Hardware-, Software- oder Deployment-Realisierung, damit die logische Sicht keine Realisierungsentscheidung vorwegnimmt.

Komponententyp und Komponenteninstanz werden sprachlich getrennt. Ein generisches Element vom Typ `IoT-Device` erhaelt deshalb einen eindeutigen Instanznamen wie `IoT-Device 1`, `IoT-Device 2` und so weiter. Fachliche Instanznamen wie `Gewaechshaussteuerung` bleiben erhalten. Prozessor, Board und Inventar-Device sind Realisierungs- beziehungsweise Betriebszuordnungen und ersetzen niemals den logischen Instanznamen.

Projektvorlagen sind intern getrennt aufgebaut: Das Template-Modell beschreibt Metadaten, logische Elemente, Beziehungen und optionale Realisierungsvorgaben. PlantUML, Quellcode-Scaffolds und der reduzierte UI-Katalog werden daraus durch eigene Renderer abgeleitet. Server und Browser verwenden dieselbe Registry; das Project-Manifest speichert weiterhin nur die konkrete projektgebundene View und die kompatible `template_id`-Referenz.

In der Hardware-Realisierung wird ein IoT-Device zweistufig konkretisiert: Zuerst wird die Prozessorvariante gewaehlt, danach zeigt die Boardauswahl nur Katalogeintraege mit genau dieser `processor_family` und `mcu_variant`. Ein Prozessorwechsel verwirft eine nicht mehr kompatible Boardauswahl. Die Project-Server-Konfiguration speichert Prozessorfamilie, Prozessorvariante und Boardprofil getrennt.

Sensoren werden dreistufig konkretisiert: Zuerst wird die fachliche Sensorart wie Temperatur, Feuchte, Position, Magnetfeld oder Kontakt gewaehlt. Danach wird die Erfassungsart wie analog, digital, Impulszaehler, Inkremental A/B, I2C, SPI, 1-Wire oder UART festgelegt. Erst danach zeigt der Hardware-Katalog passende konkrete Sensoren. Die Erfassungsart begrenzt die anschliessend angebotenen Boardanschluesse; ein Inkrementalgeber mit A/B-Signal benoetigt zwei verschiedene Zaehleingaenge. Die projektgebundene Konfiguration speichert `sensor_category`, `signal_type` und `concrete_type` getrennt.

Die Hardware-Zuordnung unterscheidet einen erreichbaren, aber leeren Sensor-Katalog von einem nicht erreichbaren Hardware Catalog. Bei einem Verbindungsfehler bleibt die Sensorart gesperrt und nennt den betroffenen Service; die Identity-API liefert dafuer einen expliziten Dependency-Fehler und persistiert gleichzeitig ein zentrales Systemereignis. Es werden keine lokalen Ersatzdaten als erfolgreicher Katalog ausgegeben.

In der IDE besitzt jede konkrete IoT-Device-Instanz unter `Konfiguration/Hardware/Boardeigenschaften` eine eigene Auswahl der im Projekt verwendeten Boardfunktionen. Zunaechst sind `ADC` und `PWM` waehlbar. Die Auswahl wird komponentenbezogen als `build_config.component_hardware_features[component_id].enabled` im SQL-Projekt gespeichert und ersetzt weder das Hardware-Catalog-Boardprofil noch die Pinzuordnung der Hardware-Architektur. Der Server akzeptiert eine Funktion nur, wenn das gewaehlte reale Board sie laut Hardware Catalog bereitstellt.

- Requirement: `requirement.architecture_discovery_guided_by_llm`
- Architekturentscheidung: `architecture.logical_architecture_neutral_elements`
- Architekturentscheidung: `architecture.development_template_model_view_separation`
- Architekturentscheidung: `architecture.development_processor_board_step`
- Architekturartefakt: `architecture_artifact.project_architecture_discovery_assistant`
- Lernziel: `learning_goal.architecture_first_project_planning`
- Lernpfad: `learning_path.architecture_first_project_planning`
- Abschlussprojekt: `project.architecture_first.discovery_capstone`
- Datenmodelle: `data_model.project_architecture_dialog`, `data_model.project_target_architecture`, `data_model.project_technology_decision`
- Hardware-Datenmodell: projektgebundene `hardware-configuration` mit abstrakten Komponenten, Board-Profilen, Bauteileigenschaften, Vorschaltungen und Pin-Verbindungen
- Kundenbindungsanker: `BG-001`, `BC-025`
