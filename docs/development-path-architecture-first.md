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
5. Technologieentscheidungen aus der Zielarchitektur ableiten.
6. Projektkontext fuer IDE, Projektserver und Context Manager speichern.
7. Naechste sinnvolle Projekte, Vertiefungen oder Angebote aus dem Zielbild ableiten.
8. Abschlussprojekt durchfuehren: Architektur herleiten, KI-Vorschlag pruefen und die GerNetiX-Entwicklungsplattform als Projektbegleiter benutzen.

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

## Leitregel

Technologie ist eine Folge der Architektur, nicht der Startpunkt.

Beispiele:

- MQTT wird relevant, wenn mehrere Geraete oder Services asynchron Status, Befehle oder Telemetrie austauschen muessen.
- ESP32 mit WLAN wird relevant, wenn ein guenstiges Embedded Device direkt im lokalen Netzwerk oder per OTA erreichbar sein soll.
- Eine Mobile App wird relevant, wenn alltagsnahe Bedienung, Benachrichtigungen oder Smartphone-Sensorik gebraucht werden.
- Eine Browser App wird relevant, wenn plattformunabhaengiger Zugriff ohne Installation wichtiger ist als tiefe lokale Integration.
- Ein Backend wird relevant, wenn zentrale Persistenz, Authentifizierung, mehrere Clients, Synchronisation oder Remote-Zugriff gebraucht werden.

## Kanonische Verankerung

- Requirement: `requirement.architecture_discovery_guided_by_llm`
- Architekturartefakt: `architecture_artifact.project_architecture_discovery_assistant`
- Lernziel: `learning_goal.architecture_first_project_planning`
- Lernpfad: `learning_path.architecture_first_project_planning`
- Abschlussprojekt: `project.architecture_first.discovery_capstone`
- Datenmodelle: `data_model.project_architecture_dialog`, `data_model.project_target_architecture`, `data_model.project_technology_decision`
- Kundenbindungsanker: `BG-001`, `BC-025`
