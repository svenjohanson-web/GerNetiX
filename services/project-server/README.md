# Projektserver

Vorhaben fuer den GerNetiX Projektserver.

Der Projektserver ist die fachliche Quelle der Wahrheit fuer Nutzerprojekte,
Besitz, Rechte, Repository-Bindung, projektgebundenen Lernfortschritt,
Device-Zuordnung und Build-Prozesszustand. Die beschlossene Zielarchitektur
fuehrt Quellcode, Projektkonfiguration und technische Historie als echte
Dateien und Commits in privaten Forgejo-Repositories. Bis zum kontrollierten
Cutover bleibt die heutige SQL-Quellenablage die Altimplementierung. Der
Projektserver erstellt BuildJobs und vollstaendige BuildPackages fuer den
Build-&-Deploy-Server und nimmt Firmware, Logs, BuildResults und
Deploy-Ergebnisse wieder entgegen.

Fuer den projektgebundenen Entwicklungs-KI-Chat stellt er eine bedarfsgesteuerte Quellensuche bereit. Sie wird erst nach Bekanntwerden der konkreten Aufgabe ausgefuehrt, priorisiert die aktuell geoeffnete Datei und liefert standardmaessig hoechstens sechs relevante Pfad-/Inhaltstreffer. Dadurch muss die KI weder das gesamte Projekt noch eine starre Anzahl willkuerlicher Dateien erhalten. Die Architekturentscheidung ist in [`docs/ai-project-source-retrieval.md`](../../docs/ai-project-source-retrieval.md) beschrieben.

## Zweck

- Nutzerprojekte dauerhaft speichern
- Benutzer- und Geraetebezug fuer Projektarbeit verwalten
- Quellcode und Projektkonfiguration ueber den Forgejo-Repository-Vertrag versioniert verwalten
- KI-abgeleitete Architekturstrukturen als Projektquellen speichern
- projektgebundene IDE-/Lernansichten als View Manifest speichern
- Build-relevante Zielgeraete und Hardware-Konfigurationen referenzieren
- BuildJobs erzeugen
- vollstaendige BuildPackages als Projektsnapshot erzeugen
- Build-, Flash- und Deploy-Historie nachvollziehbar speichern
- echte Git-Commits sowie benannte Versionen und Restore-Commits verwalten
- Firmware-Artefakte und Logs dem Projektkontext zuordnen
- Bewertungen und Verbesserungsvorschlaege fuer Lernprojekte, Entwicklungsprojekte und Projekt-Templates speichern
- aktuelle Lesson, aktuellen Step und abgeschlossene Steps je Lesson dauerhaft speichern

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

## Deterministische Konfigurationsprojektion

Der Project Server materialisiert bestaetigte Entwicklungs-Konfigurationen
zusaetzlich als normale Projektdateien unter `gernetix/`. Dazu gehoeren
Projekt- und Software-Einheiten, Architektur, Hardwarezuordnung,
Board-Snapshots, Basissoftware, Softwarefunktionen und Webserver,
Kommunikation, PWA-Dashboard, Ereigniskonfiguration und Board-Peripherie.
Board-Snapshots erzeugen ausserdem einen sichtbaren generierten Header im
jeweiligen Komponentenordner. Generierte Header sind in der IDE
schreibgeschuetzt.

Die Projektion ist kanonisch sortiert und laesst Laufzeitzeitstempel aus,
damit wiederholtes Speichern keinen Scheindiff erzeugt. Passwoerter, Tokens
und andere Secrets erscheinen nur als `<runtime-secret>`. Bei aktivem
Forgejo-Repository-Store werden alle betroffenen Dateien in genau einem
Git-Commit mit erwartetem Head-SHA geschrieben. Im Standardbetrieb bleibt
der SQL-Quellenpfad bis zum kontrollierten Cutover fuehrend.

## Optionaler Forgejo-Repository-Store

`PROJECT_REPOSITORY_STORE=forgejo` aktiviert den lokal implementierten
Adapter. Neue Projekte erhalten dann ein privates Organisations-Repository
und einen Initialcommit. Der Git-Adapter arbeitet ohne Shell in einem
kurzlebigen Checkout und pusht Folgeaenderungen mit `force-with-lease` gegen
den gespeicherten Head-SHA. Provisionierungs- und Git-Runtime-Token sind
getrennt und werden weder in URLs noch in Git-Argumente eingebettet.

Diese Schaltung ist noch kein produktiver Cutover: Der gepinnte und
abgesicherte Forgejo-Container, Template-Repositories, Migration sowie die
vollstaendige Umstellung aller Lese- und Buildpfade sind eigene offene
Arbeitspakete.

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
    src/
    Daten/
    Beziehungen/
```

Jede erkannte Komponente bekommt einen eigenen Ordner. Der ausfuehrbare Quellcode dieser Komponente liegt immer direkt in ihrem Unterordner `src/`; einen parallelen Projektordner `Software/` gibt es nicht. Komponenten tragen daneben ihre Hardware- und Softwarekonfiguration, provided/required Schnittstellen, Verhalten, Daten und Beziehungen selbst. Hardwarekonfiguration umfasst Board, Sensoren und Aktoren; Softwarekonfiguration umfasst Runtime-Funktionen und Dienste wie MQTT, HTTP und Webserver. Provided und required Schnittstellen werden bewusst getrennt gespeichert, weil benoetigte Schnittstellen genauso wichtig sind wie angebotene Schnittstellen. Verhalten trennt Modell und Code, damit KI-Ableitungen spaeter gezielt geprueft und umgesetzt werden koennen.

Architektur besteht generisch aus statischer Architektur, Informationsfluss und Systemverhalten. Systemverhalten beschreibt komponentenuebergreifende Ablaeufe, Zustaende, Regeln, Ereignisse, Fehlerfaelle und Reaktionen des Gesamtsystems. Die KI kann bestaetigtes Systemverhalten spaeter in komponentenspezifisches Verhalten, Schnittstellenanforderungen, Datenfluesse, Code und Konfiguration dekomponieren.

Diese Struktur liegt nach dem Cutover als normaler Dateibaum im privaten
Forgejo-Projektrepository. Die heutige PostgreSQL-Ablage ist der zu
migrierende Altpfad.

## Module

- `project-source-repository`: Projektquellen, User-Code und Projektkonfiguration
- `project-view-manifest-repository`: projektgebundene IDE-/Lernansichten
- `build-package-creator`: vollstaendige Build-Pakete aus Projekt, Basissoftware und Zielgeraet
- `project-build-history`: Build-, Flash- und Deploy-Historie
- `firmware-artifact-repository`: Firmware-Artefakte, Logs und Statusmetadaten
- `learning-feedback-repository`: Lern-/Entwicklungsprojektfeedback inklusive Anonymisierung und Kontakt-Consent-Verknuepfung
- `template-feedback-repository`: Bewertungen und Verbesserungsvorschlaege zu unveraenderlichen Projektvorlagen
- `learning-progress-repository`: account- und projektgebundener Wiedereinstieg in die letzte Lesson und den letzten Step

## MVP-Implementierung

Der aktuelle MVP ist ein eigenstaendiger Node.js-Prozess. Auf dem VPS verwendet
er den `project_*`-Bereich von `gernetix_runtime`; SQLite bleibt nur als
lokaler, isolierter Entwicklungsfallback und als read-only Migrationsquelle
erhalten. Der Forgejo-/Git-Adapter ist lokal optional implementiert, aber
noch nicht auf dem VPS aktiviert. Die Arbeitspakete stehen in
[`docs/forgejo-project-repository-work-packages.md`](../../docs/forgejo-project-repository-work-packages.md).

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

Umgesetzt sind Projektanlage, Projektquellen, deterministische
Konfigurationsprojektion, ProjectViewManifest, projektgebundener
Lesson-/Step-Fortschritt, BuildJob-Erzeugung, reproduzierbare BuildPackages,
BuildResult-Rueckmeldung, Firmware-Artefaktreferenzen, Build-Historie sowie
Bewertungen und Verbesserungsvorschlaege fuer Lernprojekte,
Entwicklungsprojekte und Projekt-Templates.

Feedback-Endpunkte:

```text
POST /api/learning-feedback   # Lern-/Entwicklungsprojekt; Kategorie unterscheidet Bewertung und Vorschlag
POST /api/template-feedback   # Katalog-Template; Kategorie unterscheidet Bewertung und Vorschlag
GET  /api/learning-feedback   # gemeinsame berechtigte Admin-Sicht
```

## SQL-Git-Light-Altimplementierung

Der heutige SQL-Pfad speichert Premium-Nutzern einen unveraenderlichen
Projektstand mit Beschreibung, Elternversion, Ersteller und
SHA-256-Inhalts-Hash. Er bleibt waehrend der Migration getestet, wird aber
nicht weiter zum eigenen Versionssystem ausgebaut. Forgejo-Commits ersetzen
Quellvollkopien und SQL-Restore nach dem Cutover.

Eine Version ohne Binary wird unmittelbar aus dem aktuellen Projektstand gespeichert. Bei „mit Binary“ erzeugt die IDE zuerst einen frischen Build. Der Project Server friert Projekt und Quellen bereits beim Erstellen des BuildPackage ein; nur ein erfolgreicher Build mit mindestens einem Artefakt darf genau diesen eingefrorenen Stand als Version referenzieren. Ein fehlgeschlagener Build erzeugt keine Projektversion. Binary-Artefakte bleiben in der Build-Artefakt-Persistenz und werden von der Version nur mit Kennung, Pruefsumme und Groesse referenziert.

Konfiguration:

- `HOST`: Bind-Adresse, Standard `127.0.0.1`
- `PORT`: HTTP-Port, Standard `4800`
- `PROJECT_SERVER_BASE_URL`: externe Basis-URL fuer spaetere Links
- `PERSISTENCE_BACKEND` oder `PROJECT_SERVER_PERSISTENCE_BACKEND`: `postgres`, `memory`, `sqlite` oder `json`; lokal Standard `sqlite`, auf dem VPS `postgres`
- `PROJECT_POSTGRES_URL`: optionale vollstaendige PostgreSQL-Verbindungs-URL
- `PROJECT_POSTGRES_HOST`, `PROJECT_POSTGRES_PORT`, `PROJECT_POSTGRES_DATABASE`, `PROJECT_POSTGRES_USER`, `PROJECT_POSTGRES_PASSWORD`: getrennte PostgreSQL-Verbindungswerte
- `PROJECT_SERVER_SQLITE_PATH` oder `PERSISTENCE_SQLITE_PATH`: SQLite-Datei fuer `sqlite`, Standard `<Workspace>/.runtime/gernetix-projects.sqlite`
- `PROJECT_SERVER_RUNTIME_DIR`: Runtime-Verzeichnis fuer JSON-Persistenz, Standard `<Workspace>/.runtime`
- `PROJECT_REPOSITORY_STORE`: `sql` (Standard) oder `forgejo`
- `FORGEJO_INTERNAL_URL`: interne HTTP-Basisadresse des Forgejo-Dienstes
- `FORGEJO_PROJECT_ORGANIZATION`, `FORGEJO_PROJECT_DEFAULT_BRANCH`: serverseitig feste Zielorganisation und Branch
- `FORGEJO_PROVISION_TOKEN`: nur fuer Repository-Lifecycle
- `FORGEJO_RUNTIME_TOKEN`: nur fuer Git-Lese-/Schreiboperationen
- `FORGEJO_TIMEOUT_MS`, `PROJECT_GIT_TIMEOUT_MS`, `GIT_BINARY`: Adapter-Zeitlimits und Git-Programm

Accountgebundene Entwicklungsprojekte werden im gemeinsamen VPS-Betrieb in `gernetix_projects` gespeichert. Der einmalige Migrationscontainer uebernimmt alte Projektdaten transaktional aus der getrennten Projekt-SQLite oder, falls diese noch leer ist, aus der frueheren gemeinsamen Service-SQLite. Entwicklungsrechner verwenden den Project Server ueber HTTP und oeffnen keine Datenbankdatei. `memory`, `sqlite` und `json` sind nur fuer isolierte Tests oder lokale Fallbacks gedacht. Der Browser darf sich lokal das zuletzt geoeffnete Projekt merken; die Projektdaten selbst bleiben auf dem Project Server.

## Ressourcenregeln

Der Project Server prueft beim Anlegen die Projektanzahl des angeforderten Plans: Free hoechstens fuenf, Premium und Premium Demo hoechstens 200 Entwicklungsprojekte. Projekt-, Speicher- und vorbereitete monatliche Traffic-Limits werden intern als Anzahl beziehungsweise Bytes gespeichert. Das Admin Tool zeigt Speicher und Traffic lesbar in MiB an. Der Wert `0` in der Admin-Oberflaeche wird als `null` gespeichert und bedeutet fuer Speicher und Traffic unbegrenzt; ein leeres Projektlimit bedeutet ebenfalls unbegrenzt. Katalog-/Demo-Seeds erhalten stets den Plan der angemeldeten Session und ein Seed-Fehler darf die persoenliche Projektliste nicht verdecken.

Eigene Entwicklungsprojekte koennen ueber die Entwicklungsplattform nach einer ausdruecklichen Bestaetigung geloescht werden. Dabei werden Projekt, Quellen, Build-Jobs, Artefaktreferenzen, Feedback und zugehoerige Consents entfernt; Identity bereinigt davor projektbezogene Telemetrie und Web-Push-Subscriptions.

## Nicht-Ziele fuer diesen Stand

- kein Build-Prozess im Projektserver
- keine echte Authentifizierung
- keine UI

## Deployment-Leitplanken

- Der Projektserver bleibt als eigenstaendiger Prozess schneidbar.
- Andere Services duerfen Projektdaten nicht direkt lesen, sondern nur ueber API/Adapter.
- Ports, Datenbankverbindungen und externe Service-URLs sind ueber Umgebungsvariablen konfigurierbar.
- Der erste Zielbetrieb darf ein Linux-Homeserver sein; Cloud-Migration darf keine fachlichen API-Vertraege brechen.
