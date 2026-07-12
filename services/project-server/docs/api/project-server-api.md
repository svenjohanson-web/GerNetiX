# Projektserver API

MVP-Implementierungskontrakt fuer den lokalen Project Server.

## Basis

- Health: `GET /health`
- Projekt-Prefix: `/api/projects`
- BuildJob-Prefix: `/api/build-jobs`

## Projekte

- `GET /api/projects?user_id=...`
- `POST /api/projects`
- `GET /api/projects/{projectId}`
- `PATCH /api/projects/{projectId}`

Ein Projekt kann optional `view_manifest` enthalten. Dieses Manifest beschreibt die projektgebundenen IDE-/Lernansichten, z. B.:

- `source_analysis`
- `explanation`
- `story_slide`
- `plantuml`
- `implementation_plan`

Die User IDE rendert diese View-Typen generisch. Projektspezifische Inhalte wie Diagrammquelle, erklaerende Karten oder naechste Arbeitsschritte gehoeren in das Manifest.

Manifest-Views koennen zusaetzlich `source_lines`, `editable_lines`, `completion`, `validation`, `media`, `runtime_preview` und `payload.artifact` enthalten. `payload.artifact` beschreibt die linke Arbeitsflaeche einer gefuehrten Ansicht, z. B. Code-Auszug, State-Visualisierung, Zustandskreislauf oder PlantUML-Quelle. Das Manifest selbst kann mit `hide_source_editor` reine Modell-/Folienprojekte markieren, die keinen allgemeinen Codeeditor anzeigen. Damit kann die IDE einen gefuehrten Step-by-Step-Runner ausfuehren, ohne Projektdidaktik im Viewer hart zu kodieren.

## Quellen

- `GET /api/projects/{projectId}/sources`
- `GET /api/projects/{projectId}/sources/search?q={task}&current_path={path}&limit=6` (bedarfsgesteuerte Quellensuche; liefert Inhalte nur fuer die relevantesten Treffer)
- `PUT /api/projects/{projectId}/sources`
- `GET /api/projects/{projectId}/sources/{relativePath}`

Quellpfade muessen relativ sein und duerfen keine `..`-Segmente enthalten.

KI-abgeleitete Entwicklungsprojekte koennen Architekturquellen unter `Architektur/statische-architektur/`, `Architektur/informationsfluss/` und `Architektur/systemverhalten/` speichern. `Systemverhalten` beschreibt komponentenuebergreifende Ablaeufe, Zustaende, Regeln, Ereignisse, Fehlerfaelle und Reaktionen, die spaeter in Komponentenverhalten dekomponiert werden koennen.

Jede Komponente kann `Schnittstellen/`, `Verhalten/`, `Konfiguration/`, `Daten/` und `Beziehungen/` besitzen. Jede Komponente soll `Schnittstellen/provided.md` und `Schnittstellen/required.md` besitzen, damit bereitgestellte und benoetigte Schnittstellen gleichwertig im Projektmodell sichtbar sind. `Verhalten/Modell` und `Verhalten/Code` beschreiben Wirkung und Umsetzung. `Konfiguration/Software` nimmt Runtime- und Dienstekonfiguration auf; Device-Komponenten trennen darunter `Konfiguration/Hardware/Board`, `Konfiguration/Hardware/Sensoren` und `Konfiguration/Hardware/Aktoren`. Einen separaten Ordner `Eigenschaften` gibt es nicht.

SQL/SQLite wird nicht als eigener Komponentenordner modelliert. Es ist eine Softwareeigenschaft der fachlich verantwortlichen Server-Komponente und wird in deren `Konfiguration/Software` dokumentiert. Ohne Server-Komponente kann im Projektmodell keine SQL-/SQLite-Persistenz entstehen.

## Build-Historie und BuildPackages

- `POST /api/projects/{projectId}/build-jobs`
- `GET /api/projects/{projectId}/build-jobs`
- `GET /api/build-jobs`
- `GET /api/build-jobs/{buildJobId}`
- `GET /api/build-jobs/{buildJobId}/build-package`
- `POST /api/build-jobs/{buildJobId}/submitted`
- `POST /api/build-jobs/{buildJobId}/result`
- `GET /api/firmware-artifacts?project_id=...`

Der Project Server kompiliert nicht selbst. `build-package` liefert einen reproduzierbaren Snapshot fuer den Build-&-Deploy-Server. Das Paket enthaelt neben `build-job.json`, `platformio.ini` und Projektquellen auch `project-view-manifest.json`.

## Learning Feedback

- `POST /api/learning-feedback`
- `GET /api/learning-feedback?project_id=...`
- `POST /api/learning-feedback/{feedbackId}/contact-consent`
- `POST /api/learning-feedback/anonymize-expired`

Kontaktinformationen werden ohne Feedback-spezifischen Consent nicht ausgegeben.

## Verantwortliche Schnittstellen

- Projekt anlegen, lesen und aktualisieren
- Projektquellen und User-Code verwalten
- ProjectViewManifest verwalten
- Hardware-Konfigurationen verwalten
- Build-Paket erstellen
- Build- und Deploy-Status empfangen
- Firmware-Artefakte und Logs referenzieren
- Build-Historie fuer Projekt und Nutzer anzeigen
- Step- und Projektfeedback annehmen
- Kontaktmodus fuer Feedback erfassen
- Kontakt-Consent fuer Rueckfragen zu genau einem Feedback verwalten
- Feedback nach Ablauf von maximal zwei Monaten anonymisieren

## Nicht in dieser API

- Device-Pairing
- Echtheitsnachweis
- OTA-Zielauswahl aus Account-Devices
- Build-Ausfuehrung
- Firmware-Deployment auf das Device
- dauerhafte Speicherung von Admin-Sichten
