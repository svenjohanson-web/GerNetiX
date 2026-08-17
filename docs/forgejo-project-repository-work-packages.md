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
ab. Der fruehere accountgebundene Demo-/Testbestand von `Sven02` wurde nach
Freigabe geloescht. Bei der abschliessenden Staging-Inventur am 17. August 2026
wurden daneben elf noch ungebundene Entwicklungs-, Verifikations- und
historische System-Template-Staende gefunden. Sie wurden mit dem kontrollierten
Plan-/Apply-Werkzeug nichtdestruktiv in private Forgejo-Repositories migriert;
der anschliessende Plan meldete null offene Bindungen. Das deterministische
FG-09-Historienwerkzeug bleibt fuer externe Altbestaende erhalten.

Katalogdefinitionen bleiben kuenftig virtuell. Architektur-Discovery und
Konfiguration eines neuen Entwicklungsprojekts sind fluechtige
Browser-Sitzungsentwuerfe. Erst `Projekt speichern und IDE oeffnen` erzeugt
eine accountgebundene Kopie und damit ein eigenes privates Forgejo-Repository;
das Starten eines Entwurfs und das Lesen der Projektliste legen keine Projekte
an.

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
| FG-00 | Architektur- und Speichergrenze | umgesetzt und auf Staging abgeglichen | Graph- und Doku-Konsistenz |
| FG-01 | Projektdatei- und Schemakontrakt | lokal umgesetzt | Schema-/Roundtrip-Tests |
| FG-02 | Abgesicherter Forgejo-Betrieb | lokal einschliesslich Container-Restore nachgewiesen | Compose-/Security-/Restore-Contract |
| FG-03 | Forgejo- und Git-Adapter | umgesetzt, Staging-Durchstich bestanden | Adapter-Integrationstest |
| FG-04 | Repository-Provisionierung | fuer neue Projekte und Vorlagen umgesetzt | Projekt-/Template-Contract |
| FG-05 | Git-basiertes Quellen-API | umgesetzt; PostgreSQL-Produktivmodus ist Forgejo-only | CRUD-/Konflikt-/Pfadtests plus Staging-Durchstich |
| FG-06 | Echte Commit-Historie und Restore | umgesetzt; PostgreSQL-Produktivmodus ist Forgejo-only | Historien-/Restore-Tests plus Staging-Durchstich |
| FG-07 | Commitgebundener Build | fuer die ESP32-S3-Touch-Spielesammlung auf Staging nachgewiesen | Build-Reproduzierbarkeit |
| FG-08 | IDE und KI-Patchfluss | lokal umgesetzt | UI-/Agenten-Contract |
| FG-09 | SQL-zu-Git-Migrationswerkzeug | aktueller Baum auf Staging migriert; Historienimport und Ledger fuer externe Altbestaende offen | deterministischer Dry-run plus Staging-Plan/Apply |
| FG-10 | Projektweiser Cutover und Rollback | Staging-Cutover vollstaendig nachgewiesen | null offene Bindungen, alle gebundenen Repositories erreichbar |
| FG-11 | SQL-Quelltabellen stilllegen | Runtime umgesetzt; Tabellen bis Aufbewahrungsfreigabe erhalten | Negativtests und Schemaaudit |
| FG-12 | Board-Support-Repositories | auf Staging provisioniert und commitgebunden | Katalog-/Manifest-/Commit-Vertrag plus Remote-Nachweis |
| FG-13 | Backup, Restore und Upgrade | lokaler Backup-/Restore-/Verschluesselungs-/Upgradevertrag umgesetzt; externer RPO/RTO-Nachweis offen | isolierter Restore- und Upgrade-Test |
| FG-14 | Monitoring, Quoten und Betrieb | umgesetzt und auf Staging inventarisiert | Operations-Sicht und Alarme |
| FG-15 | Privater Entwickler-Clone-/Push-Zugang | umgesetzt und auf Staging nachgewiesen | Loopback-/Tunnel-, Berechtigungs-, Checkout-, Integritaets- und Push-Dry-run-Vertrag |
| FG-16 | Repository-Karte im Entwicklungsbereich | lokal umgesetzt | UI-/Autorisierungs-Contract |
| FG-17 | Schablonen erzeugen eigene Kunden-Repositories | lokal end-to-end umgesetzt | Projektionsmatrix, Mutation und Build-Contract |

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

Umgesetzt und lokal mit einem real gestarteten Container nachgewiesen sind der
gepinnte interne Forgejo-Dienst, eigene Datenbank und Rolle, persistentes
Volume, Healthcheck, deaktivierte Registrierung, Actions, SSH und
Push-to-create sowie getrennte Runtime-Secrets. Der isolierte
Backup-/Restore-Test weist Repositoryinhalt, Historie und Volume-Persistenz
ueber den Neustart hinaus nach.

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

Der Integrationstest gegen den gepinnten Forgejo-Container und der
Staging-Durchstich weisen Provisionierung, Lesen, Schreiben, Konflikt und
Archivierung nach. Die Trennung der Provisionierungs- und Runtime-Tokens ist
als Konfigurations- und Security-Vertrag getestet; eine echte Rotation ist
ein wiederkehrender Betriebsvorgang und kein offener Implementierungsschritt.

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

Systemvorlagen werden an einen exakten freigegebenen Commit gebunden und in
ein eigenes privates Kundenrepository materialisiert. Teilfehler hinterlassen
einen sichtbaren Provisionierungsstatus, Quotenfehler entfernen den noch
nicht provisionierten Projektdatensatz, und der Forgejo-End-to-End-Nachweis
ist bestanden.

Ziel:

- Jedes ausdruecklich gespeicherte neue Projekt atomar mit privatem Repository
  und Initialcommit anlegen; ungespeicherte Discovery-Entwuerfe bleiben
  ausserhalb von Project Server und Forgejo.
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
Head-Konfliktfaellen getestet. Der Staging-Durchstich vom 2026-08-09 legte aus
einer Systemschablone ein neues Sven02-Kundenprojekt mit privatem Repository
an, schrieb zwei Dateien atomar in einen Commit und wies einen veralteten Head
ohne Inhaltsverlust ab. Das Testprojekt wurde danach geloescht und sein
Repository archiviert. Der PostgreSQL-Runtime-Modus ist inzwischen
Forgejo-only; der SQL-Altpfad bleibt ausschliesslich fuer isolierte lokale
Speicherung und kontrollierte Legacy-Importe erhalten. Eine
Kunden-Bestandsmigration ist mangels Altbestand nicht erforderlich.

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
linearer Commit. Der reale Staging-Nachweis bestand mit vier linearen Commits:
Initialstand, atomarer Mehrdatei-Commit, Weiterbearbeitung und Restore aus der
benannten Version. Baum, Dateiinhalt, Diff und Historie wurden am echten
Forgejo-Repository gelesen; danach wurden Kundenprojekt und aktive Bindung
kontrolliert entfernt beziehungsweise archiviert. Im PostgreSQL-Runtime-Modus
werden keine SQL-Vollsnapshots mehr gelesen oder neu geschrieben; die
Altspalten bleiben bis zur Aufbewahrungsfreigabe nur als Legacy-Bestand
erhalten.

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

Der SQL-Altpfad ist auf isolierte lokale Entwicklung und kontrollierte
Legacy-Importe begrenzt; der PostgreSQL-Runtime-Modus akzeptiert fuer Builds
nur eine aktive Forgejo-Bindung. Der echte
Forgejo-/Compiler-Durchstich auf Staging ist fuer die ESP32-S3-Touch-
Spielesammlung bestanden: Ein kurzlebiges Kundenprojekt erhielt ein eigenes
privates Repository, das commitgebundene Build-Paket wurde durch PlatformIO
kompiliert und `firmware.bin` mit 1.254.464 Bytes sowie SHA-256
`f9018cf9ef0d3c2bb27ca5e737abe901fccefe86a9cb730c79d61a70f0b25aff`
im Artifact Store abgelegt. Das Testprojekt wurde danach entfernt.

Seit 2026-08-09 ist lokal zusaetzlich umgesetzt:

- ein harter Admission-Gate fuer neue Projekte ohne Forgejo-Store,
- getrennte, geschuetzte Systemquellen fuer ESP32-/ESP8266-Basissoftware,
  Nexi, FlashBox, die Spielesammlungen fuer ESP8266-OLED und ESP32-S3-Touch
  sowie das Kamera-Touchdisplay-Projekt in Vorlagenversion 20,
- ein idempotenter Plan-/Importablauf fuer diese sieben Repositories,
- eine nicht durch Kunden ueberschreibbare Basissoftware-Referenz auf einen
  serverseitig freigegebenen Forgejo-Commit,
- Laden der Basissoftware aus genau diesem Commit statt aus dem lokalen
  Project-Server-Arbeitsverzeichnis,
- commitgenaues Laden der Nexi-Produktquelle aus Forgejo und Materialisierung
  ihrer Dateien als bearbeitbare Ausgangskopie im privaten Kundenprojekt,
- eine serverseitig fixierte Nexi-Herkunftsreferenz, deren Organisation,
  Repository und Commit der Kunde nicht durch Request-Daten ersetzen kann,
- ein Plan-/Apply-Ablauf fuer die projektweise Migration vorhandener
  PostgreSQL-Projekte,
- eine token-geschuetzte read-only Admin-Sicht fuer Systemquellen,
  Projekt-Repositories, Builds, Commits, Paket-Hashes und Artefakt-Hashes.

Das VPS-Compose aktiviert den Gate nur mit getrennten Tokens und allen festen
System-Commit-IDs. Die eigentliche Repository-Anlage, SQL-Projektmigration und
das Deployment bleiben bewusste Betriebsaktionen und werden nicht durch einen
lokalen Code- oder Dokumentationslauf ausgeloest.

## Verbindliches Ziel fuer neue Entwicklungsprojekte

Jedes ausdruecklich gespeicherte Entwicklungsprojekt wird ausschliesslich mit
einem privaten Forgejo-Repository angelegt. Vorherige Discovery-, Komponenten-
und Hardwarearbeit bleibt ein fluechtiger Sitzungsentwurf. Der Project Server materialisiert dabei die
Projektartefakte, schreibt sie in das Repository und erzeugt den Initial-Commit.
Zu den Artefakten gehoeren mindestens Projektmanifest, Architektur- und
Hardwarekonfiguration, Software-Einheiten, generierte Builddateien, Quell-,
Header- und Testdateien sowie die Referenzen auf die verwendete Basissoftware
und das Produkttemplate.

Die Basissoftware und Produkttemplates liegen in getrennten, geschuetzten
systemverwalteten Forgejo-Repositories. Die Basissoftware bleibt ausserhalb des
schreibbaren Kunden-Repositories und wird beim Build ueber ihren festen Commit
eingebunden. Eine Produktquelle wie Nexi wird dagegen an ihrem freigegebenen
Commit gelesen und als bearbeitbare Ausgangskopie in den Initial-Commit des
privaten Kundenprojekts uebernommen. Versionierte binaere Produkt-Assets wie
PCM8-Audio, JPEG oder PNG bleiben ebenfalls in diesem geschuetzten
Produkt-Repository: Der Project Server liest sie aus genau dem fixierten Commit
und fuegt sie bytegenau nur dem kurzlebigen BuildPackage hinzu. Sie sind weder
Build-Artefakte noch Text-Quellen im Kundenrepository. Das Projekt behaelt
zusaetzlich die serverseitig fixierte Herkunftsreferenz. Kunden duerfen die
textuelle Produktkopie und ihre Projektkonfiguration bearbeiten, aber weder die
geschuetzte Basissoftware noch die vom Build verwendete Core- oder
Produkt-Herkunftsreferenz ersetzen.

Kompilierte Firmware, ELF, Map und groessere Buildlogs werden nicht in Forgejo
geschrieben. Sie liegen im Artifact Store und referenzieren den exakten
Basissoftware-, Produkt- und Projektcommit.

**Abnahme:** Ein ausdruecklich gespeichertes Entwicklungsprojekt besitzt unmittelbar eine
aktive Forgejo-Bindung, einen Initial-Commit mit allen Startartefakten und eine
commitgebundene Build-Referenz. Ein Build ohne aktive Repository-Bindung oder
mit einer manipulierten Core-Referenz wird abgewiesen.

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

Lokal umgesetzt: Der Coding Agent bindet Suche und Dateiinhalte an einen festen
Repository-Head und behaelt diesen auch ueber `previous_response_id`-Folgen bei.
Ein KI-Vorschlag wird serverseitig mit Account, Projekt, gelesenen Pfaden und
`expected_head_sha` hinterlegt. Erst die ausdrueckliche Bestaetigung schreibt
alle vorgeschlagenen Dateien atomar in einen Commit. Bei einem Head-Konflikt
bleibt der Vorschlag erhalten; die IDE meldet den Konflikt und fuehrt keinen
Teil-Commit aus. Agenten-, Routen- und UI-Contracts decken Pfadgrenzen,
Mehrdatei-Commit, Bestaetigung und Konflikt ohne Datenverlust ab.

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

FG-09 ist lokal vollstaendig umgesetzt. Der strikt read-only arbeitende
Dry-run fuer PostgreSQL und Legacy-SQLite erzeugt deterministische Baum- und
Commitkennungen sowie einen schema-validierbaren Bericht und blockiert Secrets,
unzulaessige Binaerdateien, Pfadkonflikte und mehrdeutige Historien. Der nur
nach ausdruecklichem `apply` erreichbare Schreiber uebernimmt den aktuellen
Projektbaum und jede vorhandene lineare SQL-Version als deterministische
Git-Commitkette. Er erhaelt Elternbezug, pseudonymisierten Ersteller,
Zeitstempel, Nachricht und Binary-Artefaktreferenzen, prueft jeden erzeugten
Commit gegen die vorab berechnete Kennung und schreibt erst danach den Branch.
Ein inhaltsfreies PostgreSQL-Ledger haelt ausschliesslich Quell-/Berichtshash,
Zielrepository/-commit, Zaehler, Status und Fehlercode. Wiederholungen
akzeptieren nur denselben Quellhash und denselben bereits vorhandenen
Ziel-Head; abweichende Staende werden blockiert. Fuer den aktuellen
Stagingbestand wurde am 17. August 2026 zuerst
ein Plan mit elf ungebundenen Staenden erstellt und danach jeder Stand
nichtdestruktiv migriert. Die Abschlussinventur meldete 23 gebundene,
erreichbare Projektrepositories, null ungebundene Projekte und null nicht
erreichbare Bindungen.

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
- Ein Real-Git-Contract-Test weist eine zweistufige SQL-Historie mit exakt den
  vorab berechneten Commit-IDs und beiden Dateistaenden nach.
- Das Ledger enthaelt keine Projektdateien, Snapshots, Nachrichten oder rohe
  Accountkennungen.

## FG-10 - Projektweiser Cutover und Rollback

Entscheidung vom 9. August 2026:

- Im Stagingbestand existierten keine Kundenprojekte, die erhalten und nach
  Forgejo migriert werden muessen.
- Die 51 accountgebundenen Projekte von `Sven02` waren freigegebener
  Demo-/Testbestand. Sie umfassten 1.133 SQL-Quellen, 113 Build-Jobs,
  385 Artefaktreferenzen und zwei Git-Light-Versionen, aber keine
  Projekttelemetrie, Push-Anmeldungen oder Forgejo-Bindungen.
- Dieser Bestand wurde geloescht statt migriert. Die Project-Server-Antworten
  bestaetigten dabei 51 Projekte, 1.125 zum Loeschzeitpunkt vorhandene Quellen,
  113 Projekt-Builddatensaetze, 385 Projekt-Artefaktreferenzen, vier
  Lernfortschritte und eine Projekt-App-Einstellung. System-Templates und der
  technische Build-Nachweis sind nicht Teil dieser Accountbereinigung.
- Das generische FG-09-Werkzeug bleibt im Quellstand, falls spaeter bewusst ein
  externer Altbestand importiert werden soll. Es ist kein offener Schritt fuer
  den heutigen Staging-Cutover.

Ergaenzender Abschluss vom 17. August 2026:

- Eine erneute Vollinventur fand elf technische beziehungsweise historische
  Reststaende ausserhalb des bereits geloeschten `Sven02`-Bestands.
- Der kontrollierte Plan-/Apply-Ablauf band alle elf an private
  Forgejo-Repositories. Der Wiederholungsplan meldete danach `count: 0`.
- Alle 23 Projektbindungen waren anschliessend erreichbar. Zehn schon zuvor
  vorhandene, ungebundene Forgejo-Repositories bleiben als Orphans sichtbar
  und werden gemaess FG-14 nicht automatisch geloescht.

Abnahme fuer den heutigen Bestand:

- `Sven02` besitzt nach der Bereinigung nachweislich kein
  Project-Server-Projekt mehr.
- Die Projektliste erzeugt beim Lesen keine Katalogprojekte neu.
- Ein bewusster Projektstart materialisiert weiterhin eine neue Kundenkopie.
- Loeschen eines bereits Forgejo-gebundenen Projekts archiviert zuerst dessen
  privates Repository und entfernt danach die Projektmetadaten.

## FG-11 - SQL-Quelltabellen stilllegen

Lokal umgesetzt: Aktive Forgejo-Projekte lesen und schreiben Dateien,
Historie, Restore, Versionen, Builds und Speicherverbrauch ausschliesslich am
gebundenen Commit. Der PostgreSQL-Runtime-Modus startet standardmaessig nur
noch mit Forgejo und verweigert den SQL-Quellmodus, sofern er nicht fuer einen
bewussten Legacy-Import explizit freigegeben wird. Negativtests versehen alle
SQL-Quellmethoden mit einer harten Fehlergrenze und decken Erzeugung,
Konfigurationscommit, freie Mehrdatei-Commits sowie ungebundene Laufzeitzugriffe
auf Liste, Suche, Lesen, Schreiben, Loeschen, Version, Build und Debug ab. Die
Tabellen bleiben als nicht fuehrender Legacy-/Importbestand erhalten, bis die
betriebliche Aufbewahrungsfreigabe eine destruktive Schemaaenderung erlaubt.
Neue Eintraege und Aenderungen in `project_sources` werden zusaetzlich durch
Repository-Code und PostgreSQL-Trigger abgewiesen. `project_versions` darf nur
noch Git-Light-Metadaten mit Commitreferenz speichern; neue `sources`,
`source_snapshot` oder `project_snapshot` werden ebenfalls im Code und per
Trigger blockiert. Projekt- und Buildmetadaten besitzen dieselbe rekursive
Payload-Schranke. Der alte SQLite-zu-PostgreSQL-Importer verweigert deshalb
Projektquellen und Vollsnapshots; solche Bestaende muessen direkt ueber FG-09
nach Git migriert werden. Das inhaltsfreie FG-09-Ledger bleibt als technische
Migrationsmetadaten zulaessig.

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

Umgesetzt und auf Staging nachgewiesen: `gernetix.board-support` Version 1 beschreibt Hardware-ID,
semantische Releaseversion, erlaubte Dateirollen, Quell-/Zielpfade und
SHA-256. Der ES3C28P-Katalog verweist auf die systemgefuehrte Quelle; das
Projekt friert den serverseitig freigegebenen Commit im Board-Snapshot ein.
Der Build liest exakt diesen Commit, validiert alle Hashes und materialisiert
Boarddefinition, Partitionstabelle und Header kollisionsgeschuetzt. Ein
Standard-ESP32-Board bleibt ohne eigene Supportreferenz. Das private Repository
`gernetix-platform/board-support-esp32-s3-es3c28p` wurde mit Commit
`52ac6f3f98e7c1b52d676132a61fafe8d560cb01` provisioniert; Manifest und alle
drei Nutzdateien wurden vor dem Push gegen Rollen, Zielpfade und SHA-256
validiert.

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
Zusaetzlich validiert der Verschluesselungshelfer den Sicherungssatz vor einer
Age-X25519-Verschluesselung, ueberschreibt keine Ziele und erzeugt eine externe
Pruefsumme. Der Upgrade-Helfer restauriert die gesicherte Patchversion in ein
neues isoliertes Compose-Projekt, startet erst dort die fest gepinnte
Zielversion und fuehrt `forgejo doctor check --all` aus. Offen bleiben allein
die Ausfuehrung gegen einen spaeter freigegebenen Zielrelease sowie der
externe Aufbewahrungs- und produktive RPO/RTO-Betriebsnachweis.

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

Lokal umgesetzt: Die token-geschuetzte Operations-Sicht erfasst fuer System-
und Projekt-Repositories Erreichbarkeit, Latenz, Git-/LFS-Groesse,
Objektanzahl, Build- und Artefaktbezug. Sie erkennt fehlende Bindungen,
nicht erreichbare Repositories, fehlgeschlagene Builds und verwaiste
Forgejo-Projektrepositories lesend und loescht nichts automatisch. Git-, LFS-
und Artifact-Store-Quoten sind getrennte Policy-Felder; die bisherige
`max_storage_bytes`-Eingabe bleibt als kompatibler Alias fuer Git bestehen.
Synthetische Tests decken Ausfall, Head-Konflikt, Quotenueberschreitung und
Orphan-Erkennung ab, ohne Dateiinhalt, Commitnachricht oder Nutzernamen in
technische Fehler aufzunehmen.
Erfolgreiche Backup-, Restore- und Upgrade-Helfer koennen ueber den festen
token-geschuetzten Operations-Ingest ein minimiertes Ereignis melden; das
Admin Tool zeigt daraus den jeweils letzten Nachweiszeitpunkt und nur die
Forgejo-Patchversion.

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

Umgesetzter erster Umfang:

- Forgejo bleibt ohne oeffentlichen Listener und bindet auf dem VPS nur an
  `127.0.0.1:3300`.
- `tools/connect-staging.js` transportiert diesen Port ausschliesslich durch
  den bestehenden privaten SSH-/WireGuard-Weg nach `127.0.0.1:13300`.
- Ein normales, nicht administratives Entwicklerkonto erhaelt Schreibrechte
  nur auf die freigegebenen System- und Produkt-Repositories. Alle neun
  katalogisierten Quellen existieren auf Staging. Radar-Raumpraesenz wurde als
  Produktquelle mit Commit `ba80be29e73069fce622dc4d3529e69311fcd63d`
  und ES3C28P als Board-Support-Quelle mit Commit
  `52ac6f3f98e7c1b52d676132a61fafe8d560cb01` gepusht. Das bestehende
  nichtadministrative Entwicklerkonto `sven` besitzt auf allen neun Quellen
  nachweislich genau die vorgesehene Schreibberechtigung.
- `tools/setup-forgejo-workspace.js` speichert den begrenzten Token ueber den
  konfigurierten Git-Credential-Helper und legt eigenstaendige Arbeitskopien
  ausserhalb des GerNetiX-Infrastruktur-Repositories an.
- Jedes freigegebene System- und Produkt-Repository besitzt die einheitlichen
  Einstiege `build.bat` fuer Windows und `build.sh` fuer macOS. Sie rufen keinen abweichenden Direktbau auf,
  sondern den lokalen Adapter `tools/build-forgejo-project.js`. Dieser
  materialisiert wie der Build Worker ein BuildPackage je Software-Einheit,
  verwendet dessen `BuildPackageStore` und `FirmwareBuildJobRunner`, trennt
  Kamera- und Display-Workspace und haelt alle technischen Caches unter
  `.gernetix-build/` ausserhalb der Git-Historie. Produktquellen und
  Basissoftware bleiben in getrennten Repositories und werden erst im
  technischen BuildWorkspace zusammengefuehrt.
- Jedes dieser Repositories besitzt ausserdem einen bewussten Windows-Einstieg
  `flash.bat` fuer Windows und `flash.sh` fuer macOS. Beide verlangen immer einen ausdruecklichen seriellen Anschluss und
  bei Repositories mit mehreren Boards zusaetzlich das Software-Ziel. Der
  Adapter baut zuerst dasselbe materialisierte Worker-Paket und startet den
  PlatformIO-Upload anschliessend aus genau diesem isolierten Workspace. Dieses
  lokale USB-Flashen ist kein Worker-, Deploy- oder automatischer Buildschritt.
- Tokens erscheinen weder in Clone-URLs noch in Projektdateien oder Logs.

Branches, Pull Requests, weitere Kollaborationsrollen, SSO, Spiegelung nach
GitHub/GitLab und Git LFS bleiben spaetere, getrennte Produktentscheidungen.

Die Umsetzung schafft ausdrücklich keinen oeffentlichen Endpunkt. Eine spaetere
Freigabe ausserhalb des privaten Tunnels benoetigt weiterhin eine eigene
Produkt-, Berechtigungs- und Sicherheitsentscheidung.

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

Lokal umgesetzt:

- Der Project Server erzeugt deterministische, sichtbare Dateien unter
  `gernetix/` fuer Projekt, Architektur, Software-Einheiten, Hardware,
  Boards, Basissoftware, Softwarefunktionen/Webserver, Kommunikation,
  Spielesammlung, Home-Automation, PWA-Dashboard, Ereigniskonfiguration und
  Board-Peripherie. Die aktuellen Vertraege fuer Kommunikation,
  Spielesammlung und Home-Automation verwenden `schema_version: 2`; alle
  anderen Projektdateipfade bleiben auf ihre jeweils freigegebene Version
  begrenzt.
- Boardkonfigurationen erzeugen zusaetzlich einen sichtbaren, in der IDE
  schreibgeschuetzten `gernetix_board_configuration.h` je Software-Einheit.
  Board-JSON und Header werden dabei aus demselben kanonischen
  Software-Einheiten-Snapshot erzeugt, damit der Build-Drift-Schutz keine
  voneinander abweichenden Projektionen akzeptiert.
- Wird eine zuvor rein logische IoT-Device-Schablone durch die Boardauswahl
  erstmals buildfaehig, erhaelt jede neue PlatformIO-Software-Einheit genau
  einmal eine zum Framework passende Einstiegsquelle. Bereits vorhandener
  Kundencode wird dabei nicht ueberschrieben.
- Reine Laufzeitzeitstempel verursachen keinen Inhaltsunterschied. Secrets
  erscheinen nur als `<runtime-secret>` und nicht im Projektdateiinhalt.
- Project-Server-Antworten nennen geaenderte, unveraenderte und entfernte
  Projektpfade. Die IDE laedt diese nach dem Speichern neu und meldet entweder
  die Anzahl aktualisierter Dateien oder `Keine Projektdatei geaendert`.
- Lokale Project-Server- und IDE-Contract-Tests decken Determinismus,
  Feldwirkung, No-op, Secret-Redaktion und unmittelbare Projektbaum-Aktualisierung
  ab.

Die verbindliche Dialog-zu-Datei-Matrix steht in
`docs/project-configuration-projection-matrix.md`. Mutationstests decken jede
Feldklasse ab. Der End-to-End-Test schreibt Board, Basissoftware, Peripherie,
Webserver und Kommunikation nacheinander mit Head-CAS in das aktive
Repository, prueft No-op ohne Leercommit und materialisiert anschliessend den
gepinnten Build. Ein Build-Drift-Gate rekonstruiert die Konfiguration aus dem
gebundenen Commit und bricht mit `build_configuration_drift` ab, wenn
eingecheckte erzeugte Konfigurations-, Header- oder PlatformIO-Dateien davon
abweichen.

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
