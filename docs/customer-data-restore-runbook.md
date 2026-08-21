# Wiederherstellung von Kundendaten aus einem Sicherungssatz

## Zweck und harte Grenze

Dieses Runbook ist der Go/No-Go-Vertrag fuer die Wiederherstellung eines
vollstaendigen Kundendaten-Sicherungspunkts aus `gernetix_runtime`, der
Forgejo-Datenbank, `forgejo_data` und dem Artifact Store. Die verbindliche
fachliche Zielsetzung steht in
[customer-data-backup-and-recovery.md](customer-data-backup-and-recovery.md);
die Inbetriebnahme der Sicherung in
[customer-data-backup-setup.md](customer-data-backup-setup.md); der engere
Nachweis fuer den Forgejo-Anteil allein in
[forgejo-backup-restore-runbook.md](forgejo-backup-restore-runbook.md).

Ein Restore liest immer zuerst in eine isolierte Umgebung. Er schreibt niemals
ungeprueft ueber den produktiven Stand. Die fachliche Pruefung akzeptiert nur
Compose-Projektnamen mit dem Praefix `gernetix-restore-`. Dieses Runbook ist
weder Deployment noch Cutover-Freigabe.

## Was ein Sicherungssatz enthaelt

Ein Satz ist ein Verzeichnis, dessen Name die Backup-ID ist
(`<YYYYMMDD>T<HHMMSS>Z-<hourly|daily>-<16 Hexzeichen>`). Er enthaelt
ausschliesslich:

| Objekt | Inhalt |
| --- | --- |
| `manifest.json.gxb` | verschluesseltes Manifest: Backup-ID, Zeit, Modus, Quellinstanz, Anwendungs- und Schemaversion, Forgejo-Version, Konsistenzart je Bestandteil, Groessen, Pruefsummen, uebernommene Artefakte |
| `runtime-database.dump.gxb` | `gernetix_runtime` als PostgreSQL-Custom-Dump |
| `runtime-roles.sql.gxb` | Rollen der Datenbank |
| `forgejo-database.dump.gxb` | Datenbank `forgejo` |
| `forgejo-data.tar.gz.gxb` | Repository-Volume `forgejo_data` |
| `artifact-objects.tar.gxb` | die seit dem letzten bestaetigten Punkt hinzugekommenen Artifact-Store-Objekte |
| `SHA256SUMS` | unverschluesselte SHA-256-Liste **der verschluesselten Objekte** |

`SHA256SUMS` ist der einzige unverschluesselte Bestandteil. Er erlaubt dem VPS
und dem privaten Backup-Server, Vollstaendigkeit und Unversehrtheit zu pruefen,
ohne einen Satz lesen zu koennen.

## Konsistenzart des gewaehlten Punktes

Der Modus im Manifest entscheidet, wofuer der Punkt taugt:

| Modus | Forgejo-Konsistenz | Verwendung |
| --- | --- | --- |
| `daily` | `stopped_service_snapshot` | gemeinsam konsistenter Punkt; belastbarer Ausgangspunkt fuer den vollstaendigen Wiederaufbau einschliesslich Projektdateien |
| `hourly` | `online_snapshot` | gueltiger Wiederherstellungspunkt fuer Kundendaten; Projektdateien stammen aus dem laufenden Betrieb und sind nicht garantiert gemeinsam konsistent |

`tools/restore-backup-set.js` gibt diese Unterscheidung bei jedem Lauf aus und
schreibt sie als `jointly_consistent_restore_point` ins Protokoll. Wer einen
stuendlichen Punkt fuer den Wiederaufbau der Projektdateien verwendet, muss das
ausdruecklich begruenden und protokollieren.

## Ablauf

### 1. Vorfall eingrenzen

Weitere Schreibzugriffe stoppen. Erst danach wird ein Wiederherstellungspunkt
ausgewaehlt.

### 2. Punkt auswaehlen und Satz pruefen

Der Recovery-Key liegt offline. Er wird ausschliesslich auf dem Rechner
bereitgestellt, der die isolierte Wiederherstellung ausfuehrt, und danach dort
wieder entfernt. Er gehoert nie auf den VPS.

```bash
node tools/restore-backup-set.js <satz-verzeichnis> \
  --private-key <pfad-zum-offline-recovery-key> \
  --target-dir  <leeres-isoliertes-arbeitsverzeichnis> \
  --store-dir   <verzeichnis-mit-allen-saetzen> \
  --report      <protokoll.json>
```

Der Lauf prueft vor jeder weiteren Handlung:

- die Pruefsummenliste gegen alle verschluesselten Objekte;
- dass Satz und Manifest sich gegenseitig vollstaendig abdecken;
- dass jeder Bestandteil nach dem Entschluesseln exakt seinem im Manifest
  gefuehrten Klartexthash und seiner Groesse entspricht;
- dass die Recovery-Key-ID des Satzes zum verwendeten Schluessel passt;
- dass jedes Artifact-Store-Objekt seinem eigenen Inhaltshash entspricht;
- dass alle uebernommenen Artefakte in den vom Manifest benannten frueheren
  Saetzen tatsaechlich vorhanden sind, und dass auch diese Saetze unversehrt
  sind.

Fehlt ein benoetigter frueherer Satz oder auch nur ein Objekt, gilt zwingend
**NO-GO**. Ein unvollstaendiger Punkt wird nie als Teilerfolg behandelt.

### 3. In eine isolierte Umgebung einspielen

```bash
RESTORE_COMPOSE_PROJECT=gernetix-restore-<lauf-id> RESTORE_COMPOSE_FILE=<isolierte-compose-datei> RESTORE_ENV_FILE=<synthetische-env-datei> RESTORE_EXPECTED_FORGEJO_VERSION=15.0.6 tools/apply-restored-backup-set.sh <bestandteile-verzeichnis> <artefakte-verzeichnis>
```

Ziel ist ein neues Compose-Projekt mit dem Praefix `gernetix-restore-`, dessen
Container und Volumes nachweislich noch nicht existieren.
[tools/apply-restored-backup-set.sh](../tools/apply-restored-backup-set.sh)
weist das vor dem ersten schreibenden Schritt nach und entfernt bei einem
Fehler ausschliesslich dieses eine Projekt samt seiner Volumes. Es fuehrt aus:

1. Rollen aus `runtime-roles.sql` einspielen und anschliessend nachweisen, dass
   jede im Sicherungssatz genannte Rolle tatsaechlich existiert;
2. `gernetix_runtime` per `pg_restore` einspielen;
3. die Datenbank `forgejo` einspielen;
4. `forgejo_data` in das Volume der isolierten Forgejo-Instanz entpacken; die
   Forgejo-Patchversion des isolierten Images muss der `forgejo_version` des
   Manifests entsprechen;
5. die Artifact-Store-Objekte aus allen beteiligten Saetzen in den Store des
   isolierten Standes entpacken, ohne vorhandene Objekte zu ueberschreiben;
6. Forgejo starten, auf Gesundheit warten und die laufende Patchversion gegen
   den Sicherungssatz halten.

Vor dem ersten schreibenden Schritt werden beide Datenbanken und das
Repository-Volume als leer nachgewiesen und alle Archive auf unsichere Pfade
geprueft. Erst wenn alle Dienste gesund sind, folgt die fachliche Pruefung.

### 4. Fachlich pruefen

```bash
node tools/check-restored-runtime.js \
  --compose-project gernetix-restore-<lauf-id> \
  --compose-file <isolierte-compose-datei> \
  --env-file <synthetische-env-datei> \
  --expected-row-counts <bestand-zum-sicherungszeitpunkt.json> \
  --report <fachpruefung.json>
```

Geprueft werden:

| Pruefung | Musswert |
| --- | --- |
| `accounts_vorhanden` | groesser null |
| `projekte_haben_accounts` | null verwaiste Projekte |
| `repository_bindung_vollstaendig` | null Projekte mit Repository, aber ohne Repository-ID oder erwarteten Commit |
| `artefakte_haben_projekte` | null verwaiste Build-Artefakte |
| `pairings_haben_accounts` | null verwaiste Pairings |
| `pairings_haben_geraete` | null verwaiste Geraetebezuege |
| `bestellungen_haben_accounts` | null verwaiste Bestellungen |
| `hardware_inventar_vorhanden` | groesser null |

Zusaetzlich werden die Zeilenzahlen gegen den Stand zum Sicherungszeitpunkt
gehalten. Fehlt der Vergleichswert, wird das ausgewiesen und gilt **nicht** als
bestanden. Ergaenzend gehoert ein frischer Clone eines privaten Repositories aus
dem wiederhergestellten Forgejo zum Nachweis; das Vorgehen dafuer steht im
[Forgejo-Runbook](forgejo-backup-restore-runbook.md).

### 5. Freigeben und umschalten

Freigabe und Verantwortlichen dokumentieren, danach kontrolliert umschalten.
Vor dem Umschalten sind die seit dem Sicherungszeitpunkt wirksam gewordenen
datenschutzrechtlichen Loeschungen erneut anzuwenden. Der technische Mechanismus
dafuer ist noch offen und in
[customer-data-backup-and-recovery.md](customer-data-backup-and-recovery.md)
unter den offenen Punkten beschrieben; bis dahin erfolgt dieser Schritt
dokumentiert von Hand.

### 6. Auditieren

Vorfall, Datenluecke, verwendeten Sicherungspunkt und Nachweis auditieren und
den Kunden transparent informieren, falls Daten betroffen waren.

## Go/No-Go

**GO** ist nur zulaessig, wenn alle Pruefungen aus Schritt 2 bestanden sind,
alle fachlichen Pruefungen aus Schritt 4 bestehen, jede Bestandsabweichung
erklaert ist und die Dauer innerhalb des RTO liegt.

**NO-GO** gilt bei falscher oder fehlender Pruefsumme, fehlendem oder
unvollstaendigem Satz, fehlendem frueheren Satz fuer uebernommene Artefakte,
einem Artefakt mit falschem Inhaltshash, abweichender Forgejo-Patchversion,
nicht leerem Restore-Ziel, fehlgeschlagener fachlicher Pruefung sowie jeder
unerklaerten Bestandsabweichung. Der Satz bleibt unveraendert, der Befund wird
protokolliert und es erfolgt keine Zielumschaltung.

## Zu protokollierendes Ergebnis

- Lauf-ID und UTC-Zeitfenster
- Backup-ID, Erstellungszeit, Modus und Konsistenzart des Punktes
- Anwendungs-, Schema- und Forgejo-Version des Satzes
- Ergebnis der Pruefsummen- und Artefaktabdeckung, einschliesslich der Anzahl
  aus frueheren Saetzen nachgezogener Objekte
- Ergebnis jeder fachlichen Pruefung und jede Bestandsabweichung
- gemessene Dauer gegen das RTO und die Datenluecke gegen das RPO
- GO oder NO-GO, Abweichungen und verantwortliche Pruefperson

Keine Passwoerter, Tokens, Schluessel oder anderen Secrets werden in den
Nachweis aufgenommen. Der Recovery-Key wird nach dem Lauf vom ausfuehrenden
Rechner entfernt.

## Nachweisstand

Die Werkzeugvertraege sind durch den CI-Job `customer-data-backup` abgedeckt:
Verschluesselung, Manifest, Sicherungssatz, Orchestrierung, satzuebergreifende
Artefaktabdeckung und die fachlichen Pruefungen laufen gegen synthetische Daten.

Der Containerlauf gegen echte Dienste ist als
[tools/backup-restore-e2e.sh](../tools/backup-restore-e2e.sh) umgesetzt und
laeuft im CI-Job `customer-data-backup-e2e`. Er baut eine synthetische Quelle
mit PostgreSQL, Forgejo, privatem Repository und content-addressed Artifact
Store auf, sichert sie taeglich und stuendlich, stellt den stuendlichen Punkt
wieder her und belegt Dateibaum, Commit-Historie, Repository-Bindung, Bestand
und beide Artefakte. Beide Negativfaelle — veraendertes Objekt und fehlender
frueherer Satz — muessen abbrechen.

Solange dieser Lauf nicht auf einem Docker-faehigen Rechner bestanden hat,
lautet der Status `contract passed, container evidence pending`. Er ist auch
danach ausdruecklich kein Nachweis fuer externen unveraenderbaren Speicher,
produktives RPO/RTO oder einen Cutover.
