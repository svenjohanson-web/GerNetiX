# Forgejo-Migrations-Dry-run

## Zweck und Grenze

Das Werkzeug `tools/forgejo-migration-dry-run.js` liefert FG-09 sowie
ausschliesslich vorbereitende Nachweise fuer FG-10 und FG-11. Es inventarisiert
den heutigen PostgreSQL- oder Legacy-SQLite-Bestand, materialisiert daraus
deterministische Repositorybaeume und plant die Git-Commits im Speicher.

Das Werkzeug:

- liest PostgreSQL in einer `REPEATABLE READ READ ONLY`-Transaktion und beendet
  diese immer mit `ROLLBACK`,
- oeffnet Legacy-SQLite ausschliesslich mit `readOnly: true`,
- verbindet sich nicht mit Forgejo,
- besitzt keinen Apply-, Migrations-, Cutover- oder Tabellenabbaumodus,
- gibt weder Dateiinhalte, Commitnachrichten noch rohe Account-IDs aus,
- schreibt nur dann eine lokale Berichtsdatei, wenn `--output` ausdruecklich
  angegeben wurde; eine vorhandene Datei oder ein gleichnamiger Symlink wird
  nicht ueberschrieben.

Bis zum spaeteren kontrollierten Cutover bleibt SQL die fuehrende Quelle. Ein
fehlerfreier Bericht autorisiert fuer sich allein keinen Schreibzugriff.

## Voraussetzungen

- Node.js 22 oder neuer, weil der SQLite-Leser `node:sqlite` verwendet.
- Die gewaehlte Quelle muss einen konsistenten Projektbestand enthalten.
- Fuer PostgreSQL werden Credentials nur ueber die Umgebung uebergeben. Sie
  duerfen weder als CLI-Argument noch im Bericht erscheinen.
- Vor einer spaeteren echten Migration sind ein frischer konsistenter
  Sicherungspunkt und ein isolierter Restore-Nachweis fuer
  `gernetix_runtime`, Artifact Store sowie den gemeinsamen Forgejo-Stand aus
  Datenbank und Repository-Volume erforderlich. Der Dry-run ersetzt dies nicht.

## Aufruf

Legacy-SQLite:

```sh
node tools/forgejo-migration-dry-run.js \
  --sqlite /read-only/path/gernetix-projects.sqlite \
  --output /private/report/forgejo-dry-run.json \
  --assert-ready
```

PostgreSQL:

```sh
PROJECT_POSTGRES_HOST=127.0.0.1 \
PROJECT_POSTGRES_PORT=5432 \
PROJECT_POSTGRES_DATABASE=gernetix_runtime \
PROJECT_POSTGRES_USER=gernetix_runtime \
PROJECT_POSTGRES_PASSWORD='<runtime-secret>' \
node tools/forgejo-migration-dry-run.js \
  --postgres \
  --output /private/report/forgejo-dry-run.json \
  --assert-ready
```

Alternativ kann `PROJECT_POSTGRES_URL` verwendet werden. Ohne `--output` geht
der kanonische JSON-Bericht an stdout. `--assert-ready` setzt Exitcode `2`,
wenn das Write-Gate blockiert ist. Ein technischer CLI-Fehler verwendet
Exitcode `1`. Ohne `--assert-ready` wird auch ein blockierter, aber vollstaendig
erzeugter Bericht mit Exitcode `0` ausgegeben, damit er untersucht werden kann.

## Determinismusnachweis

Zwei Laeufe gegen denselben transaktionskonsistenten Quellstand muessen
bytegleich sein. Der Bericht enthaelt deshalb keinen Erstellungszeitpunkt,
Hostnamen, absoluten Quellpfad oder Laufzeitmesswert. Die beiden Dateien werden
byteweise verglichen und jeweils mit SHA-256 protokolliert. Unterschiedliche
`source_fingerprint_sha256` bedeuten, dass nicht derselbe Quellstand verglichen
wurde.

Die geplanten Git-Objekt-IDs werden ohne lokales Repository berechnet:

- Blob-OID aus dem exakten UTF-8-Inhalt,
- Tree-OID aus kanonischen Git-Tree-Eintraegen und Pfadbytes,
- Commit-OID aus Tree, Elterncommit, pseudonymisiertem Ersteller,
  Quellzeitpunkt und Quellnachricht.

Rohe Ersteller-ID und Commitnachricht werden nur gehasht in den Bericht
aufgenommen. Ein fehlender Zeitstempel wird fuer die reine Planbarkeit auf die
Unix-Epoche gesetzt und als Warnung ausgewiesen.

## Projektions- und Vergleichsvertrag

Fuer den aktuellen Stand und jede SQL-Version werden folgende Schritte
ausgefuehrt:

1. Pfade validieren und ohne stille Umschreibung nach NFC normalisieren.
2. Den gespeicherten `content_sha256` gegen den exakten Inhalt pruefen.
3. Text, Secret, Binary oder uebergrosse Datei klassifizieren.
4. Die kanonischen Projektdateien mit derselben
   `projectConfigurationSources`-Projektion wie der Project Server erzeugen.
5. Auch die Projektion erneut auf nicht redigierte Secrets pruefen.
6. SQL-Dateien und Projektion zusammenfuehren. Abweichende Inhalte am selben
   Pfad sind ein Konflikt, keine Last-write-wins-Situation.
7. Pfadmenge, Inhalts-Hashes, `gernetix/project.json`, Versionsanzahl,
   Git-Tree und geplante Commits vergleichen.

Textquellen bleiben pfad- und bytegleich. Neue kanonische Projektionsdateien
werden als `origin=project_projection` kenntlich gemacht. Secret-Dateien werden
als `runtime_secret_required`, Binaries als `artifact_store_required` und
uebergrosse Dateien als `manual_resolution_required` klassifiziert. Keine
dieser Klassen wird still in den geplanten Repositorybaum uebernommen.

Eine SQL-Version mit `includes_binary=true` muss mindestens eine
Artifact-Store-Referenz mit technischer Artefakt-ID, positiver Groesse und
SHA-256 besitzen. Der Dateiname wird im Bericht nur gehasht.

## Blockierende Befunde

Das Write-Gate bleibt insbesondere bei folgenden Befunden geschlossen:

- unlesbare SQLite-Datei, fehlende Tabellen oder unlesbares Legacy-JSON,
- verwaiste Quellen/Versionen oder doppelte Projekt-/Versions-IDs,
- fehlende, zyklische oder mehrdeutige Versionseltern,
- ungueltige, umschreibungsbeduerftige, kollidierende oder Datei/Ordner-
  kollidierende Pfade,
- abweichende gespeicherte Quell- oder Versions-Hashes,
- unterschiedliche SQL- und Projektionsinhalte am selben Zielpfad,
- Secret-, Binary- oder Groessenklassifikation ohne vorherige Aufloesung,
- Binary-Version ohne vollstaendige Artifact-Store-Referenz.

Ein blockierter Befund wird am Quellbestand geklaert oder durch eine
ausdruecklich freigegebene, separat getestete Migrationsregel behandelt. Der
Dry-run schreibt keine automatische Reparatur und verwirft keine Datei.

## Berichtsformat

Der Bericht ist kanonisches einzeiliges UTF-8-JSON mit abschliessendem Newline.
Objektschluessel sind lexikografisch sortiert; fachlich geordnete Arrays
behalten ihre definierte Reihenfolge. Das versionierte JSON-Schema liegt unter
[`docs/forgejo-migration-dry-run-report.schema.json`](forgejo-migration-dry-run-report.schema.json).

Wichtige Felder:

| Feld | Bedeutung |
| --- | --- |
| `schema_version` | Fest `gernetix.forgejo-migration-dry-run/v1` |
| `source_fingerprint_sha256` | Hash des vollstaendigen gelesenen SQL-Inventars ohne Ausgabe seines Inhalts |
| `summary.status` | `ready` oder `blocked` |
| `write_gate.allowed` | Nur bei null Fehlern `true`; keine Schreibautorisierung durch dieses Werkzeug |
| `projects[].current.tree_oid` | Geplante echte Git-Tree-OID des aktuellen Stands |
| `projects[].current.source_comparison` | Pfad- und Inhaltsgleichheit aller repositoryfaehigen SQL-Quellen |
| `projects[].current.project_manifest` | Anwesenheit und Hash von `gernetix/project.json` |
| `projects[].version_comparison` | SQL-Versionszahl gegen geplante Versionscommits |
| `projects[].commits[]` | Deterministische Zuordnung von SQL-Version beziehungsweise aktuellem Stand zu Tree und Commit |
| `projects[].ledger_preview` | Vorschau fuer spaeteren Quellhash-/Zielcommit-/Dateizahl-/Status-Ledgereintrag |
| `issues[]` | Sortierte Fehler und Warnungen ohne Projektinhalt oder Secret |

Der SHA-256 der exakten Berichtsdatei wird ausserhalb des Berichtes erfasst,
damit keine selbstreferenzielle Pruefsumme entsteht.

## Vorbereitung FG-10: projektweiser Cutover

Dieses Arbeitspaket implementiert keinen Cutover. Ein spaeterer Schreiber muss
mindestens folgende Vorbedingungen erzwingen:

1. Projekt explizit auswaehlen und fuer Aenderungen sperren.
2. Frischen read-only Export erzeugen und dessen
   `source_fingerprint_sha256` gegen den freigegebenen Bericht pruefen.
3. Exakte Berichtsdatei und deren externen SHA-256 bestaetigen.
4. `write_gate.allowed=true`, fehlerfreie Baum-/Inhalts-/Manifest- und
   Versionsvergleiche sowie vollstaendige Artifact-Store-Referenzen verlangen.
5. Leeres Zielrepository oder den ausdruecklich erwarteten Head pruefen; ein
   unerwarteter Head ist ein Konflikt und darf nie ueberschrieben werden.
6. Geplante Commits projektweise schreiben und jede resultierende Tree- und
   Commit-OID erneut vergleichen.
7. Erst danach Repository-Bindung und Migrationsledger atomar aktivieren.

Der spaetere Ledger speichert mindestens Projekt-ID, Quellhash,
Berichts-SHA-256, Zielcommit, Dateizahl, Status und kontrollierten Zeitpunkt.
Wiederholung mit identischem Quellhash/Zielcommit ist idempotent; jede andere
Kombination blockiert. Ein Abbruch vor der atomaren Bindungsaktivierung laesst
SQL fuehrend. Ein Rollback darf nur zum eingefrorenen SQL-Stand erfolgen und
muss spaetere Git-Commits sichtbar behandeln.

## Vorbereitung FG-11: SQL-Quelltabellen stilllegen

Dieses Arbeitspaket entfernt und veraendert keine Tabelle und keine
Project-Server-Route. Es liefert nur folgende Vorbedingungen fuer FG-11:

- der Leser greift auf `project_projects`, `project_sources` und
  `project_versions` ausschliesslich mit `SELECT` zu,
- Tests weisen das Ausbleiben von `INSERT`, `UPDATE`, `DELETE`, DDL und eines
  Apply-Arguments nach,
- Berichte zaehlen verbleibende SQL-Quellen und Versionen und vergleichen sie
  mit den geplanten Repositorydateien und Commits,
- Altadapter und Tabellen bleiben bis nach FG-10, Backupfreigabe und isoliertem
  Restore read-only erhalten.

Vor einem spaeteren Tabellenabbau muessen separate Runtime-Negativtests alle
Project-Server-Leser und -Schreiber auf Forgejo nachweisen. Zusaetzlich sind
Schemaaudit, Ressourcenmessung ueber Repository/Artifact Store, Retention und
Restorefreigabe erforderlich. Diese Schritte gehoeren nicht zu Strang D.

## Lokaler Nachweis

```sh
node --test tools/forgejo-migration-dry-run.test.js
```

Die Tests verwenden nur temporaere SQLite-Dateien und einen in-memory
PostgreSQL-Pool-Stub. Sie starten keinen Dienst, greifen nicht auf Forgejo zu
und veraendern keine dauerhafte SQL-Persistenz.
