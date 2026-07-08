# Projektserver

Vorhaben fuer den GerNetiX Projektserver.

Der Projektserver ist die Quelle der Wahrheit fuer Benutzer, Nutzerprojekte, Geraete, Quellcode, Projektkonfiguration, Device-Zuordnung und Build-Historie. Er erstellt BuildJobs und vollstaendige BuildPackages fuer den Build-&-Deploy-Server und nimmt Firmware, Logs, BuildResults und Deploy-Ergebnisse wieder entgegen.

## Zweck

- Nutzerprojekte dauerhaft speichern
- Benutzer- und Geraetebezug fuer Projektarbeit verwalten
- Quellcode und Projektkonfiguration versionierbar verwalten
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

Das Projekt kann ein `view_manifest` enthalten. Darin steht, welche IDE-/Lernansichten fuer dieses Projekt angezeigt werden, z. B. Quellcodeanalyse, Erklaerungskarten, PlantUML-Quelle oder naechste Umsetzungsschritte. Die User IDE rendert diese Bloecke generisch; projektspezifisches Wissen gehoert in das Projektmanifest, nicht in den Viewer.

Das BuildPackage enthaelt das Manifest als `project-view-manifest.json`, damit nachgelagerte Prozesse denselben Projektsnapshot sehen.

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
- `PERSISTENCE_BACKEND` oder `PROJECT_SERVER_PERSISTENCE_BACKEND`: `memory`, `sqlite` oder `json`, Standard `memory`
- `PERSISTENCE_SQLITE_PATH` oder `PROJECT_SERVER_SQLITE_PATH`: SQLite-Datei fuer `sqlite`, Standard `.runtime/gernetix-services.sqlite`
- `PROJECT_SERVER_RUNTIME_DIR`: Runtime-Verzeichnis fuer JSON-Persistenz, Standard `.runtime`

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
