# Projektserver

Vorhaben fuer den GerNetiX Projektserver.

Der Projektserver ist die Quelle der Wahrheit fuer Benutzer, Nutzerprojekte, Geraete, Quellcode, Projektkonfiguration, Device-Zuordnung und Build-Historie. Er erstellt BuildJobs und vollstaendige BuildPackages fuer den Build-&-Deploy-Server und nimmt Firmware, Logs, BuildResults und Deploy-Ergebnisse wieder entgegen.

Fuer den projektgebundenen Entwicklungs-KI-Chat stellt er eine bedarfsgesteuerte Quellensuche bereit. Sie wird erst nach Bekanntwerden der konkreten Aufgabe ausgefuehrt, priorisiert die aktuell geoeffnete Datei und liefert standardmaessig hoechstens sechs relevante Pfad-/Inhaltstreffer. Dadurch muss die KI weder das gesamte Projekt noch eine starre Anzahl willkuerlicher Dateien erhalten. Die Architekturentscheidung ist in [`docs/ai-project-source-retrieval.md`](../../docs/ai-project-source-retrieval.md) beschrieben.

## Zweck

- Nutzerprojekte dauerhaft speichern
- Benutzer- und Geraetebezug fuer Projektarbeit verwalten
- Quellcode und Projektkonfiguration versionierbar verwalten
- KI-abgeleitete Architekturstrukturen als Projektquellen speichern
- projektgebundene IDE-/Lernansichten als View Manifest speichern
- Build-relevante Zielgeraete und Hardware-Konfigurationen referenzieren
- BuildJobs erzeugen
- vollstaendige BuildPackages als Projektsnapshot erzeugen
- Build-, Flash- und Deploy-Historie nachvollziehbar speichern
- Firmware-Artefakte und Logs dem Projektkontext zuordnen
- Step- und Projektfeedback im Learning-/Projektkontext speichern

## Abgrenzung

Der Projektserver kompiliert nicht selbst. Er bleibt fachlicher Besitzer der Projektdaten und uebergibt fuer Builds ein reproduzierbares Paket an den Build-&-Deploy-Server.

Das Admin Tool speichert Feedback nicht selbst. Es liest und bearbeitet Feedback ueber berechtigte Sichten aus dem Projektserver.

## Zusammenspiel

```text
User IDE
  -> Projektserver
      -> BuildJob
      -> BuildPackage per HTTP
          -> Build-&-Deploy-Server
      <- BuildResult, Firmware, Log, Status
  -> Device Management Server
```

## BuildPackage

```text
build-package/
 ├── build-job.json
 ├── platformio.ini
 ├── src/
 ├── include/
 ├── lib/
 ├── assets/
 └── optional precompiled files
```

Der Build-&-Deploy-Server darf niemals direkt auf dauerhafte Projektdaten zugreifen.

## ProjectViewManifest

Das Projekt kann ein `view_manifest` enthalten. Darin steht, welche IDE-/Lernansichten fuer dieses Projekt angezeigt werden, z. B. Quellcodeanalyse, Story-Slides, Artefakte, PlantUML-Quelle oder naechste Umsetzungsschritte. Die User IDE rendert diese Bloecke generisch; projektspezifisches Wissen gehoert in das Projektmanifest, nicht in den Viewer.

Das BuildPackage enthaelt das Manifest als `project-view-manifest.json`, damit nachgelagerte Prozesse denselben Projektsnapshot sehen.

## KI-abgeleitete Architekturstruktur

Eigene Entwicklungsprojekte koennen aus dem Architektur-Dialog eine Quellenstruktur erhalten:

```text
Architektur/
  statische-architektur/
  informationsfluss/
  systemverhalten/
Komponenten/
  ESP32/
    Schnittstellen/
      provided.md
      required.md
    Verhalten/
      Modell/
      Code/
    Konfiguration/
      Hardware/
        Board/
        Sensoren/
        Aktoren/
      Software/
    Daten/
    Beziehungen/
```

Jede erkannte Komponente bekommt einen eigenen Ordner. Komponenten tragen ihre Hardware- und Softwarekonfiguration, provided/required Schnittstellen, Verhalten, Daten und Beziehungen selbst. Hardwarekonfiguration umfasst Board, Sensoren und Aktoren; Softwarekonfiguration umfasst Runtime-Funktionen und Dienste wie MQTT, HTTP und Webserver. Provided und required Schnittstellen werden bewusst getrennt gespeichert, weil benoetigte Schnittstellen genauso wichtig sind wie angebotene Schnittstellen. Verhalten trennt Modell und Code, damit KI-Ableitungen spaeter gezielt geprueft und umgesetzt werden koennen.

Architektur besteht generisch aus statischer Architektur, Informationsfluss und Systemverhalten. Systemverhalten beschreibt komponentenuebergreifende Ablaeufe, Zustaende, Regeln, Ereignisse, Fehlerfaelle und Reaktionen des Gesamtsystems. Die KI kann bestaetigtes Systemverhalten spaeter in komponentenspezifisches Verhalten, Schnittstellenanforderungen, Datenfluesse, Code und Konfiguration dekomponieren.

Diese Struktur liegt als Project-Server-Quelle in SQLite und ist keine lokale Dateisystemwahrheit.

## Module

- `project-source-repository`: Projektquellen, User-Code und Projektkonfiguration
- `project-view-manifest-repository`: projektgebundene IDE-/Lernansichten
- `build-package-creator`: vollstaendige Build-Pakete aus Projekt, Basissoftware und Zielgeraet
- `project-build-history`: Build-, Flash- und Deploy-Historie
- `firmware-artifact-repository`: Firmware-Artefakte, Logs und Statusmetadaten
- `learning-feedback-repository`: Step- und Projektfeedback inklusive Anonymisierung und Kontakt-Consent-Verknuepfung

## MVP-Implementierung

Der aktuelle MVP ist ein eigenstaendiger Node.js-Prozess ohne externe Runtime-Abhaengigkeiten.

Start:

```text
npm run dev
```

Standardadresse:

```text
http://127.0.0.1:4800
```

API-Prefix:

```text
/api/projects
```

Umgesetzt sind Projektanlage, Projektquellen, ProjectViewManifest, BuildJob-Erzeugung, reproduzierbare BuildPackages, BuildResult-Rueckmeldung, Firmware-Artefaktreferenzen, Build-Historie und Learning-Feedback inklusive Kontakt-Consent und Anonymisierung.

Konfiguration:

- `HOST`: Bind-Adresse, Standard `127.0.0.1`
- `PORT`: HTTP-Port, Standard `4800`
- `PROJECT_SERVER_BASE_URL`: externe Basis-URL fuer spaetere Links
- `PERSISTENCE_BACKEND` oder `PROJECT_SERVER_PERSISTENCE_BACKEND`: `memory`, `sqlite` oder `json`, Standard `sqlite`
- `PERSISTENCE_SQLITE_PATH` oder `PROJECT_SERVER_SQLITE_PATH`: SQLite-Datei fuer `sqlite`, Standard `<Workspace>/.runtime/gernetix-services.sqlite`
- `PROJECT_SERVER_RUNTIME_DIR`: Runtime-Verzeichnis fuer JSON-Persistenz, Standard `<Workspace>/.runtime`

Accountgebundene Entwicklungsprojekte werden standardmaessig in SQLite gespeichert. `memory` ist nur fuer isolierte Tests oder bewusst fluechtige Entwicklungslaeufe gedacht. Der Browser darf sich lokal das zuletzt geoeffnete Projekt merken; die Projektdaten selbst bleiben auf dem Project Server.

## Nicht-Ziele fuer diesen Stand

- keine Datenbankmigration
- kein Build-Prozess im Projektserver
- keine echte Authentifizierung
- keine UI

## Deployment-Leitplanken

- Der Projektserver bleibt als eigenstaendiger Prozess schneidbar.
- Andere Services duerfen Projektdaten nicht direkt lesen, sondern nur ueber API/Adapter.
- Ports, Datenbankverbindungen und externe Service-URLs muessen spaeter konfigurierbar sein.
- Der erste Zielbetrieb darf ein Linux-Homeserver sein; Cloud-Migration darf keine fachlichen API-Vertraege brechen.
