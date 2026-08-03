# Versioniertes GerNetiX-Projektdateischema

Das Schema beschreibt den commitgebundenen Projektstand in Git. PostgreSQL
speichert Identitaet, Owner, Rechte, Repository-Bindung und Head, aber keine
zweite schreibbare Projektdateiwahrheit.

```text
README.md
gernetix/
  project.json
  architecture/project.puml
  hardware/allocation.json
  hardware/boards/<component-id>.json
  software-units/<software-unit-id>.json
  configuration/<fachliche-konfiguration>.json
Komponenten/<Komponente>/{src,include,platformio.ini}
docs/
tests/
```

`gernetix/project.json` ist verpflichtend und besitzt `schema_id:
"gernetix.project"` und `schema_version: 1`. Jede JSON-Datei unter `gernetix/`
besitzt eine bekannte Version. Der Server kennt Dateischema 1;
`communication.json` akzeptiert auch den bestehenden Kommunikationsvertrag 2.
Unbekannte Versionen liefern `project_schema_version_unsupported`.
Software-Einheiten haben eindeutige IDs; `active_software_unit_id` muss auf
eine Datei unter `software-units/` zeigen. Hardware-Allocation trennt
Datei-`schema_version` und grafische `model_schema_version`.

Kanonisch sind JSON und Architektur unter `gernetix/`, Nutzerquellen,
Dokumentation und Tests. `platformio.ini` und explizit als
`generated_configuration_header` markierte Header sind deterministisch
generiert und werden im selben Commit aktualisiert. Zeitstempel werden nicht
projiziert; Secrets erscheinen als `<runtime-secret>`.

Sicherheitsgrenzen:

- relativer UTF-8-Pfad, `/`, maximal 512 Byte; keine leeren, `.`, `..`- oder
  `.git`-Segmente;
- gueltiger UTF-8-Text, leere Datei und Unicode erlaubt; NUL/Binaer verboten;
- maximal 1 MiB pro Datei, 5 MiB pro Commit/Lesevorgang, 100 Aenderungen pro
  Commit und 1.000 Dateien pro Baum;
- nur regulaere Git-Blobs, keine Symlinks;
- MIME wird serverseitig aus dem Pfad abgeleitet; Binaries gehoeren in den
  Artifact Store.

`loadProjectFileSet` validiert Pfade, Inhalt, Versionen und Referenzen.
`writeProjectFileSet` schreibt den sortierten Dateisatz bytegleich zurueck.
Der Test nutzt ein Mehrzielprojekt mit Architektur, Hardware, zwei
Software-Einheiten, Unicode und leerer Datei.

## Projektion aus `project_projects.raw_json`

| bisheriges Feld | Fuehrende Zielablage | Projektdatei / Bemerkung |
| --- | --- | --- |
| `project_id` | PostgreSQL | unveraenderliche Integritaetsreferenz auch in `gernetix/project.json` |
| `user_id`, `plan_id` | PostgreSQL | Besitz und Tarif, nie Projektdatei |
| `title`, `description` | PostgreSQL | Verwaltungswert; lesbarer Commit-Spiegel in `gernetix/project.json` |
| `learning_project_id` | PostgreSQL | fachliche Beziehung, kein Buildwert |
| `hardware_profile_id` | Git | `gernetix/project.json` und je Ziel in `software-units/*.json`; SQL nur Lesesicht |
| `device_id` | PostgreSQL | konkrete Account-/Device-Zuordnung, nicht versionierte Engineering-Datei |
| `build_config` | Git | Zielparameter in `software-units/*.json`, Fachkonfigurationen unter `gernetix/configuration/`, `platformio.ini` generiert |
| `software_units` | Git | eine Datei je Einheit unter `gernetix/software-units/` |
| `active_software_unit_id` | Git | `gernetix/project.json`; SQL darf bis Cutover Lesesicht bleiben |
| `view_manifest` Architektur/Hardware/Kommunikation/PWA/Ereignisse | Git | jeweilige Architektur-, Hardware- oder Konfigurationsdatei |
| `view_manifest` Lernfortschritt, Berechtigung und reine Laufzeitnavigation | PostgreSQL | fachlicher Nutzerzustand, keine Buildquelle |
| `status` | PostgreSQL | Projekt-/Template-Lifecycle |
| `created_at`, `updated_at` | PostgreSQL | volatile Verwaltungsmetadaten, nicht projiziert |
| `repository_binding` | PostgreSQL | Provider, Organisation, Repository-ID, Branch, Head und Status; keine Clone-URL nach aussen |

Ein SQL-Feld, das nach Cutover noch Git-Inhalt spiegelt, ist ausschliesslich
eine abgeleitete Lesesicht. Schreibbare Doppelwahrheit ist unzulaessig.
