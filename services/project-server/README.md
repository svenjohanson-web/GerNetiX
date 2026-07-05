# Projektserver

Vorhaben fuer den GerNetiX Projektserver.

Der Projektserver ist die Quelle der Wahrheit fuer Benutzer, Nutzerprojekte, Geraete, Quellcode, Projektkonfiguration, Device-Zuordnung und Build-Historie. Er erstellt BuildJobs und vollstaendige BuildPackages fuer den Build-&-Deploy-Server und nimmt Firmware, Logs, BuildResults und Deploy-Ergebnisse wieder entgegen.

## Zweck

- Nutzerprojekte dauerhaft speichern
- Benutzer- und Geraetebezug fuer Projektarbeit verwalten
- Quellcode und Projektkonfiguration versionierbar verwalten
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

## Module

- `project-source-repository`: Projektquellen, User-Code und Projektkonfiguration
- `build-package-creator`: vollstaendige Build-Pakete aus Projekt, Basissoftware und Zielgeraet
- `project-build-history`: Build-, Flash- und Deploy-Historie
- `firmware-artifact-repository`: Firmware-Artefakte, Logs und Statusmetadaten
- `learning-feedback-repository`: Step- und Projektfeedback inklusive Anonymisierung und Kontakt-Consent-Verknuepfung

## Nicht-Ziele fuer diesen Stand

- keine Serverimplementierung
- keine Datenbankmigration
- kein Build-Prozess im Projektserver
- keine echte Authentifizierung
- keine UI

## Deployment-Leitplanken

- Der Projektserver bleibt als eigenstaendiger Prozess schneidbar.
- Andere Services duerfen Projektdaten nicht direkt lesen, sondern nur ueber API/Adapter.
- Ports, Datenbankverbindungen und externe Service-URLs muessen spaeter konfigurierbar sein.
- Der erste Zielbetrieb darf ein Linux-Homeserver sein; Cloud-Migration darf keine fachlichen API-Vertraege brechen.
