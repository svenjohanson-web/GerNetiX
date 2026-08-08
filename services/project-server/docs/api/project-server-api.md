# Projektserver API

MVP-Implementierungskontrakt fuer den lokalen Project Server.

Projekte ohne aktive Forgejo-Bindung verwenden bis zum kontrollierten Cutover
weiter den SQL-Altvertrag. Bei `provider: forgejo` und `state: active` kommen
Dateiliste, Datei, Suche, Schreiben, Historie, Diff und Restore ausschliesslich
aus Git. PostgreSQL fuehrt dann Bindung und bestaetigten Head; der
Quellenbestand ist nur ein nicht fuehrender Uebergangscache. Der
commitgebundene Buildvertrag ist lokal umgesetzt; der projektweise
Staging-Cutover bleibt offen. Ziel und
Migration stehen in
[`docs/forgejo-project-repository-work-packages.md`](../../../../docs/forgejo-project-repository-work-packages.md).

## Basis

- Health: `GET /health`
- Projekt-Prefix: `/api/projects`
- BuildJob-Prefix: `/api/build-jobs`

## Projekte

- `GET /api/projects?user_id=...`
- `POST /api/projects`
- `GET /api/projects/{projectId}`
- `PATCH /api/projects/{projectId}`

`POST` und `PATCH` liefern zusaetzlich `configuration_projection` mit
`changed_paths`, `unchanged_paths` und `removed_paths`. Der heutige SQL-Pfad
materialisiert damit die spaetere Git-Aenderung bereits als deterministische
Projektdateien. Bei aktiver Forgejo-Bindung enthaelt `PATCH` zusaetzlich
`repository_commit`; `expected_head_sha` ist verpflichtend und wird vor der
Aenderung gegen die gespeicherte Bindung geprueft.

Repository-Provisionierung ist bei Teilfehlern wiederaufnehmbar: Ein bereits
angelegtes leeres Repository wird initialisiert; ein bereits initialisiertes
Repository wird nur dann als derselbe Vorgang akzeptiert, wenn Head-Baum und
geforderter Initialdateisatz bytegleich sind. Ein abweichender Baum liefert
`repository_already_provisioned` und wird nie ueberschrieben.

Ein Projekt kann optional `view_manifest` enthalten. Dieses Manifest beschreibt die projektgebundenen IDE-/Lernansichten, z. B.:

- `source_analysis`
- `explanation`
- `story_slide`
- `plantuml`
- `implementation_plan`

Die User IDE rendert diese View-Typen generisch. Projektspezifische Inhalte wie Diagrammquelle, erklaerende Karten oder naechste Arbeitsschritte gehoeren in das Manifest.

### Projektanwendungen und Geraetebindung

- `GET /api/projects/{projectId}/project-app/settings?account_id={accountId}`
- `PUT /api/projects/{projectId}/project-app/settings`
- `PUT /api/projects/{projectId}/project-app/devices`

Eine Projektanwendung kann bis zu 16 eindeutige `device_ids` desselben Accounts
binden. Die Reihenfolge ist stabil; das erste Geraet ist das Primaergeraet fuer
bestehende skalare Status-, Telemetrie- und Build-Vertraege. Der Project Server
speichert nur die geordnete Bindung und die gemeinsamen
Anwendungs-Einstellungen. Besitz, aktueller Zustand und Firmware eines Geraets
bleiben beim Device Management.

Der oeffentliche Identity-Proxy ermittelt `account_id` aus der Sitzung und
prueft Besitz sowie Hardwareprofil-Kompatibilitaet, bevor er die Bindung an den
Project Server weitergibt. Ein Manifest darf dazu eine begrenzte,
rein deklarative `hardware_requirements`-Struktur mit Prozessorvariante,
unterstuetzten Hardwareprofilen sowie benoetigten Capabilities und
Board-Features definieren. Freie Matcher oder ausfuehrbare Pruefregeln sind
nicht erlaubt. Identity loest die Eigenschaften ueber den Hardware Catalog auf
und prueft sie serverseitig. Direkte Clients duerfen `account_id` deshalb nicht
als Autorisierungsnachweis behandeln. Mehrere gebundene Geraete bilden eine
gemeinsame Anwendungsinstanz; mehrere voneinander getrennte Instanzen sind ein
eigenes, spaeteres Modell.

Manifest-Views koennen zusaetzlich `source_lines`, `editable_lines`, `completion`, `validation`, `media`, `runtime_preview` und `payload.artifact` enthalten. `payload.artifact` beschreibt die linke Arbeitsflaeche einer gefuehrten Ansicht, z. B. Code-Auszug, State-Visualisierung, Zustandskreislauf oder PlantUML-Quelle. Das Manifest selbst kann mit `hide_source_editor` reine Modell-/Folienprojekte markieren, die keinen allgemeinen Codeeditor anzeigen. Damit kann die IDE einen gefuehrten Step-by-Step-Runner ausfuehren, ohne Projektdidaktik im Viewer hart zu kodieren.

## Quellen

- `GET /api/projects/{projectId}/sources`
- `GET /api/projects/{projectId}/sources?commit_sha={fullSha}`
- `GET /api/projects/{projectId}/sources/search?q={task}&current_path={path}&limit=6&commit_sha={fullSha}`
- `PUT /api/projects/{projectId}/sources`
- `GET /api/projects/{projectId}/sources/{relativePath}?commit_sha={fullSha}`
- `POST /api/projects/{projectId}/sources/rename`
- `DELETE /api/projects/{projectId}/sources/{relativePath}`

GET liest den angegebenen unveraenderlichen Commit oder den bestaetigten Head.
Listen liefern Commit, Blob, MIME, Rolle, Hash und Groesse; die Einzeldatei
liefert zusaetzlich UTF-8-Inhalt. Rename verlangt `expected_head_sha`,
`from_path` und `to_path`; Delete verlangt `expected_head_sha` im JSON-Body.

### Atomarer Repository-Vertrag

- `POST /api/projects/{projectId}/repository/commits`
- `GET /api/projects/{projectId}/repository/tree?commit_sha={fullSha}`
- `GET /api/projects/{projectId}/repository/history?commit_sha={fullSha}&limit=30`
- `GET /api/projects/{projectId}/repository/commits/{fullSha}/diff`
- `POST /api/projects/{projectId}/repository/restores`

Der POST-Endpunkt verlangt einen vollstaendigen `expected_head_sha`, eine
Commitnachricht und bis zu 100 `changes`. Jede Aenderung besitzt `path`,
optional `operation: "delete"` und bei Upserts `content`. Alle Pfade werden in
einem Git-Commit geschrieben. Ein veralteter Head liefert
`repository_head_conflict` mit HTTP 409; gleicher Inhalt liefert einen No-op
ohne neuen Commit. Einzeldateien sind auf 1 MiB, ein Textcommit auf 5 MiB
begrenzt. Absolute Pfade, `..`, `.git`, doppelte Pfade und symbolische
Linkdurchstiche werden abgewiesen.

Inhalte sind gueltiger UTF-8-Text; leere Dateien und Unicode sind erlaubt.
NUL/Binaerinhalt, ungueltiges UTF-8, Symlinks, Nicht-Blobs, mehr als 1.000
Dateien und ein Leseumfang ueber 5 MiB werden abgewiesen. MIME wird aus dem
Pfad abgeleitet. Historie liefert Commitmetadaten; Diff kennzeichnet Add,
Modify, Delete, Rename und Typwechsel. Restore verlangt `expected_head_sha`
und `restore_commit_sha`. Der Zielcommit muss Vorfahr des Heads sein. Restore
erzeugt einen neuen Commit; identischer Baum ist ein No-op.

Zentrale Fehlercodes sind `repository_head_conflict` (409),
`repository_commit_not_found` und `repository_file_not_found` (404),
`repository_restore_commit_invalid` und `repository_symlink_forbidden` (409),
`repository_binary_forbidden` und `repository_encoding_invalid` (415),
`repository_file_too_large` und `repository_read_too_large` (413) sowie
`project_schema_version_unsupported` (409).

Repository-Bindungen geben nur Provider, Status, Organisation,
Repositorykennung, Default-Branch und Head-SHA aus. Clone-URL und
Diensttokens bleiben serverintern.

Automatisch materialisierte Entwicklungs-Konfigurationen liegen unter
`gernetix/`. Der Dateivertrag steht in
[`project-file-schema.md`](project-file-schema.md), die Feldwirkung in
[`project-configuration-projection-matrix.md`](project-configuration-projection-matrix.md).
Der Project Server verwendet dafuer die Rollen
`project_configuration` und `generated_configuration_header`. Generierte
Header sind keine frei editierbare zweite Konfigurationsquelle. Volatile
Zeitstempel werden nicht projiziert; Secrets erscheinen ausschliesslich als
`<runtime-secret>`.

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

Der Project Server kompiliert nicht selbst. `build-package` liefert einen
reproduzierbaren Snapshot fuer den Build-&-Deploy-Server. Das Paket enthaelt
neben `build-job.json`, `platformio.ini` und Projektquellen auch
`project-view-manifest.json`.

Bei aktiver Forgejo-Bindung akzeptiert `POST .../build-jobs` optional einen
vollstaendigen `commit_sha`; ohne Angabe wird der bestaetigte Head verwendet.
Der Commit wird vor Einreihung im gebundenen Repository gelesen und zusammen
mit `repository_id` am BuildJob gespeichert. `build-package` liest erneut
ausschliesslich diesen Commit und liefert `repository_id`, `commit_sha` und
den deterministischen `package_sha256`. Dieser Hash beschreibt die sortierten
Build-Eingaben ohne jobbezogene Transportmetadaten aus `build-job.json` und
bleibt deshalb auch bei einem neuen BuildJob desselben Commits stabil.
BuildJob, Ergebnis und
Artefaktmetadaten tragen dieselbe Referenz. Ein abweichender Ergebnis-Commit
liefert `build_result_commit_mismatch`; eine geaenderte Repository-Bindung
liefert `build_repository_binding_changed`. Bei Forgejo-BuildJobs entstehen
keine dauerhaften `project_snapshot`- oder `source_snapshot`-Vollkopien.

Nicht migrierte Projekte verwenden weiterhin den bisherigen SQL-Snapshotpfad.

## Benannte Versionen

- `GET /api/projects/{projectId}/versions`
- `POST /api/projects/{projectId}/versions`
- `POST /api/projects/{projectId}/versions/{versionId}/restore`

Bei aktiver Forgejo-Bindung speichert eine benannte Version nur `commit_sha`
und Metadaten, niemals Quellen oder Vollsnapshots. Restore verlangt
`expected_head_sha` und erzeugt einen neuen Git-Commit. Der SQL-Snapshotvertrag
bleibt nur fuer nicht migrierte Projekte. Eine Binary-Version ist nur erlaubt,
wenn erfolgreicher Build und Version denselben Commit referenzieren.

## Projekt- und Template-Feedback

- `POST /api/learning-feedback`
- `POST /api/template-feedback`
- `GET /api/learning-feedback?project_id=...&template_id=...`
- `POST /api/learning-feedback/{feedbackId}/contact-consent`
- `POST /api/learning-feedback/anonymize-expired`

Kontaktinformationen werden ohne Feedback-spezifischen Consent nicht ausgegeben.

Fuer die Kategorien `learning_experience_rating`, `development_project_rating`
und `template_experience_rating` ist `ratings` mit vier ganzzahligen
Pflichtwerten von 1 bis 5 erforderlich: `clarity`, `fun`, `difficulty` und
`completeness`. `project_improvement_suggestion` und
`template_improvement_suggestion` verlangen stattdessen einen Freitext. Jede
Nachricht ist auf 2.000 Zeichen begrenzt. Der Identity-Proxy setzt Projekt,
Template und Account nach Sitzungs-, Besitz- beziehungsweise Katalogpruefung
serverseitig. `learning_experience_rating` ist erst bei einem als `completed`
gespeicherten Lernfortschritt erlaubt und kann pro accountgebundener
Projektinstanz nur einmal angelegt werden. Der Project Server setzt dabei die
stabile `learning_project_id`, den Projekttitel und den letzten Schritt aus
seinen eigenen Projektdaten. Der GET-Endpunkt fuehrt Projekt- und
Template-Rueckmeldungen fuer die zentrale Admin-Sicht zusammen.

## Lernfortschritt

- `GET /api/projects/{projectId}/learning-progress?user_id={userId}`
- `PUT /api/projects/{projectId}/learning-progress`

Der Project Server speichert fuer jedes accountgebundene Lernprojekt genau einen
`AccountProjectProgress`. Der Datensatz enthaelt:

- `current_lesson_id` und `current_step_id` fuer den exakten Wiedereinstieg,
- `current_step_index` fuer die bestehende lineare Darstellung,
- `completed_step_ids` und `completed_step_indexes`,
- `lesson_progress` mit eigenem Status und Schrittstand je Lesson,
- `entry_mode`, `status`, `started_at`, `last_seen_at` und `completed_at`.

Der Server leitet Lesson- und Step-Zuordnung aus den `lesson_id`- und `id`-Feldern
der Manifest-Views ab. Lesen und Schreiben erfordern dieselbe `user_id` wie das
zugehoerige Projekt; ein abweichender Account erhaelt `403 project_access_denied`.
Alte Lernprojekte ohne `lesson_id` behalten ihren globalen Schrittfortschritt.
Ein normales `PUT` fuehrt bestaetigte Step-Abschluesse weiterhin additiv zusammen.
Nur ein ausdrueckliches `reset_progress: true` darf beim vom Benutzer gewaehlten
Neustart die bisherigen Abschluesse und Lesson-Staende loeschen und den ersten
Manifest-Step als neue aktuelle Position speichern.

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
- aktuellen Lesson-/Step-Fortschritt eines accountgebundenen Lernprojekts speichern
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
