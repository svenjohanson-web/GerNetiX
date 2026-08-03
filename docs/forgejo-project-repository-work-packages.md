# Forgejo-Projektrepositories und lesbare Projektdateien

## Ziel

GerNetiX speichert nutzerbearbeitete Projektdateien und ihre Historie nicht
dauerhaft als JSON-Dokumente in PostgreSQL. Jedes Lern- und
Entwicklungsprojekt erhaelt stattdessen ein privates Git-Repository in
Forgejo. Quellcode, Projektkonfiguration, Architekturdateien und
buildrelevante Projektsnapshots bleiben dadurch als normale Dateien lesbar,
exportierbar und mit echtem Git versioniert.

PostgreSQL bleibt die fachliche Wahrheit fuer Projektidentitaet, Besitz,
Mitgliedschaften, Berechtigungen, Tarif, Repository-Bindung, Build-Jobs,
Freigaben und Audit. Build-Binaries bleiben im getrennten Artifact Store.

Diese Zielentscheidung loest die bisherige SQL-basierte Git-Light-Architektur
ab. Die Migration ist noch nicht umgesetzt; bis zum erfolgreichen Cutover
bleiben `project_sources` und `project_versions` die laufende Altimplementierung.

## Ergebnis der Bestandsuntersuchung

Der heutige Project Server fuehrt drei ueberlappende Kopien eines
Projektstands:

1. `project_sources.raw_json` enthaelt fuer jeden Pfad den vollstaendigen
   Dateiinhalt.
2. `project_versions.raw_json` enthaelt bei jeder Git-Light-Version erneut den
   Projekt-Snapshot und alle Quellen.
3. `project_build_jobs.raw_json` enthaelt fuer einen Build erneut
   `project_snapshot` und `source_snapshot`.

Der lokale Entwicklungsbestand vom 3. August 2026 enthaelt 19 Projekte, 98
Projektquellen und vier Build-Jobs. Die geringe aktuelle Datenmenge ist kein
Grund, das Modell beizubehalten: Pfadbaum, Dateihistorie, atomare
Mehrdatei-Aenderungen, Diffs, Exporte und Integritaetspruefung werden im
Project Server bereits unvollstaendig nachgebaut.

Betroffene Hauptstellen:

- `services/project-server/src/repositories/postgres-project-repository.js`
  mit `project_sources` und `project_versions`,
- `services/project-server/src/services/project-service.js` mit
  Quellen-CRUD, Volltextsuche, SQL-Snapshots, Restore und BuildPackage,
- `services/project-server/src/http-app.js` mit `/sources` und `/versions`,
- `services/identity-server/src/dev-server.js` und
  `services/identity-server/src/dev/server/project-routes.js` als IDE-Proxy,
- `services/identity-server/src/dev/development-assistant.js` fuer
  kontrolliertes Suchen, Lesen und Bestaetigen von KI-Aenderungen,
- Build-Package-, Template-, Community- und Migrationsvertraege, die heute
  vollstaendige Quellenobjekte erwarten.

## Verbindliche Speichergrenze

Versionierung allein entscheidet nicht zwischen Git und PostgreSQL. Git ist
fuer menschenbearbeitete, dateibasierte Engineering-Artefakte zustaendig.
PostgreSQL ist fuer abfragbaren fachlichen Zustand und Beziehungen
zustaendig. Erzeugte oder grosse Binaerdateien gehoeren in den Artifact Store.

| Inhalt | Fuehrender Speicher | Begruendung |
| --- | --- | --- |
| Quellcode, Header, Tests, Skripte | Forgejo/Git | Dateien, Diffs, Commits |
| `platformio.ini` und andere Builddateien | Forgejo/Git | sichtbarer und reproduzierbarer Projektstand |
| Projektmanifest, Software-Einheiten und Buildkonfiguration | Forgejo/Git | buildrelevante Engineering-Konfiguration |
| PlantUML, Mermaid und Projektdokumentation | Forgejo/Git | menschenlesbare Projektartefakte |
| aufgeloeste projektbezogene Board- und Pin-Konfiguration | Forgejo/Git | muss mit dem gebauten Commit eingefroren sein |
| Projekt-ID, Titel, Owner, Status, Tarif | PostgreSQL | fachliche Verwaltung und Suche |
| Mitglieder, Rollen, Grants und Freigaben | PostgreSQL | Autorisierung und Audit |
| Forgejo-Repository-ID, Organisation, Default-Branch | PostgreSQL | stabile Bindung an den technischen Speicher |
| erwarteter und zuletzt bestaetigter Commit-SHA | PostgreSQL | optimistische Nebenlaeufigkeit und Betriebsabfrage |
| BuildJob, Zielgeraet, Status, Kosten und Artefaktreferenzen | PostgreSQL | fachlicher Prozesszustand |
| Firmware, ELF, HEX, Map und grosse Logs | Artifact Store | erzeugte Binaerartefakte, keine Git-Quellen |
| Telemetrie, Lernfortschritt, Bestellungen, Community und Audit | PostgreSQL | fachliche Laufzeitdaten, keine Projektdateien |

Eine abgeleitete PostgreSQL-Lesesicht darf Git-Metadaten fuer Suche oder
Monitoring indexieren. Sie ist nie eine zweite schreibbare Quelle fuer den
Dateiinhalt.

## Vorgesehene Projektstruktur

Die genaue Struktur wird in einem versionierten Schema festgelegt. Der
Zielrahmen lautet:

```text
README.md
gernetix/
  project.json
  architecture/
    project.puml
  hardware/
    allocation.json
    boards/
      <component-id>.json
  software-units/
    <software-unit-id>.json
Komponenten/
  <Komponente>/
    src/
    include/
    platformio.ini
docs/
tests/
```

`gernetix/project.json` besitzt eine `schema_version`. Buildrelevante
Aenderungen werden gemeinsam mit den betroffenen Quellen in genau einem
Commit gespeichert. Generierte Dateien muessen als solche gekennzeichnet und
deterministisch aus einer fuehrenden Datei ableitbar sein; zwei unabhaengig
schreibbare Darstellungen derselben Regel sind unzulaessig.

## Forgejo-Betriebsgrenze

Forgejo wird zunaechst als interner Infrastrukturservice betrieben:

- kein oeffentlicher Listener und keine direkte Browserroute,
- keine offene Registrierung und kein Push-to-create,
- keine Forgejo Actions in der ersten Ausbaustufe,
- private systemverwaltete Organisation fuer GerNetiX-Projekte,
- Repositoryname ausschliesslich aus serverseitiger Projekt-UUID,
- Repository-Lifecycle ueber die Forgejo-API,
- atomare Datei-Commits ueber einen isolierten Git-Checkout und Push mit
  erwartetem Head-SHA,
- getrennte Tokens fuer Provisionierung und normale Repository-Operationen,
- keine Forgejo-Administrator-Tokens in Identity, Browser oder Build-Worker.

Der bestehende PostgreSQL-17-Prozess bleibt erhalten. Forgejo erhaelt darin
die eigene Datenbank `forgejo`, einen eigenen Datenbank-Login und keine Rechte
auf `gernetix_runtime`. Seine Repositorydaten liegen im eigenen persistenten
Volume `forgejo_data`. Damit bleiben fremdverwaltete Forgejo-Tabellen aus der
GerNetiX-Domaenendatenbank heraus.

Forgejo unterstuetzt PostgreSQL sowie lokale und S3-kompatible Speicher fuer
seine Subsysteme. Die offizielle API ist versioniert und stellt eine
OpenAPI-Beschreibung bereit. Fuer Backups verlangt Forgejo einen konsistenten
Stand aus Datenbank und Repositoryspeicher; bei getrennten Speichern ist ein
kurzer kontrollierter Stopp der verlaessliche erste Betriebsvertrag.

Offizielle Referenzen:

- <https://forgejo.org/docs/latest/admin/installation/database-preparation/>
- <https://forgejo.org/docs/latest/user/api/usage/>
- <https://forgejo.org/docs/latest/user/token-scope/>
- <https://forgejo.org/docs/latest/admin/setup/storage/>
- <https://forgejo.org/docs/latest/admin/upgrade/>

## Commit- und Versionsvertrag

- Jeder erfolgreich bestaetigte Schreibvorgang erzeugt einen echten Commit.
- Eine Mehrdatei-Aenderung wird atomar in einem Commit gespeichert.
- Der Client sendet den gelesenen `expected_head_sha`; ein abweichender Head
  fuehrt zu einem Konflikt und niemals zu stillem Ueberschreiben.
- Automatische IDE-Speicherungen verwenden erkennbare System-Commit-Metadaten.
- Eine benannte Version ist ein Git-Commit mit zusaetzlicher
  PostgreSQL-Metadatenzeile fuer Name, Ersteller, Tarifpruefung und optionale
  Build-Artefaktreferenzen; sie kopiert keine Quellen.
- Wiederherstellen erzeugt einen neuen Commit, dessen Baum dem gewaehlten
  alten Commit entspricht und dessen Parent der bisherige aktuelle Head ist.
- Ctrl+Z bleibt lokaler Editorzustand und ist kein Git-Restore.
- Die technische Git-Historie existiert fuer jedes Projekt. Ein Tarif darf
  Komfortfunktionen wie benannte Versionen, erweiterte Historie,
  Zusammenarbeit oder externen Clone-Zugang steuern, aber nicht die
  Integritaet des zugrunde liegenden Repositorys abschalten.

## Buildvertrag

Ein BuildJob speichert `repository_id`, `commit_sha`, `software_unit_id` und
die aufgeloeste Zielreferenz. Der BuildPackage Creator liest ausschliesslich
diesen unveraenderlichen Commit. Er speichert keine zweite dauerhafte
Quellkopie in PostgreSQL.

Der Build-Worker erhaelt weiterhin ein vollstaendig materialisiertes,
kurzlebiges BuildPackage und keinen allgemeinen Forgejo- oder
PostgreSQL-Zugang. Das Build-Ergebnis referenziert denselben Commit-SHA.
Artefakte bleiben im Artifact Store.

## Hardware- und Boardgrenze

Der Hardware Catalog wird nicht als Ganzes nach Git verschoben.

| Board-Inhalt | Fuehrender Speicher |
| --- | --- |
| Board-ID, Hersteller, Produktname, SKU, Status | Hardware-Catalog-PostgreSQL |
| Capabilities und Beziehungen zu Sensoren oder Projekten | Hardware-Catalog-PostgreSQL |
| konkrete gekaufte Einheit, Seriennummer, Accountbesitz | Device-Management-PostgreSQL |
| unveraenderliche wiederverwendbare Account-Boardversion | Device-Management-PostgreSQL |
| projektspezifisch aufgeloeste Board-/Pin-Konfiguration | Projekt-Repository in Forgejo |
| eigene PlatformIO-Boarddefinition | systemgefuehrtes Forgejo-Repository |
| Treiber, Initialisierungscode, Partitionstabellen, Linkerskripte | systemgefuehrtes Forgejo-Repository |
| kompilierte Board-Basisfirmware | Artifact Store |

Ein einfaches, bereits vollstaendig von PlatformIO unterstuetztes ESP32-Board
benoetigt kein eigenes Supportpaket. Erst von GerNetiX gepflegte technische
Dateien bilden ein Board-Support-Release. Der Hardware Catalog referenziert
dann Repository, Commit-SHA, Pfad, Manifest-Hash und Releaseversion. Bestehende
Projekte frieren ihren aufgeloesten Boardstand im eigenen Projekt-Commit ein.

## Arbeitspaketuebersicht

| ID | Ergebnis | Status | Hauptnachweis |
| --- | --- | --- | --- |
| FG-00 | Architektur- und Speichergrenze | dokumentiert | Graph- und Doku-Konsistenz |
| FG-01 | Projektdatei- und Schemakontrakt | lokal umgesetzt | Schema-/Roundtrip-Tests |
| FG-02 | Abgesicherter Forgejo-Betrieb | lokal umgesetzt, Betriebstest offen | Compose-/Security-Contract |
| FG-03 | Forgejo- und Git-Adapter | teilweise umgesetzt | Adapter-Integrationstest |
| FG-04 | Repository-Provisionierung | teilweise umgesetzt | Projekt-/Template-Contract |
| FG-05 | Git-basiertes Quellen-API | lokal umgesetzt, Cutover offen | CRUD-/Konflikt-/Pfadtests |
| FG-06 | Echte Commit-Historie und Restore | lokal umgesetzt, Cutover offen | Historien-/Restore-Tests |
| FG-07 | Commitgebundener Build | lokal umgesetzt, Staging offen | Build-Reproduzierbarkeit |
| FG-08 | IDE und KI-Patchfluss | offen | UI-/Agenten-Contract |
| FG-09 | SQL-zu-Git-Migrationswerkzeug | Dry-run lokal umgesetzt | deterministischer Dry-run |
| FG-10 | Projektweiser Cutover und Rollback | offen | Staging-Migration |
| FG-11 | SQL-Quelltabellen stilllegen | offen | Negativtests und Schemaaudit |
| FG-12 | Board-Support-Repositories | offen | Katalog-/Commit-Vertrag |
| FG-13 | Backup, Restore und Upgrade | Backupvertrag lokal, Restore offen | isolierter Restore-Test |
| FG-14 | Monitoring, Quoten und Betrieb | Health lokal, Operations-Sicht offen | Operations-Sicht und Alarme |
| FG-15 | Externer Git-Zugang und Zusammenarbeit | spaeter | eigene Produktentscheidung |
| FG-16 | Repository-Karte im Entwicklungsbereich | lokal umgesetzt | UI-/Autorisierungs-Contract |
| FG-17 | Schablonen materialisieren Projektdateien | teilweise umgesetzt | Projektions-/Wirkungs-Contract |

## FG-00 - Architektur- und Speichergrenze

Ziel:

- SQL-Git-Light als abgeloeste Implementierung kennzeichnen.
- Forgejo als fuehrenden Speicher fuer Projektdateien und Historie festlegen.
- PostgreSQL, Git und Artifact Store ohne Doppelwahrheit trennen.
- Hardware-Catalog-Daten von technischen Board-Support-Dateien trennen.

Abnahme:

- SQLite-Graph, System-UML, Persistenzkonzept, Sicherheitsregister und dieses
  Arbeitspaketdokument stimmen ueberein.

## FG-01 - Projektdatei- und Schemakontrakt

Lokal umgesetzt sind das versionierte Dateischema, die Projektionsmatrix und
Validierungen fuer Pfad, UTF-8, Groesse, Binaerinhalt und Symlinks. Die
Project-Server-Contract-Tests decken den Roundtrip der kanonischen Dateien ab.

Ziel:

- Versioniertes Schema fuer `gernetix/project.json`, Software-Einheiten,
  Architektur, Hardwarezuordnung und Board-Projektsnapshots definieren.
- Alle heute in `project_projects.raw_json` enthaltenen buildrelevanten Felder
  eindeutig einer Git-Datei oder PostgreSQL zuordnen.
- Kanonische und generierte Dateien kennzeichnen.
- Pfad-, Groessen-, Encoding-, MIME- und Binaerregeln festlegen.

Abnahme:

- Ein komplexes Mehrzielprojekt wird aus Dateien geladen, validiert und ohne
  Informationsverlust wieder geschrieben.
- Unbekannte `schema_version`, Pfadtraversal, Symlink und unzulaessige
  Binaerdatei werden abgewiesen.

## FG-02 - Abgesicherter Forgejo-Betrieb

Lokal umgesetzt sind der gepinnte interne Forgejo-Dienst, eigene Datenbank
und Rolle, persistentes Volume, Healthcheck, deaktivierte Registrierung,
Actions, SSH und Push-to-create sowie getrennte Runtime-Secrets. Offen bleibt
der Nachweis mit einem real gestarteten Container inklusive Neustartpersistenz.

Ziel:

- Gepinntes Forgejo-LTS-Containerimage in `compose.vps.yaml` aufnehmen.
- Eigene PostgreSQL-Datenbank `forgejo`, eigenen Login und `forgejo_data`
  einrichten.
- Forgejo nur im Backend-Netz exponieren.
- Registrierung, Push-to-create, Actions und unbenoetigte Module deaktivieren.
- Secrets als Runtime-Secrets uebergeben; keine Tokens einchecken.
- Healthcheck und kontrollierte Startreihenfolge definieren.

Abnahme:

- Forgejo ist aus dem oeffentlichen Netz nicht erreichbar.
- Forgejo kann seine eigene Datenbank, aber nicht `gernetix_runtime` lesen.
- Neustart erhaelt Repository und Metadaten.

## FG-03 - Forgejo- und Git-Adapter

Lokal umgesetzt:

- gekapselter Forgejo-REST-, Git- und `ProjectRepositoryStore`-Adapter,
- getrennte Provisionierungs- und Runtime-Tokens ohne Token in Clone-URL oder
  Git-Kommandozeile,
- Git-Aufrufe ohne Shell in einem je Operation neu erzeugten Arbeitsverzeichnis,
- Zeitlimits, eindeutige Fehlercodes und Retry nur fuer sichere REST-Lesezugriffe,
- atomarer Push mit `force-with-lease` und erwartetem vollstaendigem Head-SHA,
- Pfad-, `.git`-, Groessen-, Doppelpfad- und Symlink-Schutz,
- echter lokaler Git-Integrationstest fuer Initialcommit, Mehrdatei-Commit,
  No-op und Konflikt.

Noch offen ist der Integrationstest gegen den gepinnten Forgejo-Container aus
FG-02 einschliesslich Archivierung und Tokenrotation.

Ziel:

- Project Server erhaelt einen gekapselten `ProjectRepositoryStore`.
- REST-Adapter verwaltet Organisation, Repository und Repositorymetadaten.
- Git-Adapter liest Baeume und erzeugt atomare Commits per isoliertem
  Checkout/Push.
- Provisionierungs- und Runtime-Credentials trennen und rotierbar machen.
- Timeouts, Retry nur fuer sichere Leseoperationen und eindeutige Fehlercodes
  implementieren.

Abnahme:

- Integrationstest gegen einen kurzlebigen Forgejo-Container: Repository
  anlegen, Dateien schreiben, Baum lesen, Konflikt erkennen und Repository
  sperren/archivieren.
- Keine Shell-Stringausfuehrung und keine nutzergesteuerten Repositorypfade.

## FG-04 - Repository-Provisionierung

Lokal umgesetzt ist die optionale automatische Anlage eines privaten,
nicht vorinitialisierten Organisations-Repositorys mit genau einem
Initialcommit. PostgreSQL fuehrt Provider, Repositorykennung,
Provisionierungsstatus, Default-Branch und Head-SHA als abfragbare
Projektmetadaten. Fehler werden ohne Secret als Provisionierungsstatus am
Projekt festgehalten.

Noch offen sind Template-Repositories, idempotente Wiederaufnahme aller
Teilfehlersituationen und der Forgejo-Container-End-to-End-Nachweis.

Ziel:

- Jedes neue Projekt atomar mit privatem Repository und Initialcommit anlegen.
- Systemvorlagen als unveraenderliche Template-Repositories beziehungsweise
  freigegebene Template-Commits verwalten.
- Accountprojekt aus einem exakten Template-Commit erzeugen.
- In PostgreSQL nur stabile Repository-Bindung und Commitreferenzen speichern.
- Fehler zwischen SQL-Projektanlage und Forgejo-Provisionierung ueber einen
  nachvollziehbaren Provisionierungsstatus kompensieren.

Abnahme:

- Leeres Projekt, Lernprojekt und Templatekopie besitzen jeweils exakt einen
  initialen, lesbaren Repositorybaum.
- Wiederholung nach Teilfehler erzeugt kein zweites Repository.

## FG-05 - Git-basiertes Quellen-API

Lokal umgesetzt sind ein atomarer Mehrdatei-Endpunkt mit verpflichtendem
`expected_head_sha`, Upsert und Delete im selben Commit, Konflikterkennung,
No-op-Erkennung sowie die Baumabfrage an einem festen Commit. Die bestehende
Konfigurationsprojektion schreibt bei aktiver Forgejo-Bindung ebenfalls genau
einen Git-Commit und setzt den SQL-Altstand bei einem fehlgeschlagenen Push
zurueck.

Liste, Lesen, Suche, Rename und Delete verwenden bei aktiver Forgejo-Bindung
Git und sind einschliesslich Unicode-, Leerdatei-, Binaer-, Pfad- und
Head-Konfliktfaellen getestet. Noch offen ist der kontrollierte Cutover ohne
SQL-Quellwahrheit.

Ziel:

- Bestehende IDE-Routen fuer Liste, Lesen, Suche und Schreiben auf den
  Repository-Adapter umstellen.
- Verzeichnisbaum und Dateiinhalt an einem angegebenen Commit lesen.
- Mehrdatei-Commit als bevorzugten Schreibvertrag einfuehren.
- `expected_head_sha` fuer jede Aenderung verlangen.
- Loeschen und Umbenennen als Git-Aenderungen abbilden.
- Suche zunaechst begrenzt serverseitig ueber einen Checkout oder sicheren
  Index ausfuehren; Index ist nur abgeleitete Lesesicht.

Abnahme:

- API-Contract-Tests fuer CRUD, Unicode, leere Datei, Rename, Delete,
  Mehrdatei-Atomaritaet, konkurrierende Autoren und groessenbegrenzte Inhalte.

## FG-06 - Echte Commit-Historie und Restore

Lokal umgesetzt sind echte Git-Historie und Diff-Metadaten, benannte
Versionen als Commitreferenzen ohne Quellkopie sowie Restore als neuer
linearer Commit. Offen bleiben der Container-End-to-End-Nachweis und der
spaetere Cutover der SQL-Vollsnapshots.

Ziel:

- SQL-Vollsnapshots durch Git-Commits ersetzen.
- Benannte Versionen mit Commit-SHA und optionaler Build-Artefaktbindung in
  PostgreSQL abbilden.
- Restore als neuen linearen Commit erzeugen.
- Historie, Diff und Dateiansicht aus Git liefern.
- Premium-Gate auf Produktkomfort statt auf technische Repositoryintegritaet
  anwenden.

Abnahme:

- Restore veraendert keinen alten Commit.
- Ein Commit mit Binary referenziert nur einen erfolgreichen Build desselben
  Commit-SHA.
- Keine Quelle liegt im neuen Versionsdatensatz.

## FG-07 - Commitgebundener Build

Lokal umgesetzt: Bei aktiver Forgejo-Bindung validiert der Project Server den
angeforderten Commit bereits beim Anlegen des BuildJobs und persistiert
`repository_id` und `commit_sha` als abfragbare PostgreSQL-Metadaten. Das
BuildPackage rekonstruiert Software-Einheit, Buildkonfiguration,
Board-Snapshot und Projektquellen erneut aus genau diesem Commit. Es besitzt
einen deterministischen `package_sha256`; ein spaeter veraenderter Branch-Head
veraendert das Paket nicht. Forgejo-BuildJobs speichern weder
`project_snapshot` noch `source_snapshot`. Build-Ergebnis und
Artefaktmetadaten uebernehmen Repository-, Commit- und Package-Referenz.

Der SQL-Altpfad behaelt seine Snapshots bis zum projektweisen Cutover. Offen
bleiben der Nachweis gegen den echten Forgejo-Container auf Staging und die
spaetere Stilllegung des SQL-Quellenpfads.

Ziel:

- `source_snapshot` und projektbezogene Vollquellen aus BuildJob entfernen.
- BuildJob vor Einreihung auf einen existierenden Commit-SHA festlegen.
- BuildPackage deterministisch aus diesem Commit plus freigegebenen
  systemverwalteten Support-Releases materialisieren.
- Board-Snapshot und Buildkonfiguration aus dem Repository-Commit lesen.
- Build-Ergebnis, Firmware und Symbolisierung an Commit-SHA binden.

Abnahme:

- Derselbe Commit erzeugt unabhaengig vom spaeteren Branch-Head denselben
  Package-Hash.
- Ein geloeschter, fremder oder nicht erreichbarer Commit wird vor dem Build
  eindeutig abgewiesen.

## FG-08 - IDE und KI-Patchfluss

Ziel:

- IDE fuehrt den gelesenen Head-SHA mit und zeigt Konflikte verstaendlich.
- Automatisches Speichern, manueller Commit und benannte Version sprachlich
  sauber unterscheiden.
- KI-Suche und Lesen auf Repository-Dateien am festen Commit umstellen.
- Bestaetigte KI-Vorschlaege als atomaren Patch-Commit schreiben.
- Das Modell darf weiterhin nur zuvor gelesene und freigegebene Pfade aendern.

Abnahme:

- UI- und Agenten-Contract-Tests weisen Pfadgrenzen, Bestaetigung,
  Mehrdatei-Commit und Konflikt ohne Datenverlust nach.

## FG-09 - SQL-zu-Git-Migrationswerkzeug

Lokal umgesetzt ist ein strikt read-only arbeitender Dry-run fuer PostgreSQL
und Legacy-SQLite. Er erzeugt deterministische Baum- und Commitkennungen sowie
einen schema-validierbaren Bericht und blockiert Secrets, unzulaessige
Binaerdateien, Pfadkonflikte und mehrdeutige Historien. Schreibmodus,
Migrationsledger und Cutover sind bewusst nicht enthalten.

Ziel:

- Read-only Export aus PostgreSQL und Legacy-SQLite implementieren.
- Projektmetadaten in das neue Dateischema projizieren.
- Aktuellen Quellenbaum sowie vorhandene SQL-Versionen deterministisch in
  Git-Commits umwandeln.
- Ersteller, Zeit, Nachricht, Elternbezug und Binary-Artefaktreferenz soweit
  vorhanden erhalten.
- Migrationsledger mit Quellhash, Zielcommit, Dateizahl und Status in
  PostgreSQL speichern.
- Dry-run ohne Forgejo-Schreibzugriff anbieten.

Abnahme:

- Wiederholter Dry-run erzeugt identische Baum- und Commitzuordnungen.
- Dateiinhalt, Pfadmenge, Projektmanifest und Versionsanzahl werden vor dem
  Cutover verglichen.

## FG-10 - Projektweiser Cutover und Rollback

Ziel:

- Migration pro Projekt statt als unteilbaren Gesamtwechsel ausfuehren.
- Projekt kurz in read-only setzen, letzten SQL-Stand exportieren, validieren
  und Repository-Bindung atomar aktivieren.
- Nach Cutover nur Forgejo schreiben; keine dauerhafte Dual-Write-Phase.
- SQL-Altquellen bis zum bestandenen Restore-Nachweis read-only behalten.
- Rollback darf nur zum eingefrorenen SQL-Stand erfolgen und muss spaetere
  Git-Commits sichtbar behandeln.

Abnahme:

- Staging-Migration mit leerem Projekt, Template, Mehrzielprojekt,
  Git-Light-Historie und Binary-Version.
- Geplanter Abbruch an jeder Phasengrenze ist wiederholbar und verliert keine
  bestaetigte Aenderung.

## FG-11 - SQL-Quelltabellen stilllegen

Ziel:

- Alle Laufzeitleser von `project_sources` und Quellen in
  `project_versions.raw_json` entfernen.
- Migrationspfade und Altadapter klar als read-only kennzeichnen.
- Tabellen erst nach Backup-, Restore- und Aufbewahrungsfreigabe entfernen.
- Ressourcenmessung auf Forgejo-Repositorygroesse und Artifact Store
  umstellen.

Abnahme:

- Repository- und API-Tests schlagen fehl, wenn Runtime-Code erneut
  Projektdateien in PostgreSQL schreibt.
- Datenbankinventar enthaelt keine fuehrenden Projektquellinhalte mehr.

## FG-12 - Board-Support-Repositories

Ziel:

- Systemgefuehrtes Repository fuer tatsaechlich von GerNetiX gepflegte
  Boarddefinitionen, Treiber, Partitionstabellen und Linkerskripte anlegen.
- Versioniertes Board-Support-Manifest definieren.
- Hardware Catalog referenziert freigegebenen Commit und Pfad.
- Ein Projekt friert den aufgeloesten Boardstand im eigenen Commit ein.
- Ein PlatformIO-Standardboard ohne GerNetiX-Dateien bleibt reiner
  Katalogeintrag.

Abnahme:

- Katalog-/Repository-Contract fuer ein Standard-ESP32-Board und ein komplexes
  Display-/Touch-Board.
- Spaeterer Support-Commit veraendert keinen bestehenden Projektbuild.

## FG-13 - Backup, Restore und Upgrade

Lokal umgesetzt sind der konsistente Backupvertrag fuer Forgejo-Datenbank und
`forgejo_data`, die dokumentierte Betriebsreihenfolge sowie ein automatisierter
isolierter Restore an einem realen Forgejo-Teststand. Der Restore vergleicht
Dateibaum, Inhalte, Branch, HEAD und Zwei-Commit-Historie und weist falsche
Pruefsummen sowie unvollstaendige Sicherungssaetze vor der Volume-Anlage ab.
Upgrade-, externer Verschluesselungs- und RPO/RTO-Betriebsnachweis bleiben
offen.

Ziel:

- Gemeinsamen Sicherungspunkt fuer Forgejo-Datenbank und `forgejo_data`
  definieren.
- Ersten Betriebsvertrag mit kontrolliertem Forgejo-Stopp waehrend der
  konsistenten Sicherung umsetzen.
- GerNetiX-PostgreSQL, Forgejo-PostgreSQL, Forgejo-Volume und Artifact Store
  als getrennte, gemeinsam dokumentierte Restore-Einheiten behandeln.
- Forgejo-LTS-Upgrades pinnen, vorab sichern und mit `forgejo doctor`
  nachpruefen.

Abnahme:

- Isolierter Restore stellt ein Projekt mit Historie, benannter Version und
  zugeordnetem Build-Artefakt wieder her.
- Restore-Nachweis dokumentiert RPO, RTO und verwendete Versionen.

## FG-14 - Monitoring, Quoten und Betrieb

Ziel:

- Health, API-Latenz, fehlgeschlagene Git-Operationen, Repositorygroesse,
  Objektanzahl, letzte Sicherung und letzter Restore-Test erfassen.
- Keine Dateiinhalte, Commitnachrichten oder Nutzernamen in technische Logs
  uebernehmen.
- Quoten fuer Git, LFS und Artifact Store getrennt definieren.
- Verwaiste SQL-Projekte, Forgejo-Repositories und Repository-Bindungen
  erkennen, aber nicht automatisch destruktiv bereinigen.

Abnahme:

- Operations-Sicht und Alarme mit synthetischem Ausfall, Konflikt,
  Quotenueberschreitung und verwaistem Repository.

## FG-15 - Externer Git-Zugang und Zusammenarbeit

Dieses Paket ist bewusst spaeter und nicht Voraussetzung fuer die Migration.

Moegliche Inhalte:

- direkter Clone/Push fuer Nutzer,
- GerNetiX-SSO beziehungsweise kontrollierte Forgejo-Accounts,
- SSH-Schluessel und persoenliche Tokens,
- Branches, Pull Requests und Kollaborationsrollen,
- Spiegelung oder Export nach GitHub/GitLab,
- Git LFS fuer freigegebene grosse Projektdateien.

Vor Umsetzung ist eine eigene Produkt-, Berechtigungs- und
Sicherheitsentscheidung erforderlich. Die interne Forgejo-Einfuehrung darf
nicht stillschweigend einen neuen oeffentlichen Endpunkt schaffen.

## FG-16 - Repository-Karte im Entwicklungsbereich

Lokal umgesetzt ist die session- und projektgebundene, read-only Karte mit
Status, Branch, Head, Baum, Datei, Historie und Diff. Aktive Forgejo-Projekte
verwenden die echten Project-Server-Endpunkte; nur noch nicht migrierte
Bestandsprojekte verwenden einen sichtbar gekennzeichneten Uebergangsvertrag.
Autorisierung, Secret-Grenze sowie mobile und iPad-taugliche Darstellung sind
durch Contract-Tests abgedeckt. Zusätzlich bedient ein isolierter Chromium die
produktive Karte über die echten sessiongeschützten Identity-Routen, den
Project-Server-HTTP-Vertrag und ein kurzlebiges echtes Forgejo-Repository. Der
Browsernachweis umfasst Datei, Historie, Diff, mobile Darstellung sowie die
Negativfälle für fehlende Sitzung, fremdes Projekt, Token und interne URL.

Ziel:

- Der Entwicklungsbereich erhaelt fuer das ausgewaehlte Projekt eine
  zusaetzliche Karte `Git-Repository`.
- Die Karte zeigt Repositorystatus, Default-Branch und aktuellen Commit sowie
  einen lesbaren Dateibaum, Dateiinhalt, Commit-Historie und Commit-Diffs.
- Alle Daten werden ueber den session- und projektgebundenen Project-Server-
  Vertrag geladen. Die erste Stufe verwendet weder ein Forgejo-Iframe noch
  einen an den Browser ausgegebenen Forgejo-Token.
- Nutzer sehen nur Repositories von Projekten, fuer die ihre aktuelle
  GerNetiX-Rolle mindestens Leserechte besitzt.
- Die Ansicht unterscheidet aktuellen Arbeitsstand, technische Git-Commits
  und benannte GerNetiX-Versionen verstaendlich.
- Schreiben, Clone/Push, Branches und Pull Requests bleiben ausserhalb dieses
  Pakets; direkter Git-Zugang gehoert zu FG-15.

Abnahme:

- UI-Contract fuer Karte, Lade-, Leer-, Fehler- und Konfliktzustand sowie
  mobile und iPad-taugliche Darstellung.
- Autorisierungs-Contract weist nach, dass fremde Projekt-, Repository-,
  Commit- und Dateikennungen keine Informationen offenlegen.
- Datei- und Diffansichten behandeln Binaerdateien, grosse Dateien, Unicode,
  geloeschte und umbenannte Pfade eindeutig.
- Browser, HTML und Logs enthalten keinen Forgejo-Admin- oder Runtime-Token.
- Ein aus der Karte angezeigter Commit-SHA stimmt mit demselben Baum im
  gebundenen Forgejo-Repository ueberein.

## FG-17 - Schablonen materialisieren Projektdateien

Umgesetzt im ersten Schritt:

- Der Project Server erzeugt deterministische, sichtbare Dateien unter
  `gernetix/` fuer Projekt, Architektur, Software-Einheiten, Hardware,
  Boards, Basissoftware, Softwarefunktionen/Webserver, Kommunikation,
  PWA-Dashboard, Ereigniskonfiguration und Board-Peripherie.
- Boardkonfigurationen erzeugen zusaetzlich einen sichtbaren, in der IDE
  schreibgeschuetzten `gernetix_board_configuration.h` je Software-Einheit.
- Reine Laufzeitzeitstempel verursachen keinen Inhaltsunterschied. Secrets
  erscheinen nur als `<runtime-secret>` und nicht im Projektdateiinhalt.
- Project-Server-Antworten nennen geaenderte, unveraenderte und entfernte
  Projektpfade. Die IDE laedt diese nach dem Speichern neu und meldet entweder
  die Anzahl aktualisierter Dateien oder `Keine Projektdatei geaendert`.
- Lokale Project-Server- und IDE-Contract-Tests decken Determinismus,
  Feldwirkung, No-op, Secret-Redaktion und unmittelbare Projektbaum-Aktualisierung
  ab.

Noch offen sind die vollstaendige Laufzeitwirkung jeder Feldklasse, der
Build-Drift-Abbruch und der End-to-End-Nachweis ueber alle Dialoge am echten
Repository. Der atomare Forgejo-Commit mit `expected_head_sha` ist fuer die
vorhandenen Projektionen lokal umgesetzt.

Ziel:

- Jede bestaetigte, fachlich wirksame Aenderung in einer Schablone des
  Entwicklungsbereichs erzeugt unmittelbar eine nachvollziehbare Aenderung an
  den zugehoerigen versionierten Projektdateien.
- Der Vertrag umfasst mindestens Architektur-/Projektvorlage,
  Hardware-Realisierung, Boardkonfiguration, boardexterne Anschluesse,
  Sensor-/Aktor- und Treiberkonfiguration, Board-Peripheriefunktionen,
  Basissoftware, Softwarefunktionen, Webserver, Kommunikationssetup,
  PWA-Dashboard sowie Ereignis-Worker und -Dispatcher.
- Fuer jeden Dialog wird eine verbindliche Projektionsmatrix gepflegt:
  Eingabefeld, kanonische Projektdatei, gegebenenfalls deterministisch
  erzeugte Quell-/Header-/Builddatei und nachweisbare Build- oder
  Laufzeitwirkung.
- Kanonische Konfigurationsdateien liegen unter `gernetix/` im
  Projekt-Repository. Buildrelevante Projektionen wie `platformio.ini`,
  `gernetix_board_configuration.h`,
  `gernetix_basissoftware_configuration.h`, Treiberbindungen,
  Webserver-/PWA-Konfiguration und Ereignisadapter werden im selben Vorgang
  deterministisch aktualisiert.
- Ein Speichervorgang schreibt alle betroffenen Dateien atomar in genau einen
  Git-Commit mit `expected_head_sha`. Die Antwort enthaelt Commit-SHA,
  geaenderte Pfade und eine fachliche Zusammenfassung.
- PostgreSQL-`build_config` und `view_manifest` duerfen nach dem Cutover keine
  versteckte zweite Konfigurationswahrheit bilden. Erforderliche
  Betriebsindizes werden aus dem Commit abgeleitet und bleiben reine
  Lesesichten.
- Nicht buildrelevante Darstellungsfelder muessen eine sichtbare
  Projektdatei der betreffenden Anwendung veraendern. Ein Feld ohne Datei-,
  Build- oder Laufzeitwirkung wird nicht als wirksame Einstellung angeboten.
- Ein unveraenderter Wert wird als `keine Aenderung` gemeldet und erzeugt
  keinen leeren Commit. Eine fachlich geaenderte Eingabe, deren Projektion
  identisch bleibt, wird als Projektionsfehler abgewiesen statt mit
  `Gespeichert` bestaetigt zu werden.

Abnahme:

- Vollstaendige Dialog-zu-Datei-Matrix mit mindestens einem Contract-Test pro
  Schablone und pro Feldklasse `build`, `runtime` oder `view`.
- Mutationstest: Jedes buildrelevante Feld veraendert mindestens eine
  erwartete Quell-, Header- oder Builddatei und deren Inhalts-Hash.
- Roundtrip-Test: Projektdateien laden, Schablone anzeigen und ohne Aenderung
  speichern erzeugt weder Inhaltsunterschied noch Commit.
- Determinismustest: Dieselbe Eingabe am selben Ausgangscommit erzeugt
  denselben Dateibaum; Zeitstempel und zufaellige Reihenfolgen verursachen
  keinen Scheindiff.
- Drift-Test: Der Build bricht ab, wenn eingecheckte generierte Dateien nicht
  mehr zur kanonischen Konfiguration desselben Commits passen.
- End-to-End-Test aendert nacheinander Board, Pin, Basissoftwarefunktion,
  Treiber, Webserver und Kommunikation und weist nach jedem Speichern die
  erwarteten Pfade, den Commit-Diff und die Wirkung im BuildPackage nach.

## Reihenfolge und Gates

Die operative Parallelisierung mit Dateiverantwortung, Uebergabevertraegen,
Branches und gemeinsamen Gates ist in
[Parallele Forgejo-Arbeitsstraenge](forgejo-parallel-workstreams.md)
festgelegt.

```text
Vertrag/Gate 0
  +-> A: FG-02 -> FG-13/FG-14 --------+
  +-> B: FG-01 + FG-03/04/05/17 ------+-> Gate 1/2
  +-> C: FG-16 + UI-Anteil FG-08 ------+
  +-> D: FG-09 Dry-run ----------------+
                                      +-> E: FG-07 -> FG-10 -> FG-11

FG-01 -> FG-12 kann parallel zu B weiterlaufen
FG-15 erst nach eigener Freigabe
```

Kein produktiver Cutover erfolgt, bevor FG-01 bis FG-09 automatisiert
nachgewiesen sind. Kein SQL-Altbestand wird entfernt, bevor FG-10 und FG-13
einschliesslich isoliertem Restore bestanden sind.
