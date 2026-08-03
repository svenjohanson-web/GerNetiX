# Parallele Forgejo-Arbeitsstraenge

## Zweck

Die Forgejo-Migration wird in vier gleichzeitig bearbeitbare Arbeitsstraenge
geteilt. Jeder Strang besitzt eine klare Dateigrenze, einen eigenen
Abnahmevertrag und definierte Integrationspunkte. Der produktive Cutover bleibt
ein gemeinsames Gate und wird nicht innerhalb eines Einzelstrangs ausgeloest.

## Gemeinsamer Ausgangsvertrag

Diese Schnittstellen gelten fuer alle Straenge als eingefrorene
Integrationsbasis:

- PostgreSQL fuehrt Projektidentitaet, Owner, Repository-Bindung, Status,
  Default-Branch und bestaetigten Head-SHA.
- Forgejo fuehrt nach dem Cutover Projektdateien und Git-Historie.
- Dateiaenderungen verwenden einen atomaren Mehrdatei-Commit mit
  `expected_head_sha`.
- Kanonische Projektkonfiguration liegt unter `gernetix/`.
- Browser und andere Services erhalten weder Forgejo-Token noch eine
  Forgejo-Admin-URL.
- Der SQL-Quellenpfad bleibt bis zum gemeinsamen Cutover fuehrend.
- Kein Strang deployt oder migriert Staging ohne ausdruecklichen Auftrag.

Aenderungen an diesem Vertrag werden zuerst in
`docs/forgejo-project-repository-work-packages.md` und der Project-Server-API
abgestimmt. Erst danach duerfen die Straenge davon abweichen.

## Strang A - Forgejo-Betrieb und Sicherheit

**Arbeitspakete:** FG-02, betriebliche Teile von FG-13 und FG-14.

**Ergebnis:** Ein gepinnter, interner und gesicherter Forgejo-Dienst mit
eigener Datenbank, Volume, Healthcheck und reproduzierbarem Backupvertrag.

**Primaere Dateigrenze:**

- `compose.vps.yaml`
- Forgejo-Konfigurationen und VPS-Initialisierung unter `infra/`, `config/`
  oder `tools/`
- `docs/vps-docker-deployment.md`
- `docs/security-posture.md`
- Backup-, Restore- und Monitoringtests

**Nicht in diesem Strang:** Project-Server-Fachlogik, Identity-UI,
SQL-zu-Git-Migrationslogik.

**Abnahme:** Kurzlebiger Forgejo-Container ist intern erreichbar, private
Repository-Anlage funktioniert, Neustart erhaelt Daten, Registrierung und
Actions sind deaktiviert, Datenbankrechte und Listenergrenzen sind getestet.

## Strang B - Dateischema und Repository-API

**Arbeitspakete:** FG-01, Rest von FG-03 bis FG-05, technische Teile von
FG-17 und danach FG-06.

**Ergebnis:** Vollstaendiges versioniertes Dateischema sowie Git-basierte
Lese-, Such-, Schreib-, Rename-, Delete-, Historien- und Restore-Vertraege.

**Primaere Dateigrenze:**

- `services/project-server/src/repository-store/`
- `services/project-server/src/services/project-service.js`
- `services/project-server/src/http-app.js`
- Project-Server-Repository- und API-Tests
- `services/project-server/docs/api/`
- Projektdateischema und Projektionsmatrix

**Nicht in diesem Strang:** Compose-/VPS-Betrieb, visuelles Identity-Layout,
Ausfuehrung einer Bestandsmigration.

**Abnahme:** CRUD, Unicode, leere Datei, Rename, Delete, Mehrdatei-Commit,
No-op, Head-Konflikt, Pfad-, Symlink- und Groessengrenzen sowie Restore als
neuer Commit sind automatisiert nachgewiesen.

## Strang C - Repository-Karte und IDE-Integration

**Arbeitspakete:** FG-16 sowie UI- und KI-Anteile von FG-08.

**Ergebnis:** Eine zusaetzliche Karte `Git-Repository` im Entwicklungsbereich
mit Status, Branch, Head, Dateibaum, Datei, Historie und Diff ueber den
sessiongeschuetzten Project-Server-Vertrag.

**Primaere Dateigrenze:**

- `services/identity-server/public/app/`
- Identity-Routen und Project-Server-Proxy unter
  `services/identity-server/src/`
- Identity-UI-, Autorisierungs- und Proxytests

**Nicht in diesem Strang:** Direkter Forgejo-Zugriff, Tokens im Browser,
Compose, Repository-Provisionierung oder SQL-Migration.

**Arbeitsweise:** Bis Strang B alle Leseendpunkte liefert, arbeitet die Karte
gegen einen festen Contract-Stub. Der Stub verwendet exakt die dokumentierten
Project-Server-Antworten und wird beim Integrationsgate entfernt.

**Abnahme:** Eigenes Projekt ist sichtbar, fremdes Projekt wird abgewiesen,
Tokens und interne Clone-URL fehlen in HTML und JSON, Konflikte werden
verstaendlich angezeigt.

## Strang D - Migration, Dry-run und Abgleich

**Arbeitspakete:** FG-09, Vorbereitung von FG-10 und Nachweise fuer FG-11.

**Ergebnis:** Ein wiederholbares Werkzeug, das SQL-Projekte read-only
inventarisiert, deterministisch in Repositorybaeume ueberfuehrt und vor jedem
Schreibzugriff einen vollstaendigen Dry-run-Bericht liefert.

**Primaere Dateigrenze:**

- neues Werkzeug unter `tools/`
- Migrations- und Vergleichstests
- Migrationsrunbook und Berichtsformat

**Nicht in diesem Strang:** Laufende Project-Server-Routen umschalten,
SQL-Tabellen entfernen, Staging schreiben oder Forgejo administrieren.

**Abnahme:** Wiederholter Dry-run ist bytegleich, Pfade und Hashes stimmen,
Secrets und Binaries werden korrekt klassifiziert, Konflikte und unlesbare
Altstaende blockieren den Schreiblauf.

## Spaeterer Strang E - Commitgebundener Build und Cutover

**Arbeitspakete:** FG-07, anschliessend FG-10 und FG-11.

Dieser Strang startet erst nach Integrationsgate 2. Er bindet BuildJobs an
einen existierenden Commit-SHA, baut ausschliesslich dessen Baum und entfernt
nach bestandenem Cutover die SQL-Dateiwahrheit.

## Konfliktarme Dateiverantwortung

| Gemeinsame Datei | Primaerer Strang | Regel fuer andere Straenge |
| --- | --- | --- |
| `docs/forgejo-project-repository-work-packages.md` | Koordination | nur Statusvorschlag liefern, zentral zusammenfuehren |
| `services/project-server/src/services/project-service.js` | B | C und D verwenden nur dokumentierte APIs |
| `services/project-server/src/http-app.js` | B | neue UI-Routen zuerst als API-Vertrag in B |
| `services/identity-server/src/dev-server.js` | C | B liefert Endpunkte, editiert keinen Identity-Proxy |
| `compose.vps.yaml` | A | B bis D aendern Compose nicht |
| `docs/security-posture.md` | A | andere Straenge liefern Nachweistext an A |
| SQLite-Modellgraph | Koordination | einmal je Integrationsgate aktualisieren |

Empfohlene Arbeitsbranches:

- `codex/forgejo-ops`
- `codex/forgejo-schema-api`
- `codex/forgejo-repository-ui`
- `codex/forgejo-migration-dry-run`

Die Namen sind eine organisatorische Empfehlung. In einem gemeinsam
veraenderten lokalen Worktree werden nicht mehrere Branches gleichzeitig
umgeschaltet.

## Integrationsgates

### Gate 0 - Vertrag eingefroren

- Speichergrenze, Binding-Felder, Fehlercodes und Mehrdatei-API dokumentiert.
- Strang-Stubs und Tests verwenden denselben Vertrag.

**Status:** lokal erreicht.

### Gate 1 - Adapter und Betrieb treffen sich

- Strang A stellt einen kurzlebigen Forgejo-Testdienst bereit.
- Strang B besteht unveraendert gegen diesen Dienst.
- Provisionierungs- und Runtime-Credentials sind getrennt.

### Gate 2 - Nutzerfluss und Migration sind trocken nachgewiesen

- Strang C verwendet reale Project-Server-Leseendpunkte ohne Stub.
- Strang D erzeugt fuer repräsentative Projekte einen fehlerfreien Dry-run.
- Backup und isolierter Restore des Forgejo-Teststands bestehen.

### Gate 3 - Commitgebundener Build

- BuildJob, BuildPackage und Ergebnis referenzieren denselben Commit-SHA.
- Kein versteckter SQL-Konfigurationsstand wird in den Build eingeblendet.
- Projektions- und Drift-Tests aus FG-17 bestehen.

### Gate 4 - Projektweiser Cutover

- Ein ausdruecklich gewaehltes Staging-Projekt wird migriert.
- Hash-, Baum-, Build-, UI- und Restore-Nachweis bestehen.
- Erst danach werden weitere Projekte und spaeter FG-11 freigegeben.

## Merge- und Abnahmereihenfolge

1. Strang B darf seinen schema- und API-kompatiblen Adapterkern zuerst
   integrieren; der SQL-Standard bleibt aktiv.
2. Strang A integriert den deaktivierten Forgejo-Betrieb und den
   Container-Integrationstest.
3. Strang C integriert die Karte hinter dem vorhandenen Project-Server-
   Vertrag.
4. Strang D integriert zuerst ausschliesslich Inventur und Dry-run.
5. Gate 1 und Gate 2 werden gemeinsam ausgefuehrt.
6. Erst danach beginnt Strang E. Ein produktiver oder Staging-Cutover benoetigt
   weiterhin einen ausdruecklichen Auftrag.

## Aktueller Startstand

| Strang | Startstatus | Naechste konkrete Lieferung |
| --- | --- | --- |
| A | bereit | FG-02 Container-, Datenbank- und Security-Contract |
| B | aktiv, Adapterkern vorhanden | FG-01 Schema und restliche Git-Leserouten |
| C | bereit | Repository-Karte gegen Contract-Stub |
| D | bereit | read-only SQL-Inventur und deterministischer Dry-run-Bericht |
| E | blockiert bis Gate 2 | Commit-SHA im BuildJob und BuildPackage |
